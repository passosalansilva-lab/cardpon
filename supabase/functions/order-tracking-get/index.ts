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
    const { orderId } = await req.json();

    if (!orderId || typeof orderId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'orderId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        `*,
         company:companies(name, phone, logo_url, primary_color, address)`,
      )
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.error('[ORDER-TRACKING-GET] Error loading order:', orderError);
      return new Response(
        JSON.stringify({ error: 'Erro ao carregar pedido' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*, requires_preparation')
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('[ORDER-TRACKING-GET] Error loading items:', itemsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao carregar itens do pedido' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: review, error: reviewError } = await supabase
      .from('order_reviews')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (reviewError) {
      console.error('[ORDER-TRACKING-GET] Error loading review:', reviewError);
    }

    // Check if reviews are enabled for this company
    const { data: reviewSettings } = await supabase
      .from('company_review_settings')
      .select('reviews_enabled')
      .eq('company_id', order.company_id)
      .maybeSingle();

    // Default to true if no settings exist
    const reviewsEnabled = reviewSettings?.reviews_enabled ?? true;

    const responseBody = {
      order: {
        ...order,
        company: order.company,
        items: items || [],
        hasReview: !!review,
        reviewsEnabled,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
      },
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ORDER-TRACKING-GET] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
