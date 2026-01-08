import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MapPin, Navigation, XCircle, Maximize2, Minimize2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DriverRouteMapProps {
  destinationAddress: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state?: string | null;
  };
  onClose: () => void;
  onCompleteDelivery?: () => void;
  isCompletingDelivery?: boolean;
}

const DriverRouteMap: React.FC<DriverRouteMapProps> = ({
  destinationAddress,
  onClose,
  onCompleteDelivery,
  isCompletingDelivery = false,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  const watchId = useRef<number | null>(null);
  const mapInitialized = useRef(false);
  const lastRouteUpdate = useRef<number>(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch Mapbox token - only once
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

  // Geocode destination address - only once when token is available
  useEffect(() => {
    if (!mapboxToken || !destinationAddress || destinationCoords) return;

    const geocodeAddress = async () => {
      const addressStr = `${destinationAddress.street}, ${destinationAddress.number}, ${destinationAddress.neighborhood}, ${destinationAddress.city}${destinationAddress.state ? `, ${destinationAddress.state}` : ''}, Brazil`;
      const encodedAddress = encodeURIComponent(addressStr);
      
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&country=BR&limit=1`
        );
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          setDestinationCoords({ lat, lng });
        } else {
          console.error('Address not found');
          setError('Endereço não encontrado no mapa');
        }
      } catch (err) {
        console.error('Geocoding error:', err);
        setError('Erro ao buscar endereço');
      }
    };

    geocodeAddress();
  }, [mapboxToken, destinationAddress, destinationCoords]);

  // Get driver location - only once initially
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDriverLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Não foi possível obter sua localização');
      },
      { enableHighAccuracy: true }
    );

    // Watch for updates - only update marker, not state
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        
        // Update marker position directly without triggering re-render
        if (driverMarker.current) {
          driverMarker.current.setLngLat([newLocation.lng, newLocation.lat]);
        }
        
        // Store for route updates
        setDriverLocation(newLocation);
      },
      (err) => console.error('Watch position error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  const fetchRoute = useCallback(async (skipBoundsUpdate = false) => {
    if (!mapboxToken || !driverLocation || !destinationCoords || !map.current) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLocation.lng},${driverLocation.lat};${destinationCoords.lng},${destinationCoords.lat}?steps=true&geometries=geojson&access_token=${mapboxToken}`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const routeGeometry = route.geometry;

        // Set route info
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        setRouteDistance(`${distanceKm} km`);
        setRouteDuration(`${durationMin} min`);

        // Add route to map
        if (map.current.getSource('route')) {
          (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: routeGeometry,
          });
        } else {
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: routeGeometry,
              },
            },
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 6,
              'line-opacity': 0.8,
            },
          });
        }

        // Fit map to route only on first load
        if (!skipBoundsUpdate) {
          const coordinates = routeGeometry.coordinates;
          const bounds = coordinates.reduce(
            (bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
              return bounds.extend(coord as mapboxgl.LngLatLike);
            },
            new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
          );

          map.current.fitBounds(bounds, {
            padding: 50,
            duration: 1000,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching route:', err);
    }
  }, [mapboxToken, driverLocation, destinationCoords]);

  // Initialize map - only once when all dependencies are ready
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !driverLocation || !destinationCoords || mapInitialized.current) return;

    mapboxgl.accessToken = mapboxToken;
    mapInitialized.current = true;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      zoom: 13,
      center: [driverLocation.lng, driverLocation.lat],
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setLoading(false);

      // Add driver marker
      const driverEl = document.createElement('div');
      driverEl.innerHTML = `
        <div class="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
          </svg>
        </div>
      `;
      driverMarker.current = new mapboxgl.Marker(driverEl)
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map.current!);

      // Add destination marker
      const destEl = document.createElement('div');
      destEl.innerHTML = `
        <div class="w-10 h-10 bg-destructive rounded-full flex items-center justify-center shadow-lg border-2 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      `;
      destinationMarker.current = new mapboxgl.Marker(destEl)
        .setLngLat([destinationCoords.lng, destinationCoords.lat])
        .addTo(map.current!);

      // Get and draw route
      fetchRoute(false);
    });

    return () => {
      map.current?.remove();
      mapInitialized.current = false;
    };
  }, [mapboxToken, driverLocation, destinationCoords, fetchRoute]);

  // Update route periodically without triggering map re-initialization
  useEffect(() => {
    if (!mapInitialized.current || loading) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastRouteUpdate.current > 25000) {
        lastRouteUpdate.current = now;
        fetchRoute(true); // Skip bounds update on periodic updates
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading, fetchRoute]);

  const centerOnDriver = () => {
    if (map.current && driverLocation) {
      map.current.flyTo({
        center: [driverLocation.lng, driverLocation.lat],
        zoom: 16,
        duration: 1000,
      });
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    // Resize map after expansion animation
    setTimeout(() => {
      map.current?.resize();
    }, 100);
  };

  if (error) {
    return (
      <div className="w-full h-80 bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative rounded-lg overflow-hidden border border-border transition-all duration-300 ${
        isExpanded 
          ? 'fixed inset-4 z-50 h-auto' 
          : 'w-full h-80'
      }`}
    >
      {isExpanded && (
        <div className="fixed inset-0 bg-black/50 -z-10" onClick={toggleExpanded} />
      )}

      {(loading || !driverLocation || !destinationCoords) && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">
              {!driverLocation ? 'Obtendo sua localização...' : 'Carregando mapa...'}
            </p>
          </div>
        </div>
      )}
      
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Route Info Overlay */}
      {routeDistance && routeDuration && (
        <div className="absolute top-2 left-2 bg-background/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-primary" />
              <span className="font-medium">{routeDistance}</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <span className="text-muted-foreground">{routeDuration}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-2 right-12 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 shadow-lg"
          onClick={centerOnDriver}
          title="Centralizar em mim"
        >
          <Navigation className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 shadow-lg"
          onClick={toggleExpanded}
          title={isExpanded ? "Minimizar" : "Expandir"}
        >
          {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
        {/* Complete Delivery Button - visible when expanded */}
        {isExpanded && onCompleteDelivery && (
          <Button
            size="lg"
            className="shadow-lg flex-1"
            onClick={onCompleteDelivery}
            disabled={isCompletingDelivery}
          >
            {isCompletingDelivery ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5 mr-2" />
            )}
            Concluir Entrega
          </Button>
        )}

        {/* Close Button */}
        <Button
          size={isExpanded ? "lg" : "sm"}
          variant="secondary"
          className="shadow-lg"
          onClick={isExpanded ? toggleExpanded : onClose}
        >
          <XCircle className="h-4 w-4 mr-1" />
          {isExpanded ? 'Minimizar' : 'Fechar mapa'}
        </Button>
      </div>
    </div>
  );
};

export default DriverRouteMap;
