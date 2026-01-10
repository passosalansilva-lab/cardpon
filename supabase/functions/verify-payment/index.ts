import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const { orderId } = await req.json();
    logStep("Verifying payment for order", { orderId });

    if (!orderId) {
      throw new Error("Missing orderId");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get order with payment intent
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("stripe_payment_intent_id, payment_status")
      .eq("id", orderId)
      .single();

    if (orderError) throw new Error(`Order not found: ${orderError.message}`);
    logStep("Order found", { paymentIntentId: order.stripe_payment_intent_id });

    if (!order.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ 
        status: "no_payment_intent",
        paid: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    logStep("Payment intent retrieved", { status: paymentIntent.status });

    const isPaid = paymentIntent.status === "succeeded";

    if (isPaid && order.payment_status !== "paid") {
      await supabaseClient
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("id", orderId);
      logStep("Order payment status updated to paid");
    }

    return new Response(JSON.stringify({ 
      status: paymentIntent.status,
      paid: isPaid
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
