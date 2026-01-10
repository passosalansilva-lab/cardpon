import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paymentId, pendingId, companyId } = await req.json();

    console.log('[cancel-mercadopago-payment] Received request:', { paymentId, pendingId, companyId });

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'companyId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get company payment settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from('company_payment_settings')
      .select('mercadopago_access_token')
      .eq('company_id', companyId)
      .single();

    if (settingsError || !paymentSettings?.mercadopago_access_token) {
      console.error('[cancel-mercadopago-payment] No access token found:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = paymentSettings.mercadopago_access_token;
    let cancelled = false;

    // Try to cancel the payment in Mercado Pago
    if (paymentId) {
      try {
        console.log('[cancel-mercadopago-payment] Cancelling payment in MP:', paymentId);
        
        const cancelResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'cancelled' }),
          }
        );

        const cancelData = await cancelResponse.json();
        console.log('[cancel-mercadopago-payment] MP cancel response:', cancelData);

        if (cancelResponse.ok || cancelData.status === 'cancelled') {
          cancelled = true;
        } else {
          // If payment is already approved or in a non-cancellable state, still mark locally as cancelled
          console.log('[cancel-mercadopago-payment] Payment could not be cancelled in MP, marking locally');
        }
      } catch (mpError) {
        console.error('[cancel-mercadopago-payment] MP API error:', mpError);
        // Continue to mark locally as cancelled
      }
    }

    // Update pending_order_payments status to cancelled
    if (pendingId) {
      const { error: updateError } = await supabase
        .from('pending_order_payments')
        .update({ status: 'cancelled' })
        .eq('id', pendingId);

      if (updateError) {
        console.error('[cancel-mercadopago-payment] Error updating pending payment:', updateError);
      } else {
        console.log('[cancel-mercadopago-payment] Pending payment marked as cancelled');
        cancelled = true;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cancelled,
        message: cancelled ? 'Pagamento cancelado com sucesso' : 'Pagamento marcado como cancelado localmente'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[cancel-mercadopago-payment] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao cancelar pagamento' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
