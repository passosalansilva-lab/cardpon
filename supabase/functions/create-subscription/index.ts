import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing backend environment variables");
    }

    // Use service role client for auth validation + DB reads
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No authorization header provided");
      throw new Error("Authorization header is required");
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Token received", { tokenLength: token.length });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError) {
      logStep("Auth error", { error: userError.message, code: userError.status });
      throw new Error(`Authentication failed: ${userError.message}`);
    }

    if (!userData.user?.email) {
      logStep("No user email found");
      throw new Error("User email not found");
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      throw new Error("Body inválido (JSON)");
    }

    const planKey = String(body?.planKey || "").trim();
    if (!planKey) throw new Error("Plan key is required");

    // Ensure company exists and is approved (server-side gate)
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id,status")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (companyError) {
      logStep("Company lookup error", { error: companyError.message });
      throw new Error(`Erro ao buscar empresa: ${companyError.message}`);
    }

    if (!company?.id) {
      throw new Error("Empresa não encontrada para este usuário");
    }

    if (company.status !== "approved") {
      throw new Error(
        "Empresa pendente de aprovação. Você só poderá fazer upgrade/assinatura após sua empresa ser aprovada."
      );
    }

    // Fetch plan from database
    const { data: plan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("key", planKey)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      logStep("Plan not found", { planKey, error: planError?.message });
      throw new Error(`Invalid plan: ${planKey}`);
    }

    logStep("Plan selected", { planKey, price: plan.price, name: plan.name });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = newCustomer.id;
      logStep("New customer created", { customerId });
    }

    // Update company with stripe customer id
    const { error: updateCompanyError } = await supabaseAdmin
      .from("companies")
      .update({ stripe_customer_id: customerId })
      .eq("id", company.id);

    if (updateCompanyError) {
      logStep("Company update error", { error: updateCompanyError.message });
      throw new Error(`Erro ao atualizar empresa: ${updateCompanyError.message}`);
    }

    const originHeader = req.headers.get("origin");
    const referer = req.headers.get("referer");

    let origin = originHeader || "";
    if (!origin && referer) {
      try {
        origin = new URL(referer).origin;
      } catch {
        // ignore
      }
    }

    if (!origin) {
      origin = "http://localhost:5173";
    }

    logStep("Origin resolved", { originHeader, referer, origin });

    // Convert price to cents (Stripe uses smallest currency unit)
    const priceNumber = Number(plan.price);
    const priceInCents = Math.round(priceNumber * 100);

    if (!Number.isFinite(priceInCents) || priceInCents <= 0) {
      throw new Error(`Preço inválido para o plano ${planKey}: ${plan.price}`);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: plan.name,
              description:
                plan.description || `Plano ${plan.name} - até ${plan.order_limit} pedidos/mês`,
            },
            unit_amount: priceInCents,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      payment_method_types: ["card"],
      success_url: `${origin}/dashboard/plans?subscription=success`,
      cancel_url: `${origin}/dashboard/plans?subscription=cancelled`,
      metadata: {
        userId: user.id,
        planKey,
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const isAuthError =
      errorMessage.includes("Authorization header is required") ||
      errorMessage.includes("Authentication failed") ||
      errorMessage.includes("User email not found");

    const isForbiddenError = errorMessage.includes("pendente de aprovação");

    logStep("ERROR", { message: errorMessage, isAuthError, isForbiddenError });

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isAuthError ? 401 : isForbiddenError ? 403 : 500,
    });
  }
});
