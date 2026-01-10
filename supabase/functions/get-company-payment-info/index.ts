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

    console.log(`[get-company-payment-info] Fetching payment info for company ${companyId}`);

    // Fetch company payment info (phone, pix_key, pix_key_type, show_pix_key_on_menu)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('phone, pix_key, pix_key_type, show_pix_key_on_menu')
      .eq('id', companyId)
      .eq('status', 'approved')
      .maybeSingle();

    if (companyError) {
      console.error('[get-company-payment-info] Error fetching company:', companyError);
      throw companyError;
    }

    if (!company) {
      return new Response(
        JSON.stringify({ error: 'Company not found or not approved' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if online payment is enabled
    const { data: paymentSettings } = await supabase
      .from('company_payment_settings')
      .select('mercadopago_enabled, mercadopago_verified, picpay_enabled, picpay_verified, pix_enabled, card_enabled, active_payment_gateway')
      .eq('company_id', companyId)
      .maybeSingle();

    // Determinar qual gateway está ativo e verificado
    const activeGateway = paymentSettings?.active_payment_gateway || 'mercadopago';
    
    let onlinePaymentEnabled = false;
    if (activeGateway === 'mercadopago') {
      onlinePaymentEnabled = paymentSettings?.mercadopago_enabled && paymentSettings?.mercadopago_verified;
    } else if (activeGateway === 'picpay') {
      onlinePaymentEnabled = paymentSettings?.picpay_enabled && paymentSettings?.picpay_verified;
    }

    const pixEnabled = onlinePaymentEnabled && (paymentSettings?.pix_enabled !== false);
    const cardEnabled = onlinePaymentEnabled && (paymentSettings?.card_enabled !== false);
    const showPixKeyOnMenu = !!(company as any).show_pix_key_on_menu;

    console.log(`[get-company-payment-info] Found company payment info: phone=${!!company.phone}, pixKey=${!!company.pix_key}, showPixKeyOnMenu=${showPixKeyOnMenu}, activeGateway=${activeGateway}, onlinePayment=${onlinePaymentEnabled}, pix=${pixEnabled}, card=${cardEnabled}`);

    return new Response(
      JSON.stringify({
        phone: company.phone,
        pixKey: company.pix_key,
        pixKeyType: company.pix_key_type,
        onlinePaymentEnabled,
        pixEnabled,
        cardEnabled,
        activeGateway,
        showPixKeyOnMenu,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[get-company-payment-info] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});