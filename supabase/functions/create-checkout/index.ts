import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const { orderId, items, total, customerEmail, customerName } = await req.json();
    logStep("Request data received", { orderId, total, customerEmail });

    if (!orderId || !items || !total) {
      throw new Error("Missing required fields: orderId, items, total");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18" });

    // Check if customer exists
    let customerId: string | undefined;
    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Existing customer found", { customerId });
      }
    }

    // Create line items for checkout
    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: "brl",
        product_data: {
          name: item.productName,
          description: item.options?.length > 0 
            ? `Opções: ${item.options.map((o: any) => o.name).join(", ")}`
            : undefined,
        },
        unit_amount: Math.round(
          (item.price + (item.options?.reduce((s: number, o: any) => s + o.priceModifier, 0) || 0)) * 100
        ),
      },
      quantity: item.quantity,
    }));

    // Add delivery fee as a line item if present
    const origin = req.headers.get("origin") || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/track/${orderId}?payment=success`,
      cancel_url: `${origin}/track/${orderId}?payment=cancelled`,
      metadata: {
        orderId,
        customerName,
      },
      payment_intent_data: {
        metadata: {
          orderId,
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // Update order with payment intent
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabaseClient
      .from("orders")
      .update({ stripe_payment_intent_id: session.payment_intent as string })
      .eq("id", orderId);

    return new Response(JSON.stringify({ url: session.url }), {
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
