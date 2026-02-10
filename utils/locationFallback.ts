import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { geocodingService } from '@/services/geocoding.service';

const LOCATION_CACHE_KEY = '@realmeet_fallback_location';

interface CachedLocation {
  latitude: number;
  longitude: number;
  city: string;
  timestamp: number;
}

interface LocationResult {
  latitude: number;
  longitude: number;
  source: 'gps' | 'city_fallback';
}

/**
 * Retrieve cached fallback location from AsyncStorage.
 * Returns null if no cache exists or the cached city differs from the current one.
 */
async function getCachedLocation(city: string): Promise<CachedLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedLocation = JSON.parse(raw);
    if (cached.city !== city) return null;
    return cached;
  } catch {
    return null;
  }
}

/**
 * Store a fallback location in AsyncStorage.
 */
async function setCachedLocation(location: CachedLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
  } catch {
    // Cache write failure is non-critical
  }
}

/**
 * Fetch the current user's city from the profiles table.
 */
async function getUserCity(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('city')
      .eq('id', user.id)
      .single();

    if (error || !data?.city) return null;
    return data.city;
  } catch {
    return null;
  }
}

/**
 * Geocode a city name into lat/lng coordinates, using cache when available.
 */
async function geocodeCity(city: string): Promise<{ latitude: number; longitude: number } | null> {
  const cached = await getCachedLocation(city);
  if (cached) {
    return { latitude: cached.latitude, longitude: cached.longitude };
  }

  const result = await geocodingService.geocodeAddress(city);
  if (!result) return null;

  await setCachedLocation({
    latitude: result.latitude,
    longitude: result.longitude,
    city,
    timestamp: Date.now(),
  });

  return { latitude: result.latitude, longitude: result.longitude };
}

/**
 * Get the user's location with a robust fallback chain:
 * 1. Request foreground permission and get GPS position
 * 2. On any failure (permission denied, timeout, hardware error),
 *    fall back to geocoding the user's profile city from Supabase
 * 3. Cache the geocoded city coordinates in AsyncStorage
 *
 * Returns null only if both GPS and city fallback fail entirely.
 */
export async function getLocationWithFallback(): Promise<LocationResult | null> {
  // Step 1: Try GPS
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        source: 'gps',
      };
    }
    // Permission not granted — fall through to city fallback
  } catch (error) {
    console.warn('GPS location failed, falling back to city geocoding:', error);
  }

  // Step 2: Fallback — geocode the user's profile city
  try {
    const city = await getUserCity();
    if (!city) {
      console.warn('No city found in user profile for location fallback');
      return null;
    }

    const coords = await geocodeCity(city);
    if (!coords) {
      console.warn('Could not geocode city:', city);
      return null;
    }

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      source: 'city_fallback',
    };
  } catch (error) {
    console.warn('City fallback failed:', error);
    return null;
  }
}
