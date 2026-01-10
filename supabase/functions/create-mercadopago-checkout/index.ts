import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface CheckoutRequest {
  orderId: string;
  items: OrderItem[];
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  total: number;
  companyName: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) {
      console.error('MERCADO_PAGO_ACCESS_TOKEN not configured');
      throw new Error('Mercado Pago não configurado');
    }

    const { orderId, items, customerName, customerEmail, customerPhone, total, companyName } = await req.json() as CheckoutRequest;

    console.log('Creating Mercado Pago checkout for order:', orderId);
    console.log('Items:', items);
    console.log('Total:', total);

    // Build preference items for Mercado Pago
    const preferenceItems = items.map((item) => ({
      title: item.product_name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      currency_id: 'BRL',
    }));

    // Get the base URL for redirects
    const origin = req.headers.get('origin') || 'https://cardapio.on';

    // Create preference in Mercado Pago
    const preferenceResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: preferenceItems,
        payer: {
          name: customerName,
          email: customerEmail || undefined,
          phone: {
            number: customerPhone,
          },
        },
        external_reference: orderId,
        statement_descriptor: companyName.substring(0, 22), // Max 22 chars
        back_urls: {
          success: `${origin}/pedido/${orderId}?payment=success`,
          failure: `${origin}/pedido/${orderId}?payment=failure`,
          pending: `${origin}/pedido/${orderId}?payment=pending`,
        },
        auto_return: 'approved',
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      }),
    });

    if (!preferenceResponse.ok) {
      const errorData = await preferenceResponse.text();
      console.error('Mercado Pago API error:', errorData);
      throw new Error(`Erro ao criar checkout: ${errorData}`);
    }

    const preference = await preferenceResponse.json();
    console.log('Preference created:', preference.id);

    return new Response(
      JSON.stringify({
        preferenceId: preference.id,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating Mercado Pago checkout:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
