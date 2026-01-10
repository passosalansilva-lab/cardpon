import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface UseDriverLocationOptions {
  enabled?: boolean;
  updateInterval?: number; // in milliseconds
}

export function useDriverLocation(options: UseDriverLocationOptions = {}) {
  const { enabled = true, updateInterval = 10000 } = options;
  const { user } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const driverIdRef = useRef<string | null>(null);

  const updateLocation = useCallback(async (position: GeolocationPosition) => {
    if (!driverIdRef.current) return;

    const { latitude, longitude } = position.coords;
    console.log('Updating driver location:', { latitude, longitude });

    const { error } = await supabase
      .from('delivery_drivers')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', driverIdRef.current);

    if (error) {
      console.error('Error updating location:', error);
    }
  }, []);

  const startTracking = useCallback(async () => {
    if (!user) return;

    // First, check if user is a driver
    const { data: driver } = await supabase
      .from('delivery_drivers')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!driver) {
      console.log('User is not a driver');
      return;
    }

    driverIdRef.current = driver.id;

    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada pelo navegador');
      return;
    }

    // Request permission and start watching position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation(position);
        toast.success('Rastreamento de localização ativado');
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Erro ao obter localização. Verifique as permissões.');
      },
      { enableHighAccuracy: true }
    );

    // Set up continuous tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      updateLocation,
      (error) => console.error('Watch position error:', error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    // Also update periodically as a fallback
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        updateLocation,
        (error) => console.error('Interval position error:', error),
        { enableHighAccuracy: true }
      );
    }, updateInterval);
  }, [user, updateLocation, updateInterval]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    driverIdRef.current = null;
    console.log('Location tracking stopped');
  }, []);

  useEffect(() => {
    if (enabled && user) {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, user, startTracking, stopTracking]);

  return {
    startTracking,
    stopTracking,
  };
}
