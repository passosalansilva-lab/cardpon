import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CREATE-FEATURE-CHECKOUT] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting feature checkout creation");

    const authHeader = req.headers.get("Authorization");
    logStep("Auth header present", { hasAuth: !!authHeader });

    if (!authHeader) {
      logStep("No authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      logStep("Auth error", { error: authError?.message });
      return new Response(
        JSON.stringify({ error: "Session expired. Please refresh the page and try again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User authenticated", { userId: user.id });

    const body = await req.json();
    const {
      featureId,
      featureKey,
      featureName,
      pricingId,
      priceType,
      price,
      companyId,
      paymentMethod,
      returnUrl,
    } = body;

    logStep("Request body", { featureId, featureKey, priceType, price, paymentMethod });

    if (!featureId || !pricingId || !price || !companyId || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se a empresa pertence ao usuário
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .select("id, name, owner_id")
      .eq("id", companyId)
      .single();

    if (companyError || !company || company.owner_id !== user.id) {
      logStep("Company validation failed", { companyError: companyError?.message });
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mercadoPagoToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoToken) {
      logStep("Mercado Pago token not configured");
      return new Response(
        JSON.stringify({ error: "Payment gateway not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = `${featureName} - ${priceType === "monthly" ? "Assinatura Mensal" : "Acesso Vitalício"}`;
    const externalReference = JSON.stringify({
      type: "feature_purchase",
      featureId,
      featureKey,
      pricingId,
      priceType,
      companyId,
      userId: user.id,
    });

    logStep("Creating Mercado Pago checkout", { title, price });

    if (priceType === "monthly" && paymentMethod === "card") {
      // Para assinatura mensal com cartão, criar preapproval
      const preapprovalBody = {
        reason: title,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: price,
          currency_id: "BRL",
        },
        back_url: returnUrl,
        external_reference: externalReference,
        payer_email: user.email,
      };

      const preapprovalResponse = await fetch(
        "https://api.mercadopago.com/preapproval",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mercadoPagoToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(preapprovalBody),
        }
      );

      const preapprovalData = await preapprovalResponse.json();
      logStep("Preapproval response", { status: preapprovalResponse.status, data: preapprovalData });

      if (!preapprovalResponse.ok) {
        throw new Error(preapprovalData.message || "Failed to create subscription");
      }

      return new Response(
        JSON.stringify({
          checkoutUrl: preapprovalData.init_point,
          preapprovalId: preapprovalData.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Para pagamento único ou PIX, criar preference
      const preferenceBody = {
        items: [
          {
            id: featureId,
            title: title,
            description: `Funcionalidade: ${featureName}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: price,
          },
        ],
        back_urls: {
          success: `${returnUrl}&status=approved`,
          failure: `${returnUrl}&status=rejected`,
          pending: `${returnUrl}&status=pending`,
        },
        auto_return: "approved",
        external_reference: externalReference,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/feature-purchase-webhook`,
        payment_methods: paymentMethod === "pix" 
          ? { excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }] }
          : {},
      };

      const preferenceResponse = await fetch(
        "https://api.mercadopago.com/checkout/preferences",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mercadoPagoToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(preferenceBody),
        }
      );

      const preferenceData = await preferenceResponse.json();
      logStep("Preference response", { status: preferenceResponse.status, data: preferenceData });

      if (!preferenceResponse.ok) {
        throw new Error(preferenceData.message || "Failed to create checkout");
      }

      return new Response(
        JSON.stringify({
          checkoutUrl: preferenceData.init_point,
          preferenceId: preferenceData.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    logStep("Error", { message: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
