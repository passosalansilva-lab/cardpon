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

interface CheckoutRequest {
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
  // Mantido por compatibilidade; hoje aceitamos apenas online (PIX ou cartão de crédito)
  paymentMethod?: 'online' | 'credit' | 'pix';
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

    const body: CheckoutRequest = await req.json();
    console.log("Creating order checkout for company:", body.companyId);

    // Validate required fields
    if (!body.companyId || !body.items?.length || !body.customerName || !body.customerPhone) {
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
      console.error("Payment settings not found or not enabled:", settingsError);
      return new Response(
        JSON.stringify({ error: "Pagamento online não configurado para esta loja" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get company info for URLs
    const { data: company, error: companyError } = await supabaseClient
      .from("companies")
      .select("name, slug")
      .eq("id", body.companyId)
      .single();

    if (companyError || !company) {
      throw new Error("Empresa não encontrada");
    }

    // Store pending order data in a temporary way (we'll create order after payment)
    // We'll use the external_reference to store the order data
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

    // Create a pending order record to store the data
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
      console.error("Error creating pending order:", pendingError);
      // If table doesn't exist, we'll handle it differently
      // For now, encode data in external_reference
    }

    const pendingId = pendingOrder?.id || crypto.randomUUID();
    
    // Encode minimal data in external_reference (Mercado Pago has limits)
    const externalReference = JSON.stringify({
      type: "order_payment",
      pending_id: pendingId,
      company_id: body.companyId,
    });

    // Build items for Mercado Pago (para aparecer detalhado no checkout)
    const mpItems = body.items.map((item) => {
      const optionsLabel = Array.isArray((item as any).options)
        ? (item as any).options
            .map((o: any) => (o?.name ? String(o.name) : null))
            .filter(Boolean)
            .slice(0, 12)
            .join(', ')
        : '';

      const notesLabel = (item as any).notes ? String((item as any).notes) : '';

      const description = [
        optionsLabel ? `Opções: ${optionsLabel}` : null,
        notesLabel ? `Obs: ${notesLabel}` : null,
      ]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 256);

      return {
        title: item.product_name,
        description: description || undefined,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        currency_id: 'BRL',
      };
    });

    // Add delivery fee if present
    if (body.deliveryFee > 0) {
      mpItems.push({
        title: "Taxa de entrega",
        description: undefined,
        quantity: 1,
        unit_price: Number(body.deliveryFee),
        currency_id: "BRL",
      });
    }

    // Build redirect URLs
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".supabase.co") || "";
    const frontendUrl = req.headers.get("origin") || "https://cardapio.on";
    
    const successUrl = `${frontendUrl}/menu/${company.slug}?payment=success&pending_id=${pendingId}`;
    const failureUrl = `${frontendUrl}/menu/${company.slug}?payment=failure`;
    const pendingUrl = `${frontendUrl}/menu/${company.slug}?payment=pending&pending_id=${pendingId}`;

    // Restringir meios de pagamento: PIX + cartão de crédito
    // Obs.: o Mercado Pago não permite excluir "account_money" (saldo), então pode aparecer para alguns clientes.
    const excludedPaymentTypes = [
      { id: 'ticket' },
      { id: 'debit_card' },
      { id: 'atm' },
      { id: 'prepaid_card' },
    ];

    // Create Mercado Pago preference using store's token
    const preferenceData = {
      items: mpItems,
      payer: {
        name: body.customerName,
        email: body.customerEmail || undefined,
        phone: {
          number: body.customerPhone,
        },
      },
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      auto_return: 'approved',
      external_reference: externalReference,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/order-payment-webhook`,
      statement_descriptor: company.name.substring(0, 22),
      payment_methods: {
        excluded_payment_types: excludedPaymentTypes,
        installments: 1,
      },
    };

    console.log("Creating MP preference with store token");

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
      console.error("Mercado Pago error:", errorText);
      throw new Error("Erro ao criar checkout no Mercado Pago");
    }

    const preference = await mpResponse.json();
    console.log("Mercado Pago preference created:", preference.id);

    // Update pending order with preference ID
    if (pendingOrder?.id) {
      await supabaseClient
        .from("pending_order_payments")
        .update({ mercadopago_preference_id: preference.id })
        .eq("id", pendingOrder.id);
    }

    return new Response(
      JSON.stringify({
        checkoutUrl: preference.init_point,
        preferenceId: preference.id,
        pendingId: pendingId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in create-order-checkout:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
