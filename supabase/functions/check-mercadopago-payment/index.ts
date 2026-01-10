import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-MP-PAYMENT] ${step}${detailsStr}`);
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

    const { preferenceId } = await req.json();
    logStep("Checking payment for preference", { preferenceId });

    if (!preferenceId) {
      throw new Error("Missing preferenceId");
    }

    // Get company for this user
    const { data: company, error: companyError } = await supabaseClient
      .from("companies")
      .select("id, subscription_status, subscription_plan")
      .eq("owner_id", user.id)
      .single();

    if (companyError || !company) {
      logStep("Company not found", { error: companyError?.message });
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // First, check if subscription is already active in database
    if (company.subscription_status === 'active' && company.subscription_plan) {
      logStep("Subscription already active in database", { plan: company.subscription_plan });
      return new Response(JSON.stringify({ 
        status: "approved",
        paid: true,
        plan: company.subscription_plan,
        message: "Assinatura ativa"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Search for payments related to this preference
    const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(JSON.stringify({ companyId: company.id }))}&sort=date_created&criteria=desc`;
    
    logStep("Searching payments", { searchUrl: searchUrl.substring(0, 100) });

    const searchResponse = await fetch(searchUrl, {
      headers: {
        "Authorization": `Bearer ${mpAccessToken}`,
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      logStep("MP search error", { status: searchResponse.status, error: errorText });
      
      // Try alternative: get preference and check its payments
      const prefResponse = await fetch(`https://api.mercadopago.com/checkout/preferences/${preferenceId}`, {
        headers: {
          "Authorization": `Bearer ${mpAccessToken}`,
        },
      });

      if (prefResponse.ok) {
        const prefData = await prefResponse.json();
        logStep("Preference data", { id: prefData.id, externalReference: prefData.external_reference });
        
        // Search by external_reference from preference
        if (prefData.external_reference) {
          const altSearchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(prefData.external_reference)}&sort=date_created&criteria=desc`;
          
          const altSearchResponse = await fetch(altSearchUrl, {
            headers: {
              "Authorization": `Bearer ${mpAccessToken}`,
            },
          });

          if (altSearchResponse.ok) {
            const altSearchData = await altSearchResponse.json();
            logStep("Alternative search results", { total: altSearchData.results?.length });

            if (altSearchData.results && altSearchData.results.length > 0) {
              const latestPayment = altSearchData.results[0];
              logStep("Latest payment found", { id: latestPayment.id, status: latestPayment.status });

              if (latestPayment.status === 'approved') {
                // Payment approved - update subscription
                const externalRef = JSON.parse(prefData.external_reference);
                
                await supabaseClient
                  .from("companies")
                  .update({
                    subscription_plan: externalRef.planKey,
                    subscription_status: 'active',
                    subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", company.id);

                logStep("Subscription activated via alternative search", { plan: externalRef.planKey });

                return new Response(JSON.stringify({ 
                  status: "approved",
                  paid: true,
                  plan: externalRef.planKey,
                  message: "Pagamento aprovado!"
                }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                  status: 200,
                });
              }

              return new Response(JSON.stringify({ 
                status: latestPayment.status,
                paid: false,
                message: getStatusMessage(latestPayment.status)
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            }
          }
        }
      }

      // No payments found yet
      return new Response(JSON.stringify({ 
        status: "pending",
        paid: false,
        message: "Aguardando pagamento..."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const searchData = await searchResponse.json();
    logStep("Search results", { total: searchData.results?.length });

    if (!searchData.results || searchData.results.length === 0) {
      return new Response(JSON.stringify({ 
        status: "pending",
        paid: false,
        message: "Aguardando pagamento..."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get the latest payment
    const latestPayment = searchData.results[0];
    logStep("Latest payment", { id: latestPayment.id, status: latestPayment.status });

    const isPaid = latestPayment.status === 'approved';

    return new Response(JSON.stringify({ 
      status: latestPayment.status,
      paid: isPaid,
      paymentId: latestPayment.id,
      message: getStatusMessage(latestPayment.status)
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

function getStatusMessage(status: string): string {
  switch (status) {
    case 'approved':
      return 'Pagamento aprovado!';
    case 'pending':
    case 'in_process':
      return 'Aguardando confirmação do pagamento...';
    case 'rejected':
      return 'Pagamento rejeitado';
    case 'cancelled':
      return 'Pagamento cancelado';
    default:
      return 'Verificando status...';
  }
}
