import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type NotificationEventType =
  | 'new_order'
  | 'status_change'
  | 'driver_new_order'
  | 'driver_offer';

interface UseNotificationSoundOptions {
  /**
   * Volume padrão usado quando não houver configuração no banco
   */
  defaultVolume?: number;
}

export const useNotificationSound = (
  eventType: NotificationEventType,
  options: UseNotificationSoundOptions = {}
) => {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(true);

  useEffect(() => {
    if (!user) return;

    const loadSound = async () => {
      try {
        console.log('[useNotificationSound] Carregando som', { eventType, userId: user.id });
        const DEFAULT_NOTIFICATION_SOUND = '/sounds/default-notification.mp3';

        const { data, error } = await supabase
          .from('notification_sound_settings')
          .select('sound_key, enabled, volume')
          .eq('user_id', user.id)
          .eq('event_type', eventType)
          .maybeSingle();

        if (error) {
          console.error(`Erro ao carregar som de notificações (${eventType}):`, error);
          return;
        }

        const row = data as { sound_key: string | null; enabled: boolean | null; volume: number | null } | null;

        const soundKeyRaw = row?.sound_key?.trim() || null;
        const enabled = row?.enabled ?? true;
        const volume = row?.volume ?? options.defaultVolume ?? 0.5;

        const resolveSound = (key: string | null) => {
          if (!key || key === 'classic' || key === 'default') {
            return DEFAULT_NOTIFICATION_SOUND;
          }
          return key;
        };

        const soundUrl = resolveSound(soundKeyRaw);
        console.log('[useNotificationSound] Config carregada', {
          eventType,
          soundKeyRaw,
          soundUrl,
          enabled,
          volume,
        });

        if (!enabled || !soundUrl) {
          enabledRef.current = false;
          audioRef.current = null;
          return;
        }

        const audio = new Audio(soundUrl);
        audio.volume = volume;
        audioRef.current = audio;
        enabledRef.current = true;
      } catch (e) {
        console.error(`Erro ao carregar som de notificações (${eventType}):`, e);
      }
    };

    loadSound();

    return () => {
      audioRef.current = null;
    };
  }, [user, eventType, options.defaultVolume]);

  const playSound = useCallback(() => {
    console.log('[useNotificationSound] playSound chamado', {
      eventType,
      enabled: enabledRef.current,
      hasAudio: !!audioRef.current,
    });

    if (!enabledRef.current) return;

    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => {
          console.error('[useNotificationSound] Erro ao tocar áudio principal', err);
        });
      } else {
        // Fallback extra para garantir som mesmo se o áudio ainda não estiver carregado
        const fallback = new Audio('/sounds/default-notification.mp3');
        fallback.volume = options.defaultVolume ?? 0.5;
        fallback.play().catch((err) => {
          console.error('[useNotificationSound] Erro ao tocar áudio fallback', err);
        });
      }
    } catch (e) {
      console.error('Erro ao tocar som de notificação:', e);
    }
  }, [eventType, options.defaultVolume]);

  return { playSound };
};
