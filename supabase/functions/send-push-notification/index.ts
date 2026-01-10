import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

interface SendPushRequest {
  orderId?: string;
  companyId?: string;
  userId?: string;
  userType?: 'customer' | 'driver' | 'store_owner';
  broadcast?: boolean; // For promotional notifications to all customers
  payload: PushPayload;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    // Import web-push dynamically
    const webPush = await import("npm:web-push@3.6.7");

    webPush.default.setVapidDetails(
      'mailto:contato@cardpon.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    await webPush.default.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    );

    console.log('Push notification sent successfully to:', subscription.endpoint);
    return true;
  } catch (error: unknown) {
    console.error('Error sending push notification:', error);
    
    // If subscription is no longer valid, we should delete it
    const err = error as { statusCode?: number };
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log('Subscription is no longer valid, should be deleted');
    }
    
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendPushRequest = await req.json();
    const { orderId, companyId, userId, userType, broadcast, payload } = body;

    console.log('Sending push notification:', { orderId, companyId, userId, userType, broadcast, payload });

    // Build query to find subscriptions
    let subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = [];
    let fetchError = null;

    // BROADCAST MODE: Promotional notifications to all customers of a company
    if (broadcast && companyId && userType === 'customer') {
      console.log('Broadcast mode: Sending promotional notification to all customers of company:', companyId);
      
      // Get all unique customer subscriptions for this company (deduplicated by endpoint)
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('company_id', companyId)
        .eq('user_type', 'customer');

      if (error) {
        console.error('Error fetching broadcast subscriptions:', error);
        fetchError = error;
      } else {
        // Deduplicate by endpoint to avoid sending multiple notifications to the same device
        const uniqueEndpoints = new Map<string, typeof data[0]>();
        for (const sub of data || []) {
          if (!uniqueEndpoints.has(sub.endpoint)) {
            uniqueEndpoints.set(sub.endpoint, sub);
          }
        }
        subscriptions = Array.from(uniqueEndpoints.values());
        console.log(`Found ${subscriptions.length} unique customer subscriptions for broadcast`);
      }
    } else if (orderId) {
      // Check if order is already delivered - skip notification if so
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Error fetching order status:', orderError);
      } else if (orderData?.status === 'delivered') {
        console.log('Order already delivered, skipping notification');
        return new Response(
          JSON.stringify({ success: true, sent: 0, message: 'Order already delivered, notification skipped' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Order-specific notifications MUST be scoped to the specific order.
      // For customers, we intentionally DO NOT fallback to company-wide subscriptions.
      const targetUserType = userType ?? 'customer';

      console.log('Looking for subscription by order_id:', { orderId, targetUserType });

      let query = supabase
        .from('push_subscriptions')
        .select('*')
        .eq('order_id', orderId);

      if (targetUserType) {
        query = query.eq('user_type', targetUserType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching by order_id:', error);
        fetchError = error;
      } else if (data && data.length > 0) {
        subscriptions = data;
        console.log(`Found ${data.length} subscriptions by order_id`);
      } else {
        console.log('No subscriptions found for this order_id');

        // For customer notifications, never fallback to company-wide subscriptions.
        if (targetUserType === 'customer') {
          return new Response(
            JSON.stringify({ success: true, sent: 0, message: 'No subscriptions for this order' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Non-customer flows may optionally fallback using companyId when provided.
        if (companyId) {
          console.log('Fallback (non-customer): Looking for subscription by company_id and user_type:', companyId, targetUserType);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('company_id', companyId)
            .eq('user_type', targetUserType);

          subscriptions = fallbackData || [];
          fetchError = fallbackError;
        }
      }
    } else if (userId) {
      console.log('Looking for subscription by user_id:', userId);
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching by user_id:', error);
        fetchError = error;
      } else if (data && data.length > 0) {
        subscriptions = data;
        console.log(`Found ${data.length} subscriptions by user_id`);
      } else if (companyId && userType) {
        // Fallback: try by company_id + user_type if user_id didn't find anything
        console.log('user_id not found, falling back to company_id + user_type:', companyId, userType);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('company_id', companyId)
          .eq('user_type', userType);
        subscriptions = fallbackData || [];
        fetchError = fallbackError;
        console.log(`Fallback found ${subscriptions.length} subscriptions`);
      }
    } else if (companyId && userType) {
      console.log('Looking for subscription by company_id and user_type:', companyId, userType);
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('company_id', companyId)
        .eq('user_type', userType);
      subscriptions = data || [];
      fetchError = error;
      console.log(`Query result: ${subscriptions.length} subscriptions found`);
    } else if (companyId) {
      console.log('Looking for subscription by company_id:', companyId);
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('company_id', companyId);
      subscriptions = data || [];
      fetchError = error;
    }

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found after all attempts');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Total ${subscriptions.length} subscriptions to notify`);

    // Send push to all subscriptions
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const success = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );

        // Delete invalid subscriptions
        if (!success) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }

        return success;
      })
    );

    const sentCount = results.filter(Boolean).length;

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: subscriptions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-push-notification:', error);
    const err = error as { message?: string };
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
