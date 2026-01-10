import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-MP-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const mpAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mpAccessToken) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN is not set");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      logStep("Auth error", { error: authError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get request body
    const { planKey } = await req.json();
    logStep("Plan key received", { planKey });

    if (!planKey) {
      throw new Error("Missing planKey");
    }

    // Get company
    const { data: company, error: companyError } = await supabaseClient
      .from("companies")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (companyError || !company) {
      logStep("Company not found", { error: companyError?.message });
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Check if company is approved
    if (company.status !== "approved") {
      logStep("Company not approved", { status: company.status });
      return new Response(JSON.stringify({ 
        error: "Sua empresa precisa estar aprovada para fazer upgrade de plano" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("key", planKey)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      logStep("Plan not found", { error: planError?.message });
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    logStep("Plan found", { planName: plan.name, price: plan.price });

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://cardapio-on.lovable.app";

    // Create Mercado Pago preference for subscription payment
    const preferenceData = {
      items: [
        {
          id: plan.key,
          title: `${plan.name} - Assinatura Mensal Cardapeon`,
          description: `Plano ${plan.name} - Limite de R$ ${plan.revenue_limit}/mês`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(plan.price),
        },
      ],
      payer: {
        email: user.email,
        name: company.name,
      },
      back_urls: {
        success: `${origin}/dashboard/plans?subscription=success&plan=${planKey}`,
        failure: `${origin}/dashboard/plans?subscription=failed`,
        pending: `${origin}/dashboard/plans?subscription=pending`,
      },
      auto_return: "approved",
      external_reference: JSON.stringify({
        companyId: company.id,
        planKey: planKey,
        userId: user.id,
        type: "subscription",
      }),
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-subscription-webhook`,
      statement_descriptor: "CARDAPEON",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    logStep("Creating MP preference", { items: preferenceData.items });

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      logStep("MP API error", { status: mpResponse.status, error: errorText });
      throw new Error(`Mercado Pago API error: ${mpResponse.status}`);
    }

    const mpData = await mpResponse.json();
    logStep("MP preference created", { preferenceId: mpData.id });

    return new Response(JSON.stringify({ 
      url: mpData.init_point,
      preferenceId: mpData.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
