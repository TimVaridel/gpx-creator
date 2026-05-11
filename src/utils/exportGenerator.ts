import type { Waypoint } from '../types/route.types';

export interface ExportOptions {
  format: 'gpx' | 'kml' | 'csv';
  includeStart: boolean;
  includeEnd: boolean;
  includeVia: boolean;
  traceColor: string; // hex 6 caractères sans #, ex: "3b82f6"
}

// ── Helpers ──────────────────────────────────────────────────

function filterWaypoints(waypoints: Waypoint[], opts: ExportOptions): Waypoint[] {
  return waypoints.filter((_, i) => {
    const isStart = i === 0;
    const isEnd   = i === waypoints.length - 1;
    const isVia   = !isStart && !isEnd;
    if (isStart && !opts.includeStart) return false;
    if (isEnd   && !opts.includeEnd)   return false;
    if (isVia   && !opts.includeVia)   return false;
    return true;
  });
}

function hexToKmlColor(hex: string): string {
  // KML = aabbggrr
  const r = hex.slice(0, 2);
  const g = hex.slice(2, 4);
  const b = hex.slice(4, 6);
  return `ff${b}${g}${r}`;
}

// ── GPX ──────────────────────────────────────────────────────

function generateGPX(
  waypoints: Waypoint[],
  geometry: [number, number][] | undefined,
  routeName: string,
  opts: ExportOptions,
): string {
  const filtered = filterWaypoints(waypoints, opts);
  const trackPoints = geometry && geometry.length > 0 ? geometry : null;

  const wptTags = filtered.map(wp => `
  <wpt lat="${wp.lat}" lon="${wp.lng}">
    <name>${wp.name ?? ''}</name>
  </wpt>`).join('');

  const trkpts = trackPoints
    ? trackPoints.map(([lat, lng]) => `\n      <trkpt lat="${lat}" lon="${lng}"></trkpt>`).join('')
    : filtered.map(wp => `\n      <trkpt lat="${wp.lat}" lon="${wp.lng}"></trkpt>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RouteApp"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${routeName}</name></metadata>
  ${wptTags}
  <trk>
    <name>${routeName}</name>
    <extensions><color>#${opts.traceColor}</color></extensions>
    <trkseg>${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

// ── KML ──────────────────────────────────────────────────────

function generateKML(
  waypoints: Waypoint[],
  geometry: [number, number][] | undefined,
  routeName: string,
  opts: ExportOptions,
): string {
  const filtered = filterWaypoints(waypoints, opts);
  const trackPoints = geometry && geometry.length > 0 ? geometry : null;
  const kmlColor = hexToKmlColor(opts.traceColor);

  const placemarks = filtered.map(wp => `
    <Placemark>
      <name>${wp.name ?? ''}</name>
      <Point><coordinates>${wp.lng},${wp.lat},0</coordinates></Point>
    </Placemark>`).join('');

  const coords = trackPoints
    ? trackPoints.map(([lat, lng]) => `${lng},${lat},0`).join('\n          ')
    : filtered.map(wp => `${wp.lng},${wp.lat},0`).join('\n          ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${routeName}</name>
    <Style id="routeStyle">
      <LineStyle><color>${kmlColor}</color><width>4</width></LineStyle>
    </Style>
    ${placemarks}
    <Placemark>
      <name>Trace</name>
      <styleUrl>#routeStyle</styleUrl>
      <LineString>
        <coordinates>
          ${coords}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}

// ── CSV ──────────────────────────────────────────────────────

function generateCSV(
  waypoints: Waypoint[],
  geometry: [number, number][] | undefined,
  opts: ExportOptions,
): string {
  const lines = ['lat,lng,type,name'];
  const filtered = filterWaypoints(waypoints, opts);

  filtered.forEach((wp, i) => {
    const isStart = waypoints.indexOf(wp) === 0;
    const isEnd   = waypoints.indexOf(wp) === waypoints.length - 1;
    const type = isStart ? 'start' : isEnd ? 'end' : 'via';
    lines.push(`${wp.lat},${wp.lng},${type},${wp.name ?? ''}`);
  });

  const trackPoints = geometry && geometry.length > 0 ? geometry : null;
  if (trackPoints) {
    trackPoints.forEach(([lat, lng]) => lines.push(`${lat},${lng},track,`));
  }

  return lines.join('\n');
}

// ── Export principal ─────────────────────────────────────────

export function generateExport(
  waypoints: Waypoint[],
  geometry: [number, number][] | undefined,
  routeName: string,
  opts: ExportOptions,
): void {
  let content = '';
  let mime = '';
  let ext = '';

  switch (opts.format) {
    case 'gpx':
      content = generateGPX(waypoints, geometry, routeName, opts);
      mime = 'application/gpx+xml';
      ext = 'gpx';
      break;
    case 'kml':
      content = generateKML(waypoints, geometry, routeName, opts);
      mime = 'application/vnd.google-earth.kml+xml';
      ext = 'kml';
      break;
    case 'csv':
      content = generateCSV(waypoints, geometry, opts);
      mime = 'text/csv';
      ext = 'csv';
      break;
  }

  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${routeName}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
