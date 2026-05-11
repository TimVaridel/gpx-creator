import { useState } from 'react';
import MapView from './components/Map/MapView';
import WaypointList from './components/Sidebar/WaypointList';
import GpxExport from './components/Export/GpxExport';
import { useRoute } from './hooks/useRoute';

function App() {
  const {
    route,
    addWaypoint,
    removeWaypoint,
    renameRoute,
    clearRoute,
  } = useRoute();

  const [isEditingName, setIsEditingName] = useState(false);

  const handleMapClick = (lat: number, lng: number) => {
    addWaypoint(lat, lng);
  };

  const handleMarkerClick = (id: string) => {
    if (confirm('Supprimer ce point ?')) {
      removeWaypoint(id);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">

      {/* ── Sidebar gauche ── */}
      <aside className="w-80 bg-white shadow-lg flex flex-col z-10">

        {/* Header */}
        <div className="bg-blue-600 text-white p-4">
          <h1 className="text-xl font-bold">🗺️ GPX Creator</h1>
          <p className="text-blue-200 text-xs mt-1">
            Clique sur la carte pour tracer
          </p>
        </div>

        {/* Nom de l'itinéraire */}
        <div className="p-4 border-b border-gray-200">
          {isEditingName ? (
            <input
              type="text"
              value={route.name}
              onChange={e => renameRoute(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={e => e.key === 'Enter' && setIsEditingName(false)}
              className="w-full border border-blue-400 rounded px-2 py-1
                         text-sm font-medium focus:outline-none"
              autoFocus
            />
          ) : (
            <div
              className="flex items-center justify-between cursor-pointer
                         group"
              onClick={() => setIsEditingName(true)}
            >
              <span className="font-medium text-gray-800 text-sm">
                {route.name}
              </span>
              <span className="text-gray-400 group-hover:text-blue-500
                               text-xs ml-2">
                ✏️
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 p-4 border-b border-gray-200">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {route.waypoints.length}
            </p>
            <p className="text-xs text-gray-500">points</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {route.totalDistance} km
            </p>
            <p className="text-xs text-gray-500">distance</p>
          </div>
        </div>

        {/* Liste des waypoints */}
        <div className="flex-1 overflow-y-auto p-4">
          <WaypointList
            waypoints={route.waypoints}
            onRemove={removeWaypoint}
          />
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <GpxExport
            waypoints={route.waypoints}
            routeName={route.name}
          />
          <button
            onClick={() => {
              if (confirm('Effacer tout l\'itinéraire ?')) clearRoute();
            }}
            disabled={route.waypoints.length === 0}
            className="w-full py-2 px-4 rounded-lg text-sm font-medium
                       text-gray-600 bg-gray-100 hover:bg-gray-200
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
          >
            🗑️ Effacer l'itinéraire
          </button>
        </div>
      </aside>

      {/* ── Carte ── */}
      <main className="flex-1 relative">
        <MapView
          waypoints={route.waypoints}
          onMapClick={handleMapClick}
          onMarkerClick={handleMarkerClick}
        />

        {/* Tooltip d'aide flottant */}
        {route.waypoints.length === 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2
                          bg-white rounded-full shadow-lg px-6 py-3
                          text-sm text-gray-600 pointer-events-none
                          animate-bounce">
            👆 Clique sur la carte pour commencer
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
