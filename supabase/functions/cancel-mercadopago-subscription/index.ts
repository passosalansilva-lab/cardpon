import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CANCEL-MP-SUBSCRIPTION] ${step}${detailsStr}`);
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

    logStep("User authenticated", { userId: user.id });

    // Get company
    const { data: company, error: companyError } = await supabaseClient
      .from("companies")
      .select("id, stripe_customer_id, subscription_status, subscription_plan")
      .eq("owner_id", user.id)
      .single();

    if (companyError || !company) {
      logStep("Company not found", { error: companyError?.message });
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Check if has active subscription
    if (company.subscription_status !== 'active' || !company.subscription_plan) {
      return new Response(JSON.stringify({ error: "Nenhuma assinatura ativa encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // If we have a preapproval ID, cancel it in Mercado Pago
    if (company.stripe_customer_id) {
      try {
        const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${company.stripe_customer_id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mpAccessToken}`,
          },
          body: JSON.stringify({ status: "cancelled" }),
        });

        if (mpResponse.ok) {
          logStep("MP preapproval cancelled", { preapprovalId: company.stripe_customer_id });
        } else {
          const errorText = await mpResponse.text();
          logStep("MP cancel warning (continuing)", { error: errorText });
        }
      } catch (mpError) {
        logStep("MP cancel error (continuing)", { error: mpError });
      }
    }

    // Update company subscription status
    const { error: updateError } = await supabaseClient
      .from("companies")
      .update({
        subscription_status: 'cancelled',
        subscription_plan: null,
        subscription_end_date: null,
        stripe_customer_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    if (updateError) {
      logStep("Update error", { error: updateError.message });
      throw new Error("Erro ao atualizar status da assinatura");
    }

    // Create notification
    await supabaseClient
      .from("notifications")
      .insert({
        user_id: user.id,
        title: "Assinatura cancelada",
        message: "Sua assinatura foi cancelada com sucesso. Você voltou para o plano gratuito.",
        type: "info",
        data: { type: "subscription_cancelled" },
      });

    logStep("Subscription cancelled successfully");

    return new Response(JSON.stringify({ 
      success: true,
      message: "Assinatura cancelada com sucesso"
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
