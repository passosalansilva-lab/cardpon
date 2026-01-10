import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  isPushSupported,
  subscribeToPush,
  syncPushSubscription,
  getNotificationPermissionStatus,
  unsubscribeFromPush,
} from '@/lib/pushNotifications';
import { toast } from 'sonner';

interface PushNotificationButtonProps {
  orderId?: string;
  companyId?: string;
  userId?: string;
  userType: 'customer' | 'driver' | 'store_owner';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean; // permite usar versão só ícone em layouts compactos
}

export function PushNotificationButton({
  orderId,
  companyId,
  userId,
  userType,
  variant = 'outline',
  size = 'sm',
  className = '',
  showLabel = true,
}: PushNotificationButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      console.log('[PushNotificationButton] Checking push notification status...');
      const supported = isPushSupported();
      setIsSupported(supported);
      console.log('[PushNotificationButton] Push supported:', supported);

      if (supported) {
        const perm = await getNotificationPermissionStatus();
        setPermission(perm);
        console.log('[PushNotificationButton] Permission status:', perm);
        
        // Check if there's an active subscription
        if (perm === 'granted') {
          try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            const hasSub = !!subscription;
            setIsSubscribed(hasSub);
            console.log('[PushNotificationButton] Has subscription:', hasSub);

            // If already subscribed, ensure the backend association is correct (e.g. per-order).
            if (hasSub) {
              await syncPushSubscription({ orderId, companyId, userId, userType });
            }
          } catch (e) {
            console.error('[PushNotificationButton] Error checking subscription:', e);
            setIsSubscribed(false);
          }
        } else {
          setIsSubscribed(false);
        }
      }
    };

    checkStatus();
  }, [orderId, companyId, userId, userType]);

  const handleToggleNotifications = useCallback(async () => {
    console.log('[PushNotificationButton] Toggle clicked, isSubscribed:', isSubscribed);
    setIsLoading(true);

    try {
      if (isSubscribed) {
        console.log('[PushNotificationButton] Unsubscribing...');
        await unsubscribeFromPush();
        setIsSubscribed(false);
        toast.info('Notificações desativadas');
      } else {
        // Check if service worker is ready
        if (!('serviceWorker' in navigator)) {
          toast.error('Navegador não suporta notificações push');
          return;
        }

        // Em ambientes embedados (ex.: preview), o push pode falhar por políticas do navegador/rede.
        if (window.self !== window.top) {
          toast.error('Abra em nova aba para ativar notificações', {
            description: 'Alguns navegadores bloqueiam o registro de push em janelas incorporadas.',
          });
          return;
        }

        console.log('[PushNotificationButton] Starting subscription process...');
        const result = await subscribeToPush({
          orderId,
          companyId,
          userId,
          userType,
        });
        console.log('[PushNotificationButton] Subscription result:', result);

        if (result.ok) {
          setIsSubscribed(true);
          setPermission('granted');
          toast.success('Notificações ativadas!', {
            description: 'Você receberá atualizações mesmo com o app fechado',
          });
        } else {
          const failure = result as Extract<typeof result, { ok: false }>;

          // Permission denied case
          if (failure.code === 'permission_denied') {
            setPermission('denied');
            toast.error('Notificações bloqueadas', {
              description: failure.message,
            });
            return;
          }

          toast.error('Não foi possível ativar notificações', {
            description: failure.message,
          });
        }
      }
    } catch (error) {
      console.error('[PushNotificationButton] Error toggling notifications:', error);
      toast.error('Erro ao configurar notificações', {
        description: error instanceof Error ? error.message : 'Por favor, tente novamente',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isSubscribed, orderId, companyId, userId, userType]);

  if (!isSupported) {
    return null;
  }

  // Customers must subscribe per-order (prevents notifying the wrong person).
  if (userType === 'customer' && !orderId) {
    return null;
  }

  if (permission === 'denied') {
    return (
      <Button
        variant="ghost"
        size={size}
        className={`text-muted-foreground ${className}`}
        disabled
        title="Notificações bloqueadas nas configurações do navegador"
      >
        <BellOff className={showLabel ? "h-4 w-4 mr-2" : "h-4 w-4"} />
        {showLabel && 'Bloqueado'}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleToggleNotifications}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className={showLabel ? "h-4 w-4 mr-2 animate-spin" : "h-4 w-4 animate-spin"} />
      ) : isSubscribed ? (
        <Bell className={showLabel ? "h-4 w-4 mr-2 text-primary" : "h-4 w-4 text-primary"} />
      ) : (
        <BellOff className={showLabel ? "h-4 w-4 mr-2" : "h-4 w-4"} />
      )}
      {showLabel && (isSubscribed ? 'Notificações ativas' : 'Ativar notificações')}
    </Button>
  );
}