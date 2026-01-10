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

interface CardPaymentRequest {
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

    const body: CardPaymentRequest = await req.json();
    console.log("[create-card-payment] Creating card checkout for company:", body.companyId);

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
      console.error("[create-card-payment] Payment settings not found:", settingsError);
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
      payment_method: 'online', // card payment
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
      console.error("[create-card-payment] Error creating pending order:", pendingError);
      throw new Error("Erro ao criar pedido pendente");
    }

    const pendingId = pendingOrder.id;

    // Build items for MP preference
    const mpItems = body.items.map(item => ({
      id: item.product_id,
      title: item.product_name.slice(0, 255),
      description: item.notes?.slice(0, 255) || `Quantidade: ${item.quantity}`,
      quantity: item.quantity,
      currency_id: "BRL",
      unit_price: Number(item.unit_price.toFixed(2)),
    }));

    // Add delivery fee as item if present
    if (body.deliveryFee > 0) {
      mpItems.push({
        id: "delivery",
        title: "Taxa de Entrega",
        description: "Entrega",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(body.deliveryFee.toFixed(2)),
      });
    }

    // Apply discount if present
    if (body.discountAmount && body.discountAmount > 0) {
      mpItems.push({
        id: "discount",
        title: "Desconto",
        description: "Cupom de desconto",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number((-body.discountAmount).toFixed(2)),
      });
    }

    // Create checkout preference via Mercado Pago
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '') || '';
    const menuUrl = `${baseUrl.replace('supabase.co', 'lovable.app')}/menu/${company.slug}`;

    const preferenceData = {
      items: mpItems,
      payer: {
        email: body.customerEmail || `cliente_${Date.now()}@temp.com`,
        name: body.customerName,
      },
      external_reference: JSON.stringify({
        type: "order_payment",
        pending_id: pendingId,
        company_id: body.companyId,
        payment_type: "card",
      }),
      back_urls: {
        success: `${menuUrl}?payment=success&pending_id=${pendingId}`,
        failure: `${menuUrl}?payment=failure&pending_id=${pendingId}`,
        pending: `${menuUrl}?payment=pending&pending_id=${pendingId}`,
      },
      auto_return: "approved",
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/order-payment-webhook`,
      statement_descriptor: company.name.slice(0, 22),
      payment_methods: {
        excluded_payment_types: [
          { id: "ticket" },
          { id: "atm" },
        ],
        installments: 12,
      },
    };

    console.log("[create-card-payment] Creating MP preference...");

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${paymentSettings.mercadopago_access_token}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error("[create-card-payment] Mercado Pago error:", errorText);
      
      // Clean up pending order
      await supabaseClient
        .from("pending_order_payments")
        .delete()
        .eq("id", pendingId);
      
      throw new Error("Erro ao criar checkout no Mercado Pago");
    }

    const preference = await mpResponse.json();
    console.log("[create-card-payment] Preference created:", preference.id);

    // Update pending order with preference ID
    await supabaseClient
      .from("pending_order_payments")
      .update({ 
        mercadopago_preference_id: preference.id,
      })
      .eq("id", pendingId);

    return new Response(
      JSON.stringify({
        preferenceId: preference.id,
        pendingId: pendingId,
        checkoutUrl: preference.init_point,
        sandboxUrl: preference.sandbox_init_point,
        total: body.total,
        companyName: company.name,
        companySlug: company.slug,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[create-card-payment] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
