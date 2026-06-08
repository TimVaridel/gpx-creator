const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

async function proxyToNominatim(url: string): Promise<Response> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'GPX-Creator-App/1.0',
      'Accept-Language': 'fr',
    },
  });

  if (!resp.ok) {
    return new Response(JSON.stringify({ error: 'Nominatim error', status: resp.status }), {
      status: resp.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const data = await resp.json();
  return new Response(JSON.stringify(data), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const q = url.searchParams.get('q');

  let nominatimUrl: string;

  if (lat && lon) {
    nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`;
  } else if (q) {
    nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=0`;
  } else {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return proxyToNominatim(nominatimUrl);
}
