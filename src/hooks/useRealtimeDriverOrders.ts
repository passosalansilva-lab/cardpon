import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface RealtimeDriverOrdersOptions {
  driverId: string | null;
  onOrderAssigned?: (order: any) => void;
  onOrderUpdate?: (order: any) => void;
  playSound?: boolean;
}

interface DriverSoundSetting {
  event_type: 'driver_new_order';
  sound_key: string;
  enabled: boolean;
  volume: number;
}

export function useRealtimeDriverOrders({
  driverId,
  onOrderAssigned,
  onOrderUpdate,
  playSound = true,
}: RealtimeDriverOrdersOptions) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [driverSoundEnabled, setDriverSoundEnabled] = useState(true);

  // Load sound preference for driver new order
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('notification_sound_settings')
        .select('event_type, sound_key, enabled')
        .eq('user_id', user.id)
        .eq('event_type', 'driver_new_order');

      if (error) {
        console.error('Erro ao carregar som do entregador:', error);
        return;
      }

      let soundKey: string | null = null;
      let enabled = false;
      let volume = 0.7;

      (data as DriverSoundSetting[] | null)?.forEach((row) => {
        soundKey = row.sound_key?.trim() || null;
        enabled = row.enabled;
        volume = row.volume ?? 0.7;
      });

      // Only create audio if we have a custom sound configured
      if (soundKey && enabled) {
        audioRef.current = new Audio(soundKey);
        audioRef.current.volume = volume;
      }
      setDriverSoundEnabled(enabled);
    };

    loadSettings();
  }, [user]);

  const playNotificationSound = useCallback(() => {
    if (playSound && driverSoundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
    }
  }, [playSound, driverSoundEnabled]);

  useEffect(() => {
    if (!driverId) return;

    console.log('Setting up realtime subscription for driver:', driverId);

    const channel = supabase
      .channel(`driver-orders-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `delivery_driver_id=eq.${driverId}`,
        },
        (payload) => {
          console.log('Driver order update:', payload);

          // Check if this is a new assignment
          if (payload.old?.delivery_driver_id !== driverId && payload.new.delivery_driver_id === driverId) {
            playNotificationSound();
            toast.success('Nova entrega atribuída!', {
              description: `Pedido #${payload.new.id.slice(0, 8)} - ${payload.new.customer_name}`,
              duration: 10000,
            });
            onOrderAssigned?.(payload.new);
          } else {
            onOrderUpdate?.(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log('Driver realtime subscription status:', status);
      });

    // Also listen to INSERT events in case order is created with driver already assigned
    const insertChannel = supabase
      .channel(`driver-orders-insert-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `delivery_driver_id=eq.${driverId}`,
        },
        (payload) => {
          console.log('New order assigned to driver:', payload);
          playNotificationSound();
          toast.success('Nova entrega atribuída!', {
            description: `Pedido #${payload.new.id.slice(0, 8)} - ${payload.new.customer_name}`,
            duration: 10000,
          });
          onOrderAssigned?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(insertChannel);
    };
  }, [driverId, onOrderAssigned, onOrderUpdate, playNotificationSound]);
}
