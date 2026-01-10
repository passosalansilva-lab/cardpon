import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * This function is called when a driver finishes a delivery.
 * It checks if there are queued orders for the driver and automatically
 * moves the next one to 'awaiting_driver' status so the driver can accept it.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { driverId, companyId } = await req.json();

    if (!driverId) {
      return new Response(
        JSON.stringify({ error: 'driverId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-driver-queue] Processing queue for driver ${driverId}`);

    // Check if driver has any queued orders
    const { data: queuedOrders, error: queueError } = await supabase
      .from('orders')
      .select('id, customer_name, queue_position, company_id')
      .eq('delivery_driver_id', driverId)
      .eq('status', 'queued')
      .not('queue_position', 'is', null)
      .order('queue_position', { ascending: true })
      .limit(1);

    if (queueError) {
      console.error('[process-driver-queue] Error fetching queued orders:', queueError);
      throw queueError;
    }

    if (!queuedOrders || queuedOrders.length === 0) {
      console.log(`[process-driver-queue] No queued orders for driver ${driverId}`);
      
      // No queued orders - make driver available
      await supabase
        .from('delivery_drivers')
        .update({
          driver_status: 'available',
          is_available: true,
        })
        .eq('id', driverId);

      return new Response(
        JSON.stringify({ success: true, nextOrder: null, message: 'No queued orders' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nextOrder = queuedOrders[0];
    console.log(`[process-driver-queue] Next order in queue: ${nextOrder.id} (position ${nextOrder.queue_position})`);

    // Move the next queued order to awaiting_driver
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'awaiting_driver',
        queue_position: null,
      })
      .eq('id', nextOrder.id);

    if (updateError) {
      console.error('[process-driver-queue] Error updating order:', updateError);
      throw updateError;
    }

    // Update driver status to pending_acceptance
    await supabase
      .from('delivery_drivers')
      .update({
        driver_status: 'pending_acceptance',
        is_available: false,
      })
      .eq('id', driverId);

    // Shift queue positions for remaining queued orders
    const { data: remainingOrders } = await supabase
      .from('orders')
      .select('id, queue_position')
      .eq('delivery_driver_id', driverId)
      .eq('status', 'queued')
      .not('queue_position', 'is', null)
      .order('queue_position', { ascending: true });

    if (remainingOrders && remainingOrders.length > 0) {
      for (let i = 0; i < remainingOrders.length; i++) {
        await supabase
          .from('orders')
          .update({ queue_position: i + 1 })
          .eq('id', remainingOrders[i].id);
      }
      console.log(`[process-driver-queue] Reordered ${remainingOrders.length} remaining queued orders`);
    }

    // Get driver info for notification
    const { data: driver } = await supabase
      .from('delivery_drivers')
      .select('user_id, driver_name, company_id')
      .eq('id', driverId)
      .single();

    // Send notification to driver about next order
    if (driver?.user_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: driver.user_id,
          title: 'Próxima entrega na fila!',
          message: `Você tem uma nova entrega para ${nextOrder.customer_name}. Aceite para começar!`,
          type: 'info',
          data: { type: 'queue_next', order_id: nextOrder.id, company_id: driver.company_id }
        });

      // Send push notification
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: driver.user_id,
            companyId: driver.company_id,
            userType: 'driver',
            payload: {
              title: '📦 Próxima entrega!',
              body: `Nova entrega para ${nextOrder.customer_name} está pronta.`,
              tag: `order-${nextOrder.id}`,
              data: { type: 'queue_next', orderId: nextOrder.id, companyId: driver.company_id, url: '/driver' }
            }
          }
        });
        console.log(`[process-driver-queue] Push notification sent to driver ${driverId}`);
      } catch (pushError) {
        console.error('[process-driver-queue] Error sending push:', pushError);
      }
    }

    console.log(`[process-driver-queue] Order ${nextOrder.id} moved from queue to awaiting_driver`);

    return new Response(
      JSON.stringify({
        success: true,
        nextOrder: {
          id: nextOrder.id,
          customerName: nextOrder.customer_name,
        },
        remainingInQueue: remainingOrders?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[process-driver-queue] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
