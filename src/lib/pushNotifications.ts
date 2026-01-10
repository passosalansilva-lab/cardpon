import { supabase } from '@/integrations/supabase/client';

export type PushSubscribeErrorCode =
  | 'permission_denied'
  | 'vapid_missing'
  | 'sw_unavailable'
  | 'push_service_error'
  | 'unknown';

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; code: PushSubscribeErrorCode; message: string };

// Cache for VAPID public key
let cachedVapidKey: string | null = null;

async function getVapidPublicKey(): Promise<string | null> {
  if (cachedVapidKey) {
    console.log('[PushNotifications] Using cached VAPID key');
    return cachedVapidKey;
  }

  try {
    console.log('[PushNotifications] Fetching VAPID key from server...');
    const { data, error } = await supabase.functions.invoke('get-vapid-key');
    
    if (error) {
      console.error('[PushNotifications] Error fetching VAPID key:', error);
      return null;
    }

    if (data?.publicKey) {
      console.log('[PushNotifications] VAPID key received successfully');
      cachedVapidKey = data.publicKey;
      return cachedVapidKey;
    }

    console.error('[PushNotifications] VAPID key not found in response:', data);
    return null;
  } catch (error) {
    console.error('[PushNotifications] Error fetching VAPID key:', error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('[PushNotifications] Browser does not support notifications');
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    console.log('[PushNotifications] Browser does not support service workers');
    return false;
  }

  console.log('[PushNotifications] Requesting notification permission...');
  const permission = await Notification.requestPermission();
  console.log('[PushNotifications] Permission result:', permission);
  return permission === 'granted';
}

export async function subscribeToPush(options: {
  orderId?: string;
  companyId?: string;
  userId?: string;
  userType: 'customer' | 'driver' | 'store_owner';
}): Promise<PushSubscribeResult> {
  console.log('[PushNotifications] Starting subscription process...', { userType: options.userType });

  try {
    // For customers, notifications must be tied to a specific order.
    if (options.userType === 'customer' && !options.orderId) {
      return {
        ok: false,
        code: 'unknown',
        message: 'Para cliente, é necessário informar o pedido para ativar notificações.',
      };
    }

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return {
        ok: false,
        code: 'permission_denied',
        message: 'Permissão de notificações não concedida no navegador.',
      };
    }

    // Get VAPID public key from server
    console.log('[PushNotifications] Getting VAPID key...');
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      return {
        ok: false,
        code: 'vapid_missing',
        message: 'Não foi possível obter a chave de notificações do servidor.',
      };
    }

    // Wait for service worker to be ready with timeout
    console.log('[PushNotifications] Waiting for Service Worker...');
    const swReadyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Service Worker timeout after 10s')), 10000)
    );

    let registration: ServiceWorkerRegistration;
    try {
      registration = await Promise.race([swReadyPromise, timeoutPromise]);
      console.log('[PushNotifications] Service Worker ready:', registration.scope);
    } catch (timeoutError) {
      console.error('[PushNotifications] Service Worker not ready:', timeoutError);
      // Try to register SW manually
      console.log('[PushNotifications] Attempting manual SW registration...');
      registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      console.log('[PushNotifications] Manual SW registration successful');
    }

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    console.log('[PushNotifications] Existing subscription:', !!subscription);

    if (!subscription) {
      console.log('[PushNotifications] Creating new push subscription with VAPID key');
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });
        console.log('[PushNotifications] New subscription created');
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        const name = e?.name || 'unknown';
        const msg = e?.message || 'Unknown error';

        // This is the exact error you got: AbortError / "Registration failed - push service error"
        if (name === 'AbortError' && msg.toLowerCase().includes('push service')) {
          return {
            ok: false,
            code: 'push_service_error',
            message:
              'O serviço de push do navegador falhou (rede/bloqueador/firewall). Teste em outra rede, desative bloqueadores e tente novamente.',
          };
        }

        return {
          ok: false,
          code: 'unknown',
          message: `Erro ao registrar no serviço de push: ${msg}`,
        };
      }
    }

    const subscriptionJson = subscription.toJSON();
    console.log('[PushNotifications] Subscription JSON ready, saving to database...');

    const subscriptionData = {
      endpoint: subscriptionJson.endpoint,
      p256dh: subscriptionJson.keys?.p256dh || '',
      auth: subscriptionJson.keys?.auth || '',
      user_id: options.userId || null,
      user_type: options.userType,
      company_id: options.companyId || null,
      order_id: options.orderId || null,
    };

    console.log('[PushNotifications] Saving subscription data:', {
      user_type: subscriptionData.user_type,
      company_id: subscriptionData.company_id,
      order_id: subscriptionData.order_id,
    });

    const { data: existingData, error: selectError } = await supabase
      .from('push_subscriptions')
      .select('id, company_id, order_id')
      .eq('endpoint', subscriptionJson.endpoint)
      .maybeSingle();

    console.log('[PushNotifications] Existing subscription check:', {
      exists: !!existingData,
      error: selectError?.message,
    });

    let saveError;
    if (existingData) {
      console.log('[PushNotifications] Updating existing subscription:', existingData.id);
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          order_id: options.orderId || existingData.order_id,
          user_type: options.userType,
          company_id: options.companyId || existingData.company_id,
          user_id: options.userId || null,
        })
        .eq('id', existingData.id);
      saveError = updateError;
      if (updateError) {
        console.error('[PushNotifications] Update error:', updateError.message);
      }
    } else {
      console.log('[PushNotifications] Inserting new subscription...');
      const { error: insertError } = await supabase.from('push_subscriptions').insert(subscriptionData);
      saveError = insertError;
      if (insertError) {
        console.error('[PushNotifications] Insert error:', insertError.message);
      }
    }

    if (saveError) {
      return {
        ok: false,
        code: 'unknown',
        message: 'Não foi possível salvar a assinatura de notificações no servidor.',
      };
    }

    console.log('[PushNotifications] Push subscription saved successfully!');
    return { ok: true };
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error('[PushNotifications] Error subscribing to push:', error);
    return {
      ok: false,
      code: 'unknown',
      message: e?.message || 'Erro desconhecido ao ativar notificações.',
    };
  }
}

