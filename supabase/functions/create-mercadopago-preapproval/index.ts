import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-MP-PREAPPROVAL] ${step}${detailsStr}`);
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

    // Create Mercado Pago preapproval (subscription) for recurring payment
    // Using the preapproval_plan endpoint for recurring billing
    const preapprovalData = {
      reason: `${plan.name} - Assinatura Mensal Cardapeon`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: Number(plan.price),
        currency_id: "BRL",
      },
      payer_email: user.email,
      back_url: `${origin}/dashboard/plans?subscription=success&plan=${planKey}`,
      external_reference: JSON.stringify({
        companyId: company.id,
        planKey: planKey,
        userId: user.id,
        type: "preapproval",
      }),
      status: "pending",
    };

    logStep("Creating MP preapproval", { reason: preapprovalData.reason, amount: plan.price });

    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preapprovalData),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      logStep("MP API error", { status: mpResponse.status, error: errorText });
      throw new Error(`Mercado Pago API error: ${mpResponse.status} - ${errorText}`);
    }

    const mpData = await mpResponse.json();
    logStep("MP preapproval created", { preapprovalId: mpData.id, initPoint: mpData.init_point });

    // Save preapproval ID to company for future reference
    await supabaseClient
      .from("companies")
      .update({
        stripe_customer_id: mpData.id, // Reusing this field for MP preapproval ID
        updated_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    return new Response(JSON.stringify({ 
      url: mpData.init_point,
      preapprovalId: mpData.id,
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
