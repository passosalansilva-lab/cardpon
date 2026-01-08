import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailOrPhone, companyId } = await req.json();

    if (!emailOrPhone || typeof emailOrPhone !== 'string') {
      return new Response(
        JSON.stringify({ error: 'emailOrPhone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const value = emailOrPhone.trim().toLowerCase();
    if (!value) {
      return new Response(
        JSON.stringify({ error: 'Valor de busca inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const isEmail = value.includes('@');

    let query = supabase
      .from('orders')
      .select(
        `id, status, total, delivery_fee, payment_method, created_at, cancellation_reason,
         customer_name, customer_email, customer_phone,
         order_items (id, product_name, quantity, unit_price, total_price, notes),
         customer_addresses:delivery_address_id (street, number, neighborhood, city, state, complement)`,
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (isEmail) {
      query = query.eq('customer_email', value);
    } else {
      const cleanPhone = value.replace(/\D/g, '');
      query = query.ilike('customer_phone', `%${cleanPhone}%`);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('[CUSTOMER-ORDERS-SEARCH] Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar pedidos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ orders: orders || [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[CUSTOMER-ORDERS-SEARCH] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
