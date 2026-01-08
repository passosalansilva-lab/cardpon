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
    const { companyId } = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'companyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log(`[get-mercadopago-public-key] Fetching for company ${companyId}`);

    // Fetch payment settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from('company_payment_settings')
      .select('mercadopago_public_key, mercadopago_enabled, mercadopago_verified')
      .eq('company_id', companyId)
      .maybeSingle();

    if (settingsError) {
      console.error('[get-mercadopago-public-key] Error:', settingsError);
      throw settingsError;
    }

    if (!paymentSettings?.mercadopago_enabled || !paymentSettings.mercadopago_verified) {
      return new Response(
        JSON.stringify({ error: 'Mercado Pago não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!paymentSettings.mercadopago_public_key) {
      console.error('[get-mercadopago-public-key] Public key not configured');
      return new Response(
        JSON.stringify({ error: 'Public Key do Mercado Pago não configurada. Atualize suas credenciais.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-mercadopago-public-key] Public key found: ${paymentSettings.mercadopago_public_key.slice(0, 20)}...`);

    return new Response(
      JSON.stringify({ publicKey: paymentSettings.mercadopago_public_key }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[get-mercadopago-public-key] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
