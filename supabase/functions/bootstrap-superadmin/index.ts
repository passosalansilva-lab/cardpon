import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DefaultPlan {
  key: string;
  name: string;
  description: string;
  price: number;
  order_limit: number;
  revenue_limit: number;
  sort_order: number;
}

const DEFAULT_PLANS: DefaultPlan[] = [
  {
    key: "free",
    name: "Plano Gratuito",
    description: "Ideal para começar e testar a plataforma.",
    price: 0,
    order_limit: 1000,
    revenue_limit: 2000,
    sort_order: 0,
  },
  {
    key: "starter",
    name: "Plano Inicial",
    description: "Para quem está começando a vender todos os dias.",
    price: 49,
    order_limit: 1500,
    revenue_limit: 5000,
    sort_order: 1,
  },
  {
    key: "basic",
    name: "Plano Básico",
    description: "Para negócios em crescimento, com limite confortável de vendas.",
    price: 99,
    order_limit: 2500,
    revenue_limit: 10000,
    sort_order: 2,
  },
  {
    key: "growth",
    name: "Plano Crescimento",
    description: "Para operações em expansão, com maior volume de pedidos.",
    price: 149,
    order_limit: 4000,
    revenue_limit: 30000,
    sort_order: 3,
  },
  {
    key: "pro",
    name: "Plano Pro",
    description: "Para operações mais intensas, com limite maior de vendas.",
    price: 199,
    order_limit: 6000,
    revenue_limit: 50000,
    sort_order: 4,
  },
  {
    key: "enterprise",
    name: "Plano Enterprise",
    description: "Para grandes operações, com limite de vendas ilimitado.",
    price: 499,
    order_limit: -1,
    revenue_limit: -1,
    sort_order: 5,
  },
];

async function ensureDefaultPlans(supabaseAdmin: any) {
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY for plan bootstrap");
      return;
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const stripe = stripeKey
      ? new Stripe(stripeKey, { apiVersion: "2024-06-20" })
      : null;

    for (const planDef of DEFAULT_PLANS) {
      const { data: existingPlan, error: fetchError } = await adminClient
        .from("subscription_plans")
        .select("id, stripe_product_id, stripe_price_id")
        .eq("key", planDef.key)
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching subscription plan", planDef.key, fetchError.message);
        continue;
      }

      let stripeProductId = existingPlan?.stripe_product_id as string | null | undefined;
      let stripePriceId = existingPlan?.stripe_price_id as string | null | undefined;

      // Se temos Stripe configurado, garantimos Product e Price
      if (stripe) {
        if (!stripeProductId) {
          const product = await stripe.products.create({
            name: planDef.name,
            description: planDef.description,
          });
          stripeProductId = product.id;
        }

        if (!stripePriceId) {
          const price = await stripe.prices.create({
            currency: "brl",
            unit_amount: Math.round(planDef.price * 100),
            recurring: { interval: "month" },
            product: stripeProductId!,
          });
          stripePriceId = price.id;
        }
      }

      if (existingPlan) {
        const { error: updateError } = await adminClient
          .from("subscription_plans")
          .update({
            name: planDef.name,
            description: planDef.description,
            price: planDef.price,
            order_limit: planDef.order_limit,
            revenue_limit: planDef.revenue_limit,
            sort_order: planDef.sort_order,
            stripe_product_id: stripeProductId ?? existingPlan.stripe_product_id,
            stripe_price_id: stripePriceId ?? existingPlan.stripe_price_id,
          })
          .eq("id", existingPlan.id);

        if (updateError) {
          console.error("Error updating subscription plan", planDef.key, updateError.message);
        }
      } else {
        const { error: insertError } = await adminClient.from("subscription_plans").insert({
          key: planDef.key,
          name: planDef.name,
          description: planDef.description,
          price: planDef.price,
          order_limit: planDef.order_limit,
          revenue_limit: planDef.revenue_limit,
          sort_order: planDef.sort_order,
          stripe_product_id: stripeProductId ?? null,
          stripe_price_id: stripePriceId ?? null,
        });

        if (insertError) {
          console.error("Error inserting subscription plan", planDef.key, insertError.message);
        }
      }
    }
  } catch (error) {
    console.error("Unexpected error while ensuring default plans", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SETUP_SECRET = Deno.env.get("SUPERADMIN_SETUP_SECRET");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SETUP_SECRET) {
      console.error("Missing required environment variables");
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => null);
    const { token, userId } = body || {};

    if (!token) {
      return new Response(JSON.stringify({ error: "Token secreto obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (token !== SETUP_SECRET) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se já existe algum super_admin
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id")
      .eq("role", "super_admin")
      .limit(1);

    if (existingError) {
      console.error("Error checking existing super_admin:", existingError);
      return new Response(JSON.stringify({ error: "Erro ao verificar superadmin" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIdUuid = userId as string;

    // Se já existe um superadmin, reaproveita ou transfere o papel para o usuário atual
    if (existing && existing.length > 0) {
      const current = existing[0] as { id: string; user_id: string | null };

      if (current.user_id === userIdUuid) {
        // Usuário atual já é o superadmin; ainda assim garantimos os planos
        await ensureDefaultPlans(supabaseAdmin);
        return new Response(JSON.stringify({ success: true, alreadySuperadmin: true, plansSeeded: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from("user_roles")
        .update({ user_id: userIdUuid })
        .eq("id", current.id);

      if (updateError) {
        console.error("Error updating super_admin owner:", updateError);
        return new Response(JSON.stringify({ error: "Erro ao transferir superadmin" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await ensureDefaultPlans(supabaseAdmin);

      return new Response(JSON.stringify({ success: true, transferred: true, plansSeeded: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userIdUuid,
      role: "super_admin",
    });

    if (insertError) {
      console.error("Error inserting super_admin role:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao registrar superadmin" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await ensureDefaultPlans(supabaseAdmin);

    return new Response(JSON.stringify({ success: true, plansSeeded: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error in bootstrap-superadmin:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
