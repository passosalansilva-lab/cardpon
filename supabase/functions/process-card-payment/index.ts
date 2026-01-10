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
  token: string;
  paymentMethodId: string;
  installments: number;
  cpf: string;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddressId?: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  couponId?: string;
  discountAmount?: number;
  notes?: string;
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
    console.log("[process-card-payment] Processing card payment for company:", body.companyId);

    // Validate required fields
    if (!body.companyId || !body.token || !body.items?.length || !body.customerName || !body.customerEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Dados obrigatórios não fornecidos",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
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
      console.error("[process-card-payment] Payment settings not found:", settingsError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Pagamento online não configurado para esta loja",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get company info
    const { data: company, error: companyError } = await supabaseClient
      .from("companies")
      .select("name, slug")
      .eq("id", body.companyId)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Empresa não encontrada",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Create payment in Mercado Pago using token
    const paymentData = {
      transaction_amount: Number(body.total.toFixed(2)),
      token: body.token,
      description: `Pedido - ${company.name}`,
      installments: body.installments || 1,
      payment_method_id: body.paymentMethodId || "visa",
      payer: {
        email: body.customerEmail,
        first_name: body.customerName.split(" ")[0],
        last_name: body.customerName.split(" ").slice(1).join(" ") || body.customerName.split(" ")[0],
        identification: {
          type: "CPF",
          number: body.cpf.replace(/\D/g, ""),
        },
      },
      statement_descriptor: company.name.slice(0, 22),
    };

    console.log("[process-card-payment] Creating payment with MP token...");

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${paymentSettings.mercadopago_access_token}`,
        "X-Idempotency-Key": `${body.companyId}-${Date.now()}`,
      },
      body: JSON.stringify(paymentData),
    });

    const mpResult = await mpResponse.json();
    console.log(
      "[process-card-payment] MP response status:",
      mpResult.status,
      "id:",
      mpResult.id,
      "detail:",
      mpResult.status_detail,
      "message:",
      mpResult.message
    );

    const statusDetail = String(mpResult.status_detail || "");

    if (!mpResponse.ok || mpResult.status === "rejected") {
      console.error("[process-card-payment] Mercado Pago error:", mpResult);

      const errorMap: Record<string, string> = {
        cc_rejected_bad_filled_card_number: "Número do cartão inválido",
        cc_rejected_bad_filled_date: "Data de validade inválida",
        cc_rejected_bad_filled_other: "Dados do cartão inválidos",
        cc_rejected_bad_filled_security_code: "Código de segurança (CVV) inválido",
        cc_rejected_blacklist: "Cartão não aceito por motivos de segurança",
        cc_rejected_call_for_authorize: "Autorize o pagamento junto ao seu banco",
        cc_rejected_card_disabled: "Cartão desabilitado. Contate seu banco.",
        cc_rejected_duplicated_payment: "Pagamento duplicado. Aguarde alguns minutos.",
        cc_rejected_high_risk: "Pagamento recusado por motivos de segurança",
        cc_rejected_insufficient_amount: "Saldo insuficiente no cartão",
        cc_rejected_invalid_installments: "Número de parcelas inválido",
        cc_rejected_max_attempts: "Limite de tentativas excedido. Aguarde alguns minutos.",
        cc_rejected_other_reason: "Cartão recusado. Tente outro cartão.",
        pending_contingency: "Pagamento pendente de análise",
        pending_review_manual: "Pagamento em análise manual",
      };

      const errorMessage =
        errorMap[statusDetail] ||
        "Pagamento recusado pelo banco. Tente outro cartão ou fale com seu banco.";

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          mpStatus: mpResult.status,
          mpStatusDetail: mpResult.status_detail,
          mpMessage: mpResult.message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (mpResult.status !== "approved") {
      let pendingMessage = "Pagamento pendente";
      if (mpResult.status === "in_process") {
        pendingMessage = "Pagamento em processamento. Aguarde a confirmação.";
      } else if (mpResult.status === "pending") {
        pendingMessage = "Pagamento pendente de análise pelo banco.";
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: pendingMessage,
          mpStatus: mpResult.status,
          mpStatusDetail: mpResult.status_detail,
          mpMessage: mpResult.message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Payment approved - create order
    console.log("[process-card-payment] Payment approved, creating order...");

    // Lookup or create customer
    let customerId: string | null = null;
    const { data: existingCustomer } = await supabaseClient
      .from("customers")
      .select("id")
      .eq("email", body.customerEmail.toLowerCase())
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer } = await supabaseClient
        .from("customers")
        .insert({
          name: body.customerName,
          email: body.customerEmail.toLowerCase(),
          phone: body.customerPhone || "",
        })
        .select("id")
        .single();
      
      if (newCustomer) {
        customerId = newCustomer.id;
      }
    }

    // Get customer's user_id if available
    let customerUserId: string | null = null;
    if (customerId) {
      const { data: customerData } = await supabaseClient
        .from("customers")
        .select("user_id")
        .eq("id", customerId)
        .single();
      customerUserId = customerData?.user_id || null;
    }

    // Create order
    const newOrderId = crypto.randomUUID();
    const { error: orderError } = await supabaseClient
      .from("orders")
      .insert({
        id: newOrderId,
        company_id: body.companyId,
        customer_id: customerUserId,
        customer_name: body.customerName,
        customer_phone: body.customerPhone || "",
        customer_email: body.customerEmail.toLowerCase(),
        delivery_address_id: body.deliveryAddressId || null,
        payment_method: "online",
        payment_status: "paid",
        subtotal: body.subtotal,
        delivery_fee: body.deliveryFee,
        total: body.total,
        discount_amount: body.discountAmount || 0,
        coupon_id: body.couponId || null,
        notes: body.notes || null,
        needs_change: false,
        change_for: null,
        stripe_payment_intent_id: `mp_${mpResult.id}`,
      });

    if (orderError) {
      console.error("[process-card-payment] Error creating order:", orderError);
      throw new Error("Erro ao criar pedido");
    }

    // Create order items
    const orderItems = body.items.map((item) => ({
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
      console.error("[process-card-payment] Error creating order items:", itemsError);
      // Cleanup order
      await supabaseClient.from("orders").delete().eq("id", newOrderId);
      throw new Error("Erro ao criar itens do pedido");
    }

    // Increment coupon usage if applicable
    if (body.couponId) {
      await supabaseClient.rpc("increment_coupon_usage", { coupon_id: body.couponId });
    }

    console.log("[process-card-payment] Order created successfully:", newOrderId);

    return new Response(
      JSON.stringify({
        success: true,
        orderId: newOrderId,
        paymentId: mpResult.id,
        status: mpResult.status,
        companyName: company.name,
        companySlug: company.slug,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[process-card-payment] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
