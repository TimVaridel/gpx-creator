export interface ParsedRoute {
  name: string;
  waypoints: { lat: number; lng: number; name?: string }[];
  geometry?: [number, number][];
}

// ── GPX ─────────────────────────────────────────────────────
export function parseGpx(text: string): ParsedRoute {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(text, 'application/xml');

  // Nom
  const name = doc.querySelector('metadata > name, gpx > name')?.textContent?.trim()
    ?? 'Itinéraire importé';

  // Waypoints explicites (<wpt>)
  const wpts = Array.from(doc.querySelectorAll('wpt')).map(el => ({
    lat:  parseFloat(el.getAttribute('lat') ?? '0'),
    lng:  parseFloat(el.getAttribute('lon') ?? '0'),
    name: el.querySelector('name')?.textContent?.trim(),
  }));

  // Trace (<trkpt> ou <rtept>)
  const trkpts = Array.from(
    doc.querySelectorAll('trkpt, rtept'),
  ).map(el => [
    parseFloat(el.getAttribute('lat') ?? '0'),
    parseFloat(el.getAttribute('lon') ?? '0'),
  ] as [number, number]);

  // Si pas de <wpt>, on échantillonne la trace pour créer des waypoints
  let waypoints = wpts;
  if (waypoints.length === 0 && trkpts.length > 0) {
    waypoints = sampleWaypoints(trkpts);
  }

  return { name, waypoints, geometry: trkpts.length > 0 ? trkpts : undefined };
}

// ── KML ─────────────────────────────────────────────────────
export function parseKml(text: string): ParsedRoute {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(text, 'application/xml');

  const name = doc.querySelector('Document > name, Folder > name')?.textContent?.trim()
    ?? 'Itinéraire importé';

  // Placemarks ponctuels
  const wpts: { lat: number; lng: number; name?: string }[] = [];
  // Traces (LineString / Track)
  const geometry: [number, number][] = [];

  doc.querySelectorAll('Placemark').forEach(pm => {
    const pmName = pm.querySelector('name')?.textContent?.trim();

    // Point
    const ptCoord = pm.querySelector('Point > coordinates')?.textContent?.trim();
    if (ptCoord) {
      const [lng, lat] = ptCoord.split(',').map(Number);
      if (isFinite(lat) && isFinite(lng)) wpts.push({ lat, lng, name: pmName });
      return;
    }

    // LineString
    const lsCoords = pm.querySelector('LineString > coordinates')?.textContent?.trim();
    if (lsCoords) {
      lsCoords.split(/\s+/).forEach(c => {
        const [lng, lat] = c.split(',').map(Number);
        if (isFinite(lat) && isFinite(lng)) geometry.push([lat, lng]);
      });
    }

    // gx:Track
    pm.querySelectorAll('gx\\:coord, coord').forEach(el => {
      const parts = el.textContent?.trim().split(' ').map(Number) ?? [];
      if (parts.length >= 2 && isFinite(parts[0]) && isFinite(parts[1]))
        geometry.push([parts[1], parts[0]]);
    });
  });

  let waypoints = wpts;
  if (waypoints.length === 0 && geometry.length > 0) {
    waypoints = sampleWaypoints(geometry);
  }

  return { name, waypoints, geometry: geometry.length > 0 ? geometry : undefined };
}

// ── Échantillonnage automatique ──────────────────────────────
/**
 * Sélectionne N waypoints représentatifs depuis une trace.
 * Algorithme : Ramer-Douglas-Peucker simplifié + premier/dernier.
 * On vise entre 2 et 20 points selon la longueur de la trace.
 */
function sampleWaypoints(
  pts: [number, number][],
): { lat: number; lng: number; name: string | undefined }[] {
  if (pts.length <= 2) {
    return pts.map(([lat, lng]) => ({ lat, lng, name: undefined }));
  }

  // Calcul longueur totale en degrés (approximation rapide)
  let totalLen = 0;
  for (let i = 1; i < pts.length; i++) {
    totalLen += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]);
  }

  // Objectif : 1 point tous les ~10 km environ (≈ 0.09°)
  const targetN = Math.min(20, Math.max(2, Math.round(totalLen / 0.09)));

  // Sous-échantillonnage uniforme
  const step    = (pts.length - 1) / (targetN - 1);
  const result: { lat: number; lng: number; name: string | undefined }[] = [];
  for (let i = 0; i < targetN; i++) {
    const idx = Math.min(Math.round(i * step), pts.length - 1);
    result.push({ lat: pts[idx][0], lng: pts[idx][1], name: undefined });
  }
  return result;
}
