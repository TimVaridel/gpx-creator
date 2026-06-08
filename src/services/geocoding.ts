import { getCachedLocality, setCachedLocality } from '../lib/geocache';

const memoryCache = new Map<string, string>();
const MIN_DELAY_MS = 1100;
let lastCallTime = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastCallTime = Date.now();
}

function cacheKey(lat: number, lng: number): string {
  return `${Math.round(lat * 10000) / 10000},${Math.round(lng * 10000) / 10000}`;
}

interface NominatimResponse {
  address: {
    postcode?: string;
    town?: string;
    village?: string;
    city?: string;
    municipality?: string;
    suburb?: string;
  };
}

export interface PlaceResult {
  displayName: string;
  lat: number;
  lng: number;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  savedPlaces?: { lat: number; lng: number; name: string }[],
): Promise<string | undefined> {
  const key = cacheKey(lat, lng);

  // 1. Cache mémoire
  const memCached = memoryCache.get(key);
  if (memCached) return memCached;

  // 2. Lieux enregistrés
  if (savedPlaces) {
    const match = savedPlaces.find(
      sp => Math.abs(sp.lat - lat) < 0.0001 && Math.abs(sp.lng - lng) < 0.0001,
    );
    if (match) {
      memoryCache.set(key, match.name);
      return match.name;
    }
  }

  // 3. Cache Supabase
  try {
    const dbCached = await getCachedLocality(lat, lng);
    if (dbCached) {
      memoryCache.set(key, dbCached);
      return dbCached;
    }
  } catch { /* ignore */ }

  // 4. Nominatim
  try {
    await waitForRateLimit();
    const res = await fetch(
      `/api/nominatim?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    );
    if (!res.ok) return undefined;
    const data: NominatimResponse = await res.json();
    const { address } = data;
    const postcode = address.postcode ?? '';
    const locality =
      address.town ??
      address.village ??
      address.city ??
      address.municipality ??
      address.suburb ??
      '';
    const result = (postcode || locality) ? `${postcode} ${locality}`.trim() : undefined;

    if (result) {
      memoryCache.set(key, result);
      setCachedLocality(lat, lng, result);
    }

    return result;
  } catch {
    return undefined;
  }
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (!query.trim()) return [];
  try {
    await waitForRateLimit();
    const res = await fetch(
      `/api/nominatim?q=${encodeURIComponent(query)}&format=json&limit=6`,
    );
    if (!res.ok) return [];
    const data: Array<{ display_name: string; lat: string; lon: string }> =
      await res.json();
    return data.map(item => ({
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch {
    return [];
  }
}
