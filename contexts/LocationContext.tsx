import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getLocationWithFallback } from '@/utils/locationFallback';

const LOCATION_ENABLED_KEY = '@realmeet_location_enabled';
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

interface LocationData {
  latitude: number;
  longitude: number;
}

interface LocationContextType {
  userLocation: LocationData | null;
  locationSource: 'gps' | 'city_fallback' | null;
  isLocationEnabled: boolean;
  setIsLocationEnabled: (enabled: boolean) => void;
  refreshLocation: () => Promise<void>;
  lastRefreshTime: number;
  isMapViewActive: boolean;
  setIsMapViewActive: (active: boolean) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [locationSource, setLocationSource] = useState<'gps' | 'city_fallback' | null>(null);
  const [isLocationEnabled, setIsLocationEnabledState] = useState(true);
  const [isMapViewActive, setIsMapViewActive] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Load persisted preference on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LOCATION_ENABLED_KEY);
        if (stored !== null) {
          setIsLocationEnabledState(stored === 'true');
        }
      } catch {
        // Ignore read error, default to true
      }
      setInitialLoaded(true);
    })();
  }, []);

  const fetchLocation = useCallback(async (skipGPS: boolean) => {
    const result = await getLocationWithFallback({ skipGPS });
    if (result) {
      setUserLocation({ latitude: result.latitude, longitude: result.longitude });
      setLocationSource(result.source);
    } else {
      console.log('Aucune localisation disponible, fonctionnement sans géolocalisation');
    }
    lastRefreshTimeRef.current = Date.now();
  }, []);

  // React to isLocationEnabled changes (and initial load)
  useEffect(() => {
    if (!initialLoaded) return;
    fetchLocation(!isLocationEnabled);
  }, [isLocationEnabled, initialLoaded, fetchLocation]);

  // GPS live tracking: watch position when map is visible AND location is enabled
  useEffect(() => {
    if (!isMapViewActive || !isLocationEnabled) {
      // Stop any existing watcher
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            if (!cancelled) {
              setUserLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
              setLocationSource('gps');
            }
          }
        );

        if (cancelled) {
          subscription.remove();
        } else {
          watchSubscriptionRef.current = subscription;
        }
      } catch (error) {
        console.warn('GPS watcher failed to start:', error);
      }
    })();

    return () => {
      cancelled = true;
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
    };
  }, [isMapViewActive, isLocationEnabled]);

  const setIsLocationEnabled = useCallback((enabled: boolean) => {
    setIsLocationEnabledState(enabled);
    AsyncStorage.setItem(LOCATION_ENABLED_KEY, String(enabled)).catch(() => {});
  }, []);

  const refreshLocation = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < REFRESH_COOLDOWN_MS) {
      return; // cooldown not elapsed
    }
    await fetchLocation(!isLocationEnabled);
  }, [isLocationEnabled, fetchLocation]);

  return (
    <LocationContext.Provider
      value={{
        userLocation,
        locationSource,
        isLocationEnabled,
        setIsLocationEnabled,
        refreshLocation,
        lastRefreshTime: lastRefreshTimeRef.current,
        isMapViewActive,
        setIsMapViewActive,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
