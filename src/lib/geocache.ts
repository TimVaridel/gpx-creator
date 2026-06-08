import { supabase } from './supabaseClient';

export async function getCachedLocality(
  lat: number,
  lng: number,
): Promise<string | null> {
  const keyLat = Math.round(lat * 10000) / 10000;
  const keyLng = Math.round(lng * 10000) / 10000;

  const { data, error } = await supabase
    .from('locality_cache')
    .select('locality')
    .eq('lat', keyLat)
    .eq('lng', keyLng)
    .maybeSingle();

  if (error) { console.warn('getCachedLocality error', error); return null; }
  return data?.locality ?? null;
}

export async function setCachedLocality(
  lat: number,
  lng: number,
  locality: string,
): Promise<void> {
  const keyLat = Math.round(lat * 10000) / 10000;
  const keyLng = Math.round(lng * 10000) / 10000;

  const { error } = await supabase
    .from('locality_cache')
    .upsert(
      { lat: keyLat, lng: keyLng, locality, updated_at: new Date().toISOString() },
      { onConflict: 'lat, lng' },
    );

  if (error) console.warn('setCachedLocality error', error);
}