// Sync metadata to the database for an already-existing browser subscription.
// This is critical when the user is already subscribed, but we need to associate it to a specific order.
export async function syncPushSubscription(options: {
  orderId?: string;
  companyId?: string;
  userId?: string;
  userType: 'customer' | 'driver' | 'store_owner';
}): Promise<boolean> {
  try {
    if (options.userType === 'customer' && !options.orderId) {
      console.error('Customer push subscription requires orderId');
      return false;
    }

    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return false;
    }

    const subscriptionJson = subscription.toJSON();

    const subscriptionData = {
      endpoint: subscriptionJson.endpoint,
      p256dh: subscriptionJson.keys?.p256dh || '',
      auth: subscriptionJson.keys?.auth || '',
      user_id: options.userId || null,
      user_type: options.userType,
      company_id: options.companyId || null,
      order_id: options.orderId || null,
    };

    const { data: existingData } = await supabase
      .from('push_subscriptions')
      .select('id, company_id, order_id')
      .eq('endpoint', subscriptionJson.endpoint)
      .maybeSingle();

    if (existingData) {
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          order_id: options.orderId || existingData.order_id,
          user_type: options.userType,
          company_id: options.companyId || existingData.company_id,
          user_id: options.userId || null,
        })
        .eq('id', existingData.id);

      if (updateError) {
        console.error('Error syncing push subscription:', updateError);
        return false;
      }

      return true;
    }

    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .insert(subscriptionData);

    if (insertError) {
      console.error('Error syncing push subscription (insert):', insertError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error syncing push subscription:', error);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Remove from database
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);

      // Unsubscribe
      await subscription.unsubscribe();
    }

    return true;
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return false;
  }
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermission | null> {
  if (!('Notification' in window)) {
    return null;
  }
  return Notification.permission;
}
