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
    const { addressId, customerId } = await req.json();
    
    if (!addressId || !customerId) {
      return new Response(
        JSON.stringify({ error: 'addressId e customerId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First verify the address belongs to the customer
    const { data: address, error: fetchError } = await supabase
      .from('customer_addresses')
      .select('id, customer_id')
      .eq('id', addressId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (fetchError) {
      console.error('[DELETE-ADDRESS] Error fetching address:', fetchError);
      throw fetchError;
    }

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Endereço não encontrado ou não pertence a este cliente' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete the address
    const { error: deleteError } = await supabase
      .from('customer_addresses')
      .delete()
      .eq('id', addressId)
      .eq('customer_id', customerId);

    if (deleteError) {
      console.error('[DELETE-ADDRESS] Error deleting address:', deleteError);
      throw deleteError;
    }

    console.log(`[DELETE-ADDRESS] Successfully deleted address ${addressId} for customer ${customerId}`);
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DELETE-ADDRESS] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
