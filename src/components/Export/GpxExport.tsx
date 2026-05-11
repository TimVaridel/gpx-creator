import type { Waypoint } from '../../types/route.types';
import { downloadGPX } from '../../utils/gpxGenerator';

interface GpxExportProps {
  waypoints: Waypoint[];
  routeName: string;
  routeGeometry?: [number, number][];
}

const GpxExport = ({ waypoints, routeName, routeGeometry }: GpxExportProps) => {
  const hasGeometry = routeGeometry && routeGeometry.length > 0;

  const handleExport = () => {
    if (waypoints.length < 2) {
      alert('Ajoute au moins 2 points pour exporter un itinéraire !');
      return;
    }
    downloadGPX(waypoints, routeName, routeGeometry);
  };

  return (
    <button
      onClick={handleExport}
      disabled={waypoints.length < 2}
      className={`
        w-full py-3 px-4 rounded-lg font-semibold text-sm
        transition-all duration-200 flex items-center justify-center gap-2
        ${waypoints.length >= 2
          ? 'bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg'
          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }
      `}
    >
      <span>⬇️</span>
      {hasGeometry ? 'Exporter GPX (trace calculée)' : 'Exporter GPX (points uniquement)'}
    </button>
  );
};

export default GpxExport;
