import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });
}

const reviewSchema = z.object({
  orderId: z.string().uuid(),
  companyId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  foodRating: z.number().int().min(1).max(5).nullable().optional(),
  deliveryRating: z.number().int().min(1).max(5).nullable().optional(),
  comment: z
    .string()
    .trim()
    .max(500, { message: 'Comentário deve ter no máximo 500 caracteres' })
    .nullable()
    .optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const body = await req.json().catch(() => null);

    const parseResult = reviewSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Dados inválidos', issues: parseResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { orderId, companyId, rating, foodRating, deliveryRating, comment } = parseResult.data;

    // Garante que o pedido existe e pertence à empresa informada
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, company_id, status')
      .eq('id', orderId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (orderError) {
      console.error('Erro ao buscar pedido para avaliação:', orderError);
      throw orderError;
    }

    if (!order) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Pedido não encontrado para esta empresa.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (order.status !== 'delivered') {
      return new Response(
        JSON.stringify({ ok: false, message: 'Só é possível avaliar pedidos entregues.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verifica se já existe avaliação para este pedido
    const { data: existingReview, error: existingError } = await supabase
      .from('order_reviews')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existingError) {
      console.error('Erro ao verificar avaliação existente:', existingError);
      throw existingError;
    }

    if (existingReview) {
      return new Response(
        JSON.stringify({ ok: false, code: 'ALREADY_REVIEWED', message: 'Você já avaliou este pedido.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error: insertError } = await supabase.from('order_reviews').insert({
      order_id: orderId,
      company_id: companyId,
      rating,
      food_rating: foodRating ?? null,
      delivery_rating: deliveryRating ?? null,
      comment: comment && comment.length > 0 ? comment : null,
    });

    if (insertError) {
      console.error('Erro ao inserir avaliação:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Erro na função submit-order-review:', error);
    return new Response(
      JSON.stringify({ ok: false, message: 'Erro interno ao enviar avaliação.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
