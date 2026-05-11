import type { Waypoint } from '../types/route.types';

export const generateGPX = (
  waypoints: Waypoint[],
  routeName: string
): string => {
  const now = new Date().toISOString();

  const trackPoints = waypoints
    .map(point => `
      <trkpt lat="${point.lat}" lon="${point.lng}">
        ${point.elevation !== undefined
          ? `<ele>${point.elevation}</ele>`
          : ''
        }
        <time>${now}</time>
        ${point.name ? `<name>${point.name}</name>` : ''}
      </trkpt>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
  creator="MonAppGPX"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1
    http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${routeName}</name>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>${routeName}</name>
    <trkseg>
      ${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
};

export const downloadGPX = (
  waypoints: Waypoint[],
  routeName: string
): void => {
  const content = generateGPX(waypoints, routeName);
  const blob = new Blob([content], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${routeName.replace(/\s+/g, '_')}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
