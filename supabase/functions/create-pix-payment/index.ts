import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  options?: any[];
  product_id: string;
}

interface PixPaymentRequest {
  companyId: string;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddressId?: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  couponId?: string;
  discountAmount?: number;
  notes?: string;
  needsChange?: boolean;
  changeFor?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: PixPaymentRequest = await req.json();
    console.log("[create-pix-payment] Creating PIX for company:", body.companyId);

    // Validate required fields
    if (!body.companyId || !body.items?.length || !body.customerName) {
      return new Response(
        JSON.stringify({ error: "Dados obrigatórios não fornecidos" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get company payment settings
    const { data: paymentSettings, error: settingsError } = await supabaseClient
      .from("company_payment_settings")
      .select("*")
      .eq("company_id", body.companyId)
      .eq("mercadopago_enabled", true)
      .eq("mercadopago_verified", true)
      .single();

    if (settingsError || !paymentSettings?.mercadopago_access_token) {
      console.error("[create-pix-payment] Payment settings not found:", settingsError);
      return new Response(
        JSON.stringify({ error: "Pagamento online não configurado para esta loja" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get company info
    const { data: company, error: companyError } = await supabaseClient
      .from("companies")
      .select("name, slug")
      .eq("id", body.companyId)
      .single();

    if (companyError || !company) {
      throw new Error("Empresa não encontrada");
    }

    // Store pending order data
    const pendingOrderData = {
      company_id: body.companyId,
      items: body.items,
      customer_name: body.customerName,
      customer_phone: body.customerPhone,
      customer_email: body.customerEmail,
      delivery_address_id: body.deliveryAddressId,
      delivery_fee: body.deliveryFee,
      subtotal: body.subtotal,
      total: body.total,
      coupon_id: body.couponId,
      discount_amount: body.discountAmount,
      notes: body.notes,
      needs_change: body.needsChange,
      change_for: body.changeFor,
      payment_method: 'online',
      created_at: new Date().toISOString(),
    };

    // Create pending order record
    const { data: pendingOrder, error: pendingError } = await supabaseClient
      .from("pending_order_payments")
      .insert({
        company_id: body.companyId,
        order_data: pendingOrderData,
        status: "pending",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
      })
      .select("id")
      .single();

    if (pendingError) {
      console.error("[create-pix-payment] Error creating pending order:", pendingError);
      throw new Error("Erro ao criar pedido pendente");
    }

    const pendingId = pendingOrder.id;

    // Build description for PIX
    const itemsDescription = body.items
      .map(item => `${item.quantity}x ${item.product_name}`)
      .slice(0, 5)
      .join(', ');
    
    const description = `Pedido ${company.name}: ${itemsDescription}`.slice(0, 140);

    // Create PIX payment via Mercado Pago Payments API
    const paymentData = {
      transaction_amount: Number(body.total.toFixed(2)),
      description: description,
      payment_method_id: "pix",
      payer: {
        email: body.customerEmail || `cliente_${Date.now()}@temp.com`,
        first_name: body.customerName.split(' ')[0] || body.customerName,
        last_name: body.customerName.split(' ').slice(1).join(' ') || '',
      },
      external_reference: JSON.stringify({
        type: "order_payment",
        pending_id: pendingId,
        company_id: body.companyId,
      }),
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/order-payment-webhook`,
    };

    console.log("[create-pix-payment] Creating MP PIX payment...");

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${paymentSettings.mercadopago_access_token}`,
        "X-Idempotency-Key": `pix-${pendingId}-${Date.now()}`,
      },
      body: JSON.stringify(paymentData),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error("[create-pix-payment] Mercado Pago error:", errorText);
      
      // Clean up pending order
      await supabaseClient
        .from("pending_order_payments")
        .delete()
        .eq("id", pendingId);
      
      throw new Error("Erro ao criar pagamento PIX no Mercado Pago");
    }

    const payment = await mpResponse.json();
    console.log("[create-pix-payment] PIX payment created:", payment.id, "status:", payment.status);

    // Extract PIX data
    const pixData = payment.point_of_interaction?.transaction_data;
    
    if (!pixData?.qr_code_base64 || !pixData?.qr_code) {
      console.error("[create-pix-payment] PIX data missing from response:", JSON.stringify(payment.point_of_interaction));
      throw new Error("Dados do PIX não retornados pelo Mercado Pago");
    }

    // Update pending order with payment ID
    await supabaseClient
      .from("pending_order_payments")
      .update({ 
        mercadopago_payment_id: String(payment.id),
        mercadopago_preference_id: String(payment.id),
      })
      .eq("id", pendingId);

    return new Response(
      JSON.stringify({
        paymentId: payment.id,
        pendingId: pendingId,
        status: payment.status,
        qrCodeBase64: pixData.qr_code_base64,
        qrCode: pixData.qr_code, // Copia e cola
        ticketUrl: pixData.ticket_url,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        total: body.total,
        companyName: company.name,
        companySlug: company.slug,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[create-pix-payment] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
