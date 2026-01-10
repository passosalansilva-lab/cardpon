import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!accessToken) {
      console.error('MERCADO_PAGO_ACCESS_TOKEN not configured');
      throw new Error('Mercado Pago não configurado');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the webhook payload
    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body));

    // Mercado Pago sends different types of notifications
    if (body.type === 'payment') {
      const paymentId = body.data?.id;
      
      if (!paymentId) {
        console.log('No payment ID in webhook');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Processing payment:', paymentId);

      // Get payment details from Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!paymentResponse.ok) {
        const errorText = await paymentResponse.text();
        console.error('Error fetching payment:', errorText);
        throw new Error(`Erro ao buscar pagamento: ${errorText}`);
      }

      const payment = await paymentResponse.json();
      console.log('Payment details:', JSON.stringify(payment));

      const orderId = payment.external_reference;
      const status = payment.status;

      if (!orderId) {
        console.log('No order ID (external_reference) in payment');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Map Mercado Pago status to our payment status
      let paymentStatus: 'pending' | 'paid' | 'failed' = 'pending';
      if (status === 'approved') {
        paymentStatus = 'paid';
      } else if (status === 'rejected' || status === 'cancelled' || status === 'refunded') {
        paymentStatus = 'failed';
      }

      console.log(`Updating order ${orderId} payment status to ${paymentStatus}`);

      // Update order payment status
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: paymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error updating order:', updateError);
        throw updateError;
      }

      console.log('Order updated successfully');
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    // Always return 200 to acknowledge receipt (Mercado Pago will retry otherwise)
    return new Response(JSON.stringify({ error: errorMessage, received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
