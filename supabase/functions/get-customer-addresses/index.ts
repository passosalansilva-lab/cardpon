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
    const { customerId } = await req.json();
    
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Customer ID é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(customerId)) {
      return new Response(
        JSON.stringify({ error: 'ID de cliente inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get addresses for customer directly linked by customer_id
    const { data: addresses, error } = await supabase
      .from('customer_addresses')
      .select('id, street, number, complement, neighborhood, city, state, zip_code, reference, label, is_default, customer_id')
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET-CUSTOMER-ADDRESSES] Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar endereços' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let finalAddresses = addresses || [];

    // Fallback: if no addresses linked yet, tenta reaproveitar o último endereço usado em pedidos
    if (!finalAddresses.length) {
      console.log(`[GET-CUSTOMER-ADDRESSES] No direct addresses for ${customerId}, trying fallback from orders`);

      // Descobre email/telefone do cliente
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, email, phone')
        .eq('id', customerId)
        .maybeSingle();

      if (customerError) {
        console.error('[GET-CUSTOMER-ADDRESSES] Error loading customer for fallback:', customerError);
      } else if (customer?.email) {
        // Busca último pedido desse email que tenha endereço de entrega
        const { data: lastOrder, error: orderError } = await supabase
          .from('orders')
          .select('id, delivery_address_id')
          .ilike('customer_email', `${customer.email.toLowerCase()}%`)
          .not('delivery_address_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (orderError) {
          console.error('[GET-CUSTOMER-ADDRESSES] Error loading last order for fallback:', orderError);
        } else if (lastOrder?.delivery_address_id) {
          const addressId = lastOrder.delivery_address_id as string;

          const { data: fallbackAddress, error: fallbackError } = await supabase
            .from('customer_addresses')
            .select('id, street, number, complement, neighborhood, city, state, zip_code, reference, label, is_default, customer_id')
            .eq('id', addressId)
            .maybeSingle();

          if (fallbackError) {
            console.error('[GET-CUSTOMER-ADDRESSES] Error loading fallback address by id:', fallbackError);
          } else if (fallbackAddress) {
            finalAddresses = [fallbackAddress];

            // Opcional: vincula esse endereço ao customer_id para próximas visitas
            if (!fallbackAddress.customer_id) {
              const { error: linkError } = await supabase
                .from('customer_addresses')
                .update({ customer_id: customerId })
                .eq('id', addressId);

              if (linkError) {
                console.error('[GET-CUSTOMER-ADDRESSES] Error linking fallback address to customer:', linkError);
              } else {
                finalAddresses[0].customer_id = customerId;
              }
            }
          }
        }
      }
    }

    console.log(`[GET-CUSTOMER-ADDRESSES] Returning ${finalAddresses.length} addresses for customer ${customerId}`);
    
    return new Response(
      JSON.stringify({ addresses: finalAddresses }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GET-CUSTOMER-ADDRESSES] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
