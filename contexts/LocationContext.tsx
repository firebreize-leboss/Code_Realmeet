import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [locationSource, setLocationSource] = useState<'gps' | 'city_fallback' | null>(null);
  const [isLocationEnabled, setIsLocationEnabledState] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const lastRefreshTimeRef = useRef<number>(0);

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
    }
    lastRefreshTimeRef.current = Date.now();
  }, []);

  // React to isLocationEnabled changes (and initial load)
  useEffect(() => {
    if (!initialLoaded) return;
    fetchLocation(!isLocationEnabled);
  }, [isLocationEnabled, initialLoaded, fetchLocation]);

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
