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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Admin client for writes
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticated client for identity
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !userData?.user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;

    const { offerId, orderId } = await req.json();

    if (!offerId || !orderId) {
      return new Response(
        JSON.stringify({ error: 'offerId and orderId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${userId} accepting offer ${offerId} for order ${orderId}`);

    // Get the driver record for this user
    const { data: driver, error: driverError } = await supabase
      .from('delivery_drivers')
      .select('id, driver_name, company_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (driverError) {
      console.error('Error fetching driver:', driverError);
      throw driverError;
    }

    if (!driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the offer exists and is for this driver
    const { data: offer, error: offerError } = await supabase
      .from('order_offers')
      .select('id, order_id, driver_id, status')
      .eq('id', offerId)
      .eq('driver_id', driver.id)
      .maybeSingle();

    if (offerError) {
      console.error('Error fetching offer:', offerError);
      throw offerError;
    }

    if (!offer) {
      return new Response(
        JSON.stringify({ error: 'Offer not found or not for this driver' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (offer.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          error: 'Offer no longer available', 
          status: offer.status,
          message: offer.status === 'accepted' 
            ? 'Este pedido já foi aceito por outro entregador' 
            : 'Esta oferta não está mais disponível'
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if order is still awaiting driver
    const { data: order, error: orderCheckError } = await supabase
      .from('orders')
      .select('status, delivery_driver_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderCheckError) {
      console.error('Error checking order:', orderCheckError);
      throw orderCheckError;
    }

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if someone else already took this order
    if (order.delivery_driver_id && order.delivery_driver_id !== driver.id) {
      // Cancel this driver's offer
      await supabase
        .from('order_offers')
        .update({ status: 'cancelled', responded_at: new Date().toISOString() })
        .eq('id', offerId);

      return new Response(
        JSON.stringify({ 
          error: 'Order already taken', 
          message: 'Este pedido já foi aceito por outro entregador'
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Accept this offer - use transaction-like approach
    // 1. Update the offer to accepted
    const { error: acceptError } = await supabase
      .from('order_offers')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', offerId)
      .eq('status', 'pending'); // Only if still pending

    if (acceptError) {
      console.error('Error accepting offer:', acceptError);
      throw acceptError;
    }

    // 2. Cancel all other pending offers for this order
    const { error: cancelError } = await supabase
      .from('order_offers')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .neq('id', offerId);

    if (cancelError) {
      console.error('Error cancelling other offers:', cancelError);
      // Don't throw, continue with the flow
    }

    // 3. Assign the driver to the order
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ 
        delivery_driver_id: driver.id,
        status: 'out_for_delivery'
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      console.error('Error updating order:', orderUpdateError);
      throw orderUpdateError;
    }

    // 4. Update driver status
    const { error: driverUpdateError } = await supabase
      .from('delivery_drivers')
      .update({ 
        driver_status: 'in_delivery',
        is_available: false
      })
      .eq('id', driver.id);

    if (driverUpdateError) {
      console.error('Error updating driver status:', driverUpdateError);
      // Don't throw, order was assigned
    }

    // 5. Notify company owner about the acceptance
    const { data: company } = await supabase
      .from('companies')
      .select('owner_id')
      .eq('id', driver.company_id)
      .single();

    if (company?.owner_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: company.owner_id,
          title: 'Entrega aceita!',
          message: `${driver.driver_name || 'Entregador'} aceitou o pedido #${orderId.slice(0, 8)}`,
          type: 'success',
          data: { type: 'order_accepted', order_id: orderId, driver_id: driver.id }
        });
    }

    console.log(`Order ${orderId} accepted by driver ${driver.id} (${driver.driver_name})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pedido aceito com sucesso!',
        orderId,
        driverName: driver.driver_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in accept-order-offer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
