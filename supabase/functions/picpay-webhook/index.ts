import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    console.log("[picpay-webhook] Received webhook:", JSON.stringify(body));

    // PicPay webhook payload structure
    // type: "PAYMENT"
    // data.status: "PAID" | "PENDING" | "REFUNDED" | "CANCELLED"
    // data.merchantChargeId: our pending order ID
    // id: PicPay's charge ID

    if (body.type !== "PAYMENT") {
      console.log("[picpay-webhook] Ignoring non-payment event:", body.type);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chargeStatus = body.data?.status;
    const merchantChargeId = body.data?.merchantChargeId;
    const picpayChargeId = body.id;

    if (!merchantChargeId) {
      console.log("[picpay-webhook] No merchantChargeId in webhook");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[picpay-webhook] Processing charge ${picpayChargeId}, merchantId: ${merchantChargeId}, status: ${chargeStatus}`);

    // Find pending order by merchantChargeId (which is the pending order ID)
    const { data: pendingOrder, error: pendingError } = await supabaseClient
      .from("pending_order_payments")
      .select("*")
      .eq("id", merchantChargeId)
      .single();

    if (pendingError || !pendingOrder) {
      console.error("[picpay-webhook] Pending order not found:", merchantChargeId);
      return new Response(JSON.stringify({ received: true, error: "Order not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already processed
    if (pendingOrder.status === "completed" || pendingOrder.order_id) {
      console.log("[picpay-webhook] Order already processed:", pendingOrder.order_id);
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only process PAID status
    if (chargeStatus !== "PAID") {
      console.log("[picpay-webhook] Status is not PAID, ignoring:", chargeStatus);
      
      // Update status if cancelled/refunded
      if (chargeStatus === "CANCELLED" || chargeStatus === "REFUNDED") {
        await supabaseClient
          .from("pending_order_payments")
          .update({ status: "cancelled" })
          .eq("id", merchantChargeId);
      }
      
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as processing to prevent duplicates
    const { error: updateError } = await supabaseClient
      .from("pending_order_payments")
      .update({ status: "processing" })
      .eq("id", merchantChargeId)
      .eq("status", "pending");

    if (updateError) {
      console.log("[picpay-webhook] Could not mark as processing (race condition?):", updateError);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderData = pendingOrder.order_data as any;

    // Find or create customer
    let customerId: string | null = null;
    
    if (orderData.customer_email || orderData.customer_phone) {
      // Try to find existing customer
      const { data: existingCustomer } = await supabaseClient
        .from("customers")
        .select("id")
        .or(`email.eq.${orderData.customer_email?.toLowerCase()},phone.eq.${orderData.customer_phone}`)
        .limit(1)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabaseClient
          .from("customers")
          .insert({
            name: orderData.customer_name,
            email: orderData.customer_email?.toLowerCase() || null,
            phone: orderData.customer_phone || '',
          })
          .select("id")
          .single();

        if (!customerError && newCustomer) {
          customerId = newCustomer.id;
        }
      }
    }

    // Calculate estimated delivery time
    const estimatedDeliveryTime = new Date();
    estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 45);

    // Create the order
    const newOrderId = crypto.randomUUID();
    
    const { error: orderError } = await supabaseClient
      .from("orders")
      .insert({
        id: newOrderId,
        company_id: pendingOrder.company_id,
        customer_id: customerId,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone || '',
        customer_email: orderData.customer_email?.toLowerCase() || null,
        delivery_address_id: orderData.delivery_address_id,
        payment_method: 'pix',
        payment_status: 'paid',
        subtotal: orderData.subtotal,
        delivery_fee: orderData.delivery_fee,
        total: orderData.total,
        notes: orderData.notes || null,
        coupon_id: orderData.coupon_id || null,
        discount_amount: orderData.discount_amount || 0,
        estimated_delivery_time: estimatedDeliveryTime.toISOString(),
        stripe_payment_intent_id: `picpay_${picpayChargeId}`, // Store PicPay ID for reference
      });

    if (orderError) {
      console.error("[picpay-webhook] Error creating order:", orderError);
      throw orderError;
    }

    // Create order items
    const orderItems = orderData.items.map((item: any) => ({
      order_id: newOrderId,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      options: item.options || [],
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabaseClient
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("[picpay-webhook] Error creating order items:", itemsError);
      // Don't throw - order was created
    }

    // Update coupon usage if applicable
    if (orderData.coupon_id) {
      await supabaseClient.rpc('increment_coupon_usage', { coupon_id: orderData.coupon_id });
    }

    // Mark pending order as completed
    await supabaseClient
      .from("pending_order_payments")
      .update({
        status: "completed",
        order_id: newOrderId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", merchantChargeId);

    console.log("[picpay-webhook] Order created successfully:", newOrderId);

    return new Response(
      JSON.stringify({ received: true, order_id: newOrderId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[picpay-webhook] Error:", error);
    // Always return 200 to prevent retries
    return new Response(
      JSON.stringify({ received: true, error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
