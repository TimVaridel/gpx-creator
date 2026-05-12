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

let lastCallTime = 0;
const MIN_DELAY_MS = 1100;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve =>
      setTimeout(resolve, MIN_DELAY_MS - elapsed)
    );
  }
  lastCallTime = Date.now();
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | undefined> {
  try {
    await waitForRateLimit();
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'fr',
        'User-Agent': 'GPX-Creator-App/1.0',
      },
    });
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
    if (!postcode && !locality) return undefined;
    return `${postcode} ${locality}`.trim();
  } catch {
    return undefined;
  }
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (!query.trim()) return [];
  try {
    await waitForRateLimit();
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=0`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'fr',
        'User-Agent': 'GPX-Creator-App/1.0',
      },
    });
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
