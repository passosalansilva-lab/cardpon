import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface RealtimeOrdersOptions {
  companyId: string | null;
  onOrderInsert?: (order: any) => void;
  onOrderUpdate?: (order: any) => void;
  onOrderDelete?: (orderId: string) => void;
  playSound?: boolean;
}

interface NotificationSoundSetting {
  event_type: 'new_order' | 'status_change';
  sound_key: string;
  enabled: boolean;
  volume: number;
}

export function useRealtimeOrders({
  companyId,
  onOrderInsert,
  onOrderUpdate,
  onOrderDelete,
  playSound = true,
}: RealtimeOrdersOptions) {
  const { user } = useAuth();
  const newOrderAudioRef = useRef<HTMLAudioElement | null>(null);
  const statusAudioRef = useRef<HTMLAudioElement | null>(null);
  const [newOrderSoundEnabled, setNewOrderSoundEnabled] = useState(true);
  const [statusSoundEnabled, setStatusSoundEnabled] = useState(true);

  // Load sound preferences for this user/company
  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !companyId) return;

      // Som padrão do sistema
      const DEFAULT_NOTIFICATION_SOUND = '/sounds/default-notification.mp3';

      const { data, error } = await supabase
        .from('notification_sound_settings')
        .select('event_type, sound_key, enabled, volume')
        .eq('user_id', user.id)
        .in('event_type', ['new_order', 'status_change']);

      if (error) {
        console.error('Erro ao carregar configurações de som:', error);
        // Mesmo com erro, usa o som padrão
        newOrderAudioRef.current = new Audio(DEFAULT_NOTIFICATION_SOUND);
        newOrderAudioRef.current.volume = 0.6;
        setNewOrderSoundEnabled(true);
        return;
      }

      let newOrderSoundKey: string | null = null;
      let statusSoundKey: string | null = null;
      let newOrderEnabled = true; // Padrão é ativado
      let statusEnabled = true;   // Padrão é ativado
      let newOrderVolume = 0.6;
      let statusVolume = 0.6;

      (data as NotificationSoundSetting[] | null)?.forEach((row) => {
        if (row.event_type === 'new_order') {
          newOrderSoundKey = row.sound_key?.trim() || null;
          newOrderEnabled = row.enabled;
          newOrderVolume = row.volume ?? 0.6;
        }
        if (row.event_type === 'status_change') {
          statusSoundKey = row.sound_key?.trim() || null;
          statusEnabled = row.enabled;
          statusVolume = row.volume ?? 0.6;
        }
      });

      // Se não houver configuração ou for 'classic'/'default', usa o som padrão do sistema
      const resolveSound = (key: string | null) => {
        if (!key || key === 'classic' || key === 'default') {
          return DEFAULT_NOTIFICATION_SOUND;
        }
        return key;
      };

      // Inicializar áudio para novo pedido (sempre ativo por padrão)
      if (newOrderEnabled) {
        newOrderAudioRef.current = new Audio(resolveSound(newOrderSoundKey));
        newOrderAudioRef.current.volume = newOrderVolume;
      }

      // Inicializar áudio para mudança de status
      if (statusEnabled) {
        statusAudioRef.current = new Audio(resolveSound(statusSoundKey));
        statusAudioRef.current.volume = statusVolume;
      }

      setNewOrderSoundEnabled(newOrderEnabled);
      setStatusSoundEnabled(statusEnabled);
    };

    loadSettings();
  }, [user, companyId]);

  const playNewOrderSound = useCallback(() => {
    if (playSound && newOrderSoundEnabled && newOrderAudioRef.current) {
      newOrderAudioRef.current.currentTime = 0;
      newOrderAudioRef.current.play().catch(console.error);
    }
  }, [playSound, newOrderSoundEnabled]);

  const playStatusSound = useCallback(() => {
    if (playSound && statusSoundEnabled && statusAudioRef.current) {
      statusAudioRef.current.currentTime = 0;
      statusAudioRef.current.play().catch(console.error);
    }
  }, [playSound, statusSoundEnabled]);

  useEffect(() => {
    if (!companyId) return;

    console.log('Setting up realtime subscription for company:', companyId);

    const channel = supabase
      .channel(`orders-realtime-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('New order received:', payload);
          playNewOrderSound();

          toast.success(`Novo pedido de ${payload.new.customer_name}!`, {
            description: `Valor: R$ ${Number(payload.new.total).toFixed(2)}`,
            duration: 10000,
          });

          onOrderInsert?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Order updated:', payload);
          onOrderUpdate?.(payload.new);

          // Tocar som sempre que o status mudar
          if (payload.new.status !== payload.old?.status) {
            playStatusSound();
          }

          // Toasts específicos para cancelado e entregue
          if (payload.new.status === 'cancelled' && payload.old?.status !== 'cancelled') {
            toast.error(`Pedido cancelado`, {
              description: `Cliente: ${payload.new.customer_name}`,
              duration: 8000,
            });
          }

          if (payload.new.status === 'delivered' && payload.old?.status !== 'delivered') {
            toast.success(`Pedido entregue!`, {
              description: `Cliente: ${payload.new.customer_name}`,
              duration: 5000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Order deleted:', payload);
          onOrderDelete?.(payload.old.id);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [
    companyId,
    onOrderInsert,
    onOrderUpdate,
    onOrderDelete,
    playNewOrderSound,
    playStatusSound,
  ]);
}
