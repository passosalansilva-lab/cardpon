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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, clientSecret, companyId } = await req.json();

    if (!clientId || !companyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Client ID e Company ID são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to get existing secret if not provided
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    let secretToUse = clientSecret;
    if (!secretToUse) {
      // Try to get existing secret
      const { data: existingSettings } = await supabaseAdmin
        .from('company_payment_settings')
        .select('picpay_client_secret')
        .eq('company_id', companyId)
        .single();

      if (existingSettings?.picpay_client_secret) {
        secretToUse = existingSettings.picpay_client_secret;
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Client Secret é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate credentials with PicPay API
    // PicPay uses OAuth2 to get an access token
    console.log('[validate-picpay-credentials] Validating credentials with PicPay API...');

    try {
      const tokenResponse = await fetch('https://api.picpay.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: secretToUse,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || tokenData.error) {
        console.error('[validate-picpay-credentials] PicPay validation failed:', tokenData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: tokenData.error_description || 'Credenciais inválidas. Verifique o Client ID e Client Secret.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[validate-picpay-credentials] Credentials validated successfully');

      // Save the validated credentials
      const { error: upsertError } = await supabaseAdmin
        .from('company_payment_settings')
        .upsert({
          company_id: companyId,
          picpay_client_id: clientId,
          picpay_client_secret: secretToUse,
          picpay_enabled: true,
          picpay_verified: true,
          picpay_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'company_id'
        });

      if (upsertError) {
        console.error('[validate-picpay-credentials] Error saving settings:', upsertError);
        throw upsertError;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Credenciais validadas e salvas com sucesso' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (picpayError: any) {
      console.error('[validate-picpay-credentials] PicPay API error:', picpayError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao conectar com a API do PicPay. Tente novamente.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('[validate-picpay-credentials] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
