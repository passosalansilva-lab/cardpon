import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let companyId = url.searchParams.get('companyId');

    // Também aceita companyId via body JSON quando chamado pelo client
    if (!companyId) {
      try {
        const body = await req.json().catch(() => null) as { companyId?: string } | null;
        if (body?.companyId) {
          companyId = body.companyId;
        }
      } catch {
        // Ignora erro de parse; será tratado abaixo se continuar sem companyId
      }
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ ok: false, message: 'companyId é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = getServiceClient();

    // Busca ficha técnica + estoque
    const { data: recipeRows, error: recipeError } = await supabase
      .from('inventory_product_ingredients')
      .select(`
        product_id,
        quantity_per_unit,
        inventory_ingredients ( id, current_stock )
      `)
      .eq('company_id', companyId);

    if (recipeError) {
      console.error('Erro ao buscar ficha técnica:', recipeError);
      throw recipeError;
    }

    // Calcula se cada produto consegue produzir pelo menos 1 unidade
    const productAvailability = new Map<string, boolean>();

    for (const row of recipeRows ?? []) {
      const productId = row.product_id as string;
      const ingredient = (row as any).inventory_ingredients;
      const stock = Number(ingredient?.current_stock ?? 0);
      const perUnit = Number(row.quantity_per_unit ?? 0);

      // Se não há ficha técnica (ou quantidade 0), não controlamos estoque
      if (perUnit <= 0) continue;

      const canMakeOne = stock >= perUnit;
      const prev = productAvailability.get(productId);

      if (prev === undefined) {
        productAvailability.set(productId, canMakeOne);
      } else {
        productAvailability.set(productId, prev && canMakeOne);
      }
    }

    const unavailableProductIds = Array.from(productAvailability.entries())
      .filter(([_, available]) => !available)
      .map(([productId]) => productId);

    return new Response(
      JSON.stringify({ ok: true, unavailableProductIds }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Erro na função get-unavailable-products:', error);
    return new Response(
      JSON.stringify({ ok: false, message: 'Erro interno ao calcular disponibilidade.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
