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

interface ValidateItem {
  productId: string;
  quantity: number;
  isHalfHalf?: boolean;
  halfHalfFlavorProductIds?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();

    const { items } = (await req.json()) as { items: ValidateItem[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Itens do pedido não enviados.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Calcula "unidades efetivas" por produto, considerando meio a meio
    const productUnits = new Map<string, number>();

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) continue;

      if (item.isHalfHalf && item.halfHalfFlavorProductIds && item.halfHalfFlavorProductIds.length > 0) {
        const flavors = item.halfHalfFlavorProductIds;
        const factor = 1 / flavors.length;
        for (const flavorId of flavors) {
          const prev = productUnits.get(flavorId) ?? 0;
          productUnits.set(flavorId, prev + item.quantity * factor);
        }
      } else {
        const prev = productUnits.get(item.productId) ?? 0;
        productUnits.set(item.productId, prev + item.quantity);
      }
    }

    if (productUnits.size === 0) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Nenhuma unidade de produto para validar.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const productIds = Array.from(productUnits.keys());

    const { data: recipeRows, error: recipeError } = await supabase
      .from('inventory_product_ingredients')
      .select('product_id, ingredient_id, quantity_per_unit, inventory_ingredients ( id, name, current_stock )')
      .in('product_id', productIds);

    if (recipeError) {
      console.error('Erro ao buscar ficha técnica:', recipeError);
      throw recipeError;
    }

    const ingredientUsage = new Map<string, { name: string | null; required: number; stock: number }>();

    for (const row of recipeRows ?? []) {
      const units = productUnits.get(row.product_id as string) ?? 0;
      if (units <= 0) continue;

      const ingredientId = row.ingredient_id as string;
      const ingredientName = (row as any).inventory_ingredients?.name ?? null;
      const currentStock = Number((row as any).inventory_ingredients?.current_stock ?? 0);
      const qtyPerUnit = Number(row.quantity_per_unit ?? 0);
      const required = units * qtyPerUnit;

      const existing = ingredientUsage.get(ingredientId) ?? {
        name: ingredientName,
        required: 0,
        stock: currentStock,
      };

      existing.required += required;
      existing.stock = currentStock; // sempre o valor atual
      ingredientUsage.set(ingredientId, existing);
    }

    const insufficient = Array.from(ingredientUsage.entries())
      .filter(([_, v]) => v.required > v.stock)
      .map(([id, v]) => ({
        ingredientId: id,
        ingredientName: v.name,
        required: v.required,
        stock: v.stock,
        missing: v.required - v.stock,
      }));

    if (insufficient.length > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: 'Não há estoque suficiente para alguns itens do pedido.',
          insufficientIngredients: insufficient,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Erro na função validate-inventory:', error);
    return new Response(
      JSON.stringify({ ok: false, message: 'Erro interno ao validar estoque.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
