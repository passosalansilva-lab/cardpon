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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for pending driver acceptance orders...');

    // Get orders that are awaiting_driver for more than 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: pendingOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        customer_name,
        created_at,
        updated_at,
        company_id,
        delivery_driver_id
      `)
      .eq('status', 'awaiting_driver')
      .lt('updated_at', thirtyMinutesAgo);

    if (ordersError) {
      console.error('Error fetching pending orders:', ordersError);
      throw ordersError;
    }

    console.log(`Found ${pendingOrders?.length || 0} orders awaiting driver for more than 30 minutes`);

    if (!pendingOrders || pendingOrders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending orders found', notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let notifiedCount = 0;

    for (const order of pendingOrders) {
      // Get company info
      const { data: company } = await supabase
        .from('companies')
        .select('owner_id, name')
        .eq('id', order.company_id)
        .single();

      // Get driver info
      const { data: driver } = await supabase
        .from('delivery_drivers')
        .select('user_id, driver_name')
        .eq('id', order.delivery_driver_id)
        .single();
      
      if (!company || !driver) continue;

      const minutesWaiting = Math.floor((Date.now() - new Date(order.updated_at).getTime()) / 60000);

      // Check if we already sent a notification for this order in the last 30 minutes
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('data->>order_id', order.id)
        .eq('data->>type', 'driver_acceptance_timeout')
        .gt('created_at', thirtyMinutesAgo)
        .limit(1);

      if (existingNotification && existingNotification.length > 0) {
        console.log(`Already notified for order ${order.id}, skipping`);
        continue;
      }

      console.log(`Order ${order.id} waiting for ${minutesWaiting} minutes`);

      // Notify the store owner
      await supabase
        .from('notifications')
        .insert({
          user_id: company.owner_id,
          title: 'Entregador demorando para aceitar',
          message: `O entregador ${driver.driver_name} está há ${minutesWaiting} minutos sem aceitar o pedido #${order.id.slice(0, 8)} do cliente ${order.customer_name}.`,
          type: 'warning',
          data: { 
            type: 'driver_acceptance_timeout', 
            order_id: order.id, 
            driver_name: driver.driver_name,
            minutes_waiting: minutesWaiting
          }
        });

      // Send push notification to store owner
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            userId: company.owner_id,
            userType: 'store_owner',
            payload: {
              title: 'Entregador demorando!',
              body: `${driver.driver_name} não aceitou o pedido #${order.id.slice(0, 8)} há ${minutesWaiting} min.`,
              tag: `timeout-${order.id}`,
              data: { type: 'driver_acceptance_timeout', orderId: order.id }
            }
          }),
        });
      } catch (pushError) {
        console.error('Error sending push to store:', pushError);
      }

      // Notify the driver with a reminder
      if (driver.user_id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: driver.user_id,
            title: 'Lembrete: Pedido aguardando aceite!',
            message: `Você tem um pedido aguardando há ${minutesWaiting} minutos. Aceite ou a loja pode reatribuir a entrega.`,
            type: 'warning',
            data: { 
              type: 'driver_acceptance_reminder', 
              order_id: order.id,
              minutes_waiting: minutesWaiting
            }
          });

        // Send push notification to driver
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              userId: driver.user_id,
              userType: 'driver',
              payload: {
                title: 'Lembrete: Aceite a entrega!',
                body: `Pedido #${order.id.slice(0, 8)} aguardando há ${minutesWaiting} minutos!`,
                tag: `reminder-${order.id}`,
                data: { type: 'driver_acceptance_reminder', orderId: order.id }
              }
            }),
          });
        } catch (pushError) {
          console.error('Error sending push to driver:', pushError);
        }
      }

      notifiedCount++;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notified ${notifiedCount} pending orders`,
        notified: notifiedCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in check-pending-driver-acceptance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
