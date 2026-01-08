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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Admin client (bypasses RLS) for writes
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticated client (uses caller JWT) for identity
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
      console.error('Auth getUser error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;

    const { orderId, driverId, companyId } = await req.json();

    if (!orderId || !driverId || !companyId) {
      return new Response(
        JSON.stringify({ error: 'orderId, driverId, and companyId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization: only the company owner (or super admin) can assign/reassign drivers
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('owner_id')
      .eq('id', companyId)
      .maybeSingle();

    if (companyError) {
      console.error('Error loading company:', companyError);
      throw companyError;
    }
    if (!company) {
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let isAllowed = company.owner_id === userId;
    if (!isAllowed) {
      const { data: adminRole, error: roleError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (roleError) {
        console.error('Error checking role:', roleError);
        throw roleError;
      }

      isAllowed = !!adminRole;
    }

    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate driver belongs to company and check if it's active and available
    const { data: driverRow, error: driverRowError } = await supabase
      .from('delivery_drivers')
      .select('id, is_active, is_available, driver_status')
      .eq('id', driverId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (driverRowError) {
      console.error('Error validating driver:', driverRowError);
      throw driverRowError;
    }

    if (!driverRow) {
      return new Response(
        JSON.stringify({
          error: 'Entregador não encontrado para esta empresa.',
          code: 'DRIVER_NOT_FOUND',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (driverRow.is_active === false) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'DRIVER_INACTIVE',
          message: 'Este entregador está inativo. Ative-o para poder receber pedidos.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if driver is currently busy (in_delivery)
    const driverIsBusy = driverRow.driver_status === 'in_delivery' || !driverRow.is_available;

    console.log(`Assigning order ${orderId} to driver ${driverId} (company ${companyId}) by user ${userId}. Driver busy: ${driverIsBusy}`);

    // Load existing order to check previous driver and current status
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select('delivery_driver_id, status')
      .eq('id', orderId)
      .eq('company_id', companyId)
      .maybeSingle();
 
    if (existingOrderError) {
      console.error('Error loading existing order before assignment:', existingOrderError);
      throw existingOrderError;
    }
 
    if (!existingOrder) {
      return new Response(
        JSON.stringify({
          error: 'Order not found',
          code: 'ORDER_NOT_FOUND',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
 
    const previousDriverId = existingOrder.delivery_driver_id as string | null;
    const currentStatus = existingOrder.status as string;
 
    // Only allow assigning/reassigning when the order is ready or awaiting_driver or queued
    if (!['ready', 'awaiting_driver', 'queued'].includes(currentStatus)) {
      console.warn(
        `Attempt to assign driver for order ${orderId} with invalid status: ${currentStatus}`,
      );
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_STATUS',
          message:
            'Você só pode atribuir entregador quando o pedido estiver PRONTO, AGUARDANDO ENTREGADOR ou NA FILA.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
 
    // Cancel all pending offers for this order so only the explicit assignment remains
    const { error: cancelOffersError } = await supabase
      .from('order_offers')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('status', 'pending');
 
    if (cancelOffersError) {
      console.error('Error cancelling pending offers for order:', cancelOffersError);
      throw cancelOffersError;
    }
 
    // Determine status based on driver availability
    let newOrderStatus = 'awaiting_driver';
    let queuePosition: number | null = null;
    let isQueued = false;

    if (driverIsBusy) {
      // Driver is busy - queue this order
      newOrderStatus = 'queued';
      isQueued = true;

      // Get next queue position for this driver
      const { data: queuedOrders, error: queueError } = await supabase
        .from('orders')
        .select('queue_position')
        .eq('delivery_driver_id', driverId)
        .eq('status', 'queued')
        .not('queue_position', 'is', null)
        .order('queue_position', { ascending: false })
        .limit(1);

      if (queueError) {
        console.error('Error getting queue position:', queueError);
      }

      const maxPosition = queuedOrders?.[0]?.queue_position ?? 0;
      queuePosition = maxPosition + 1;

      console.log(`Driver ${driverId} is busy. Queuing order ${orderId} at position ${queuePosition}`);
    }

    // Update order with driver assignment
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        delivery_driver_id: driverId,
        status: newOrderStatus,
        queue_position: queuePosition,
      })
      .eq('id', orderId)
      .eq('company_id', companyId);

    if (orderError) {
      console.error('Error updating order:', orderError);
      throw orderError;
    }

    // If there was a previous driver assigned, free them up (only if not the same driver)
    if (previousDriverId && previousDriverId !== driverId) {
      // Check if previous driver has other queued/active orders
      const { data: otherOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('delivery_driver_id', previousDriverId)
        .in('status', ['out_for_delivery', 'awaiting_driver', 'queued'])
        .neq('id', orderId)
        .limit(1);

      if (!otherOrders || otherOrders.length === 0) {
        const { error: previousDriverError } = await supabase
          .from('delivery_drivers')
          .update({
            driver_status: 'available',
            is_available: true,
          })
          .eq('id', previousDriverId);

        if (previousDriverError) {
          console.error('Error freeing previous driver:', previousDriverError);
        }
      }
    }

    // Only update driver status if they are not busy (not in delivery)
    if (!driverIsBusy) {
      const { error: driverError } = await supabase
        .from('delivery_drivers')
        .update({
          driver_status: 'pending_acceptance',
          is_available: false,
        })
        .eq('id', driverId);

      if (driverError) {
        console.error('Error updating driver:', driverError);
        throw driverError;
      }
    }

    // Get driver info for response and optional notification
    const { data: driver } = await supabase
      .from('delivery_drivers')
      .select('user_id, driver_name')
      .eq('id', driverId)
      .single();

    // Send notifications only if driver has logged in (has user_id) and order is not queued
    // If order is queued, driver will get notification when the previous delivery finishes
    if (driver?.user_id && !isQueued) {
      console.log(`Sending notification to driver ${driverId} (user_id: ${driver.user_id})`);
      
      // Create notification for driver
      await supabase
        .from('notifications')
        .insert({
          user_id: driver.user_id,
          title: 'Nova entrega disponível!',
          message: `Você tem uma nova entrega aguardando aceite. Pedido #${orderId.slice(0, 8)}`,
          type: 'info',
          data: { type: 'new_delivery', order_id: orderId, company_id: companyId }
        });

      // Try to send push notification - include companyId for fallback matching
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: driver.user_id,
            companyId: companyId,
            userType: 'driver',
            payload: {
              title: 'Nova entrega disponível!',
              body: `Aceite a entrega para iniciar.`,
              tag: `order-${orderId}`,
              data: { type: 'new_delivery', orderId, companyId, url: '/driver' }
            }
          }
        });
        console.log(`Push notification sent to driver ${driverId} (user_id: ${driver.user_id})`);
      } catch (pushError) {
        console.error('Error sending push notification:', pushError);
        // Don't throw, push is optional
      }
    } else if (isQueued) {
      console.log(`Order ${orderId} queued for driver ${driverId} at position ${queuePosition} - notification will be sent when current delivery finishes`);
    } else {
      console.log(`Driver ${driverId} assigned but has no user_id yet - no notification sent`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: isQueued ? `Pedido adicionado à fila (posição ${queuePosition})` : 'Driver assigned successfully',
        driverName: driver?.driver_name,
        queued: isQueued,
        queuePosition: queuePosition,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in assign-driver:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
