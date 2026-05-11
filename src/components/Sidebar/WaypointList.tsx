import type { Waypoint } from '../../types/route.types';

interface WaypointListProps {
  waypoints: Waypoint[];
  onRemove: (id: string) => void;
}

const WaypointList = ({ waypoints, onRemove }: WaypointListProps) => {
  if (waypoints.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        <p className="text-4xl mb-2">🗺️</p>
        <p className="text-sm">Clique sur la carte pour</p>
        <p className="text-sm">ajouter des points</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {waypoints.map((wp, index) => (
        <li
          key={wp.id}
          className="flex items-center justify-between bg-gray-50
                     border border-gray-200 rounded-lg px-3 py-2
                     hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            {/* Indicateur départ/arrivée/intermédiaire */}
            <span className={`
              w-6 h-6 rounded-full flex items-center justify-center
              text-xs font-bold text-white
              ${index === 0
                ? 'bg-green-500'
                : index === waypoints.length - 1
                  ? 'bg-red-500'
                  : 'bg-blue-400'
              }
            `}>
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {wp.name}
              </p>
              <p className="text-xs text-gray-400">
                {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
              </p>
            </div>
          </div>
          <button
            onClick={() => onRemove(wp.id)}
            className="text-gray-400 hover:text-red-500
                       transition-colors ml-2 text-lg leading-none"
            title="Supprimer ce point"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
};

export default WaypointList;
