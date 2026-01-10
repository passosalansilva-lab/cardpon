import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MapPin } from 'lucide-react';

interface DeliveryMapProps {
  driverId: string | null;
  destinationAddress?: string;
  companyAddress?: string;
}

interface DriverLocation {
  latitude: number;
  longitude: number;
  updatedAt: string;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({
  driverId,
  destinationAddress,
  companyAddress,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setError('Token do mapa não disponível');
        }
      } catch (err) {
        console.error('Error fetching Mapbox token:', err);
        setError('Erro ao carregar mapa');
      }
    };
    fetchToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      zoom: 14,
      center: [-49.2643, -25.4284], // Default to Curitiba, will update when driver location is available
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setLoading(false);
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Fetch and subscribe to driver location
  useEffect(() => {
    if (!driverId) return;

    const fetchDriverLocation = async () => {
      const { data, error } = await supabase
        .from('delivery_drivers')
        .select('current_latitude, current_longitude, location_updated_at')
        .eq('id', driverId)
        .single();

      if (error) {
        console.error('Error fetching driver location:', error);
        return;
      }

      if (data?.current_latitude && data?.current_longitude) {
        setDriverLocation({
          latitude: Number(data.current_latitude),
          longitude: Number(data.current_longitude),
          updatedAt: data.location_updated_at,
        });
      }
    };

    fetchDriverLocation();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_drivers',
          filter: `id=eq.${driverId}`,
        },
        (payload) => {
          console.log('Driver location updated:', payload);
          const { current_latitude, current_longitude, location_updated_at } = payload.new as any;
          if (current_latitude && current_longitude) {
            setDriverLocation({
              latitude: Number(current_latitude),
              longitude: Number(current_longitude),
              updatedAt: location_updated_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  // Update marker when driver location changes
  useEffect(() => {
    if (!map.current || !driverLocation) return;

    const { latitude, longitude } = driverLocation;

    // Fly to driver location
    map.current.flyTo({
      center: [longitude, latitude],
      zoom: 15,
      duration: 1000,
    });

    // Create or update driver marker
    if (driverMarker.current) {
      driverMarker.current.setLngLat([longitude, latitude]);
    } else {
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'driver-marker';
      el.innerHTML = `
        <div class="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      `;

      driverMarker.current = new mapboxgl.Marker(el)
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    }
  }, [driverLocation]);

  if (error) {
    return (
      <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!driverId) {
    return (
      <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Aguardando atribuição do entregador</p>
        </div>
      </div>
    );
  }

  if (!driverLocation && !loading) {
    return (
      <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Localização do entregador não disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainer} className="absolute inset-0" />
      {driverLocation && (
        <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs">
          <p className="text-muted-foreground">
            Última atualização:{' '}
            {new Date(driverLocation.updatedAt).toLocaleTimeString('pt-BR')}
          </p>
        </div>
      )}
    </div>
  );
};

export default DeliveryMap;
