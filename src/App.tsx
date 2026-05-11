import { useState } from 'react';
import MapView from './components/Map/MapView';
import WaypointList from './components/Sidebar/WaypointList';
import ExportModal from './components/Export/ExportModal';
import { useRoute } from './hooks/useRoute';
import { generateExport } from './utils/exportGenerator';
import type { ExportOptions } from './utils/exportGenerator';

function App() {
  const {
    route,
    isCalculating,
    autoCalculate,
    setAutoCalculate,
    triggerCalculate,
    addWaypoint,
    insertWaypoint,
    insertDirectWaypoint,
    removeWaypoint,
    updateWaypointPosition,
    moveWaypoint,
    renameRoute,
    clearRoute,
    clearGeometry,
    reverseRoute,
  } = useRoute();

  const [isEditingName,    setIsEditingName]    = useState(false);
  const [showExportModal,  setShowExportModal]   = useState(false);

  // ── Stats ────────────────────────────────────────────────
  const distanceKm = route.totalDistance
    ? (route.totalDistance / 1000).toFixed(2)
    : '0';

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
  };

  // ── Clic droit ───────────────────────────────────────────
  const handleContextMenuAction = (
    action: 'start' | 'end' | 'via' | 'via-direct',
    lat: number,
    lng: number,
  ) => {
    switch (action) {
      case 'start':
        // Insère en tête (ou crée le premier point)
        insertWaypoint(lat, lng, 0);
        break;
      case 'end':
        // Ajoute en queue
        insertWaypoint(lat, lng, route.waypoints.length);
        break;
      case 'via':
        // Avant le dernier point
        insertWaypoint(lat, lng, Math.max(1, route.waypoints.length - 1));
        break;
      case 'via-direct':
        // Pareil mais marqué "direct"
        insertDirectWaypoint(lat, lng, Math.max(1, route.waypoints.length - 1));
        break;
    }
  };

  // ── Export ───────────────────────────────────────────────
  const handleExport = (opts: ExportOptions) => {
    generateExport(route.waypoints, route.routeGeometry, route.name, opts);
  };

  const hasGeometry = !!route.routeGeometry?.length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">

      {/* ── Sidebar gauche ── */}
      <aside className="w-80 bg-white shadow-lg flex flex-col z-10">

        {/* Header */}
        <div className="bg-blue-600 text-white p-4">
          <h1 className="text-xl font-bold">🗺️ GPX Creator</h1>
          <p className="text-blue-200 text-xs mt-1">
            Clic droit sur la carte pour ajouter des points
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
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => setIsEditingName(true)}
            >
              <span className="font-medium text-gray-800 text-sm truncate">
                {route.name}
              </span>
              <span className="text-gray-400 group-hover:text-blue-500 text-xs ml-2 flex-shrink-0">
                ✏️
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 p-4 border-b border-gray-200">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{route.waypoints.length}</p>
            <p className="text-xs text-gray-500">points</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{distanceKm} km</p>
            <p className="text-xs text-gray-500">distance</p>
          </div>
          {formatDuration(route.duration) && (
            <div className="col-span-2 bg-purple-50 rounded-lg p-2 text-center">
              <p className="text-sm font-semibold text-purple-600">
                🕐 {formatDuration(route.duration)}
              </p>
            </div>
          )}
        </div>

        {/* Toggle calcul automatique */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
          <button
            onClick={() => setAutoCalculate(v => !v)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              autoCalculate
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {autoCalculate ? '🔄 Auto ON' : '⏸ Auto OFF'}
          </button>
          {!autoCalculate && route.waypoints.length >= 2 && (
            <button
              onClick={triggerCalculate}
              disabled={isCalculating}
              className="flex-1 py-1.5 rounded-lg text-sm font-medium
                         bg-green-500 text-white hover:bg-green-600
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCalculating ? '⏳...' : '▶ Calculer'}
            </button>
          )}
        </div>

        {/* Indicateur de calcul */}
        {isCalculating && (
          <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200
                          text-xs text-yellow-800 text-center">
            ⏳ Calcul de l'itinéraire...
          </div>
        )}

        {/* Liste des waypoints */}
        <div className="flex-1 overflow-y-auto p-4">
          <WaypointList
            waypoints={route.waypoints}
            onRemove={removeWaypoint}
            onReorder={moveWaypoint}
          />
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 space-y-2">

          {/* Bouton export */}
          <button
            onClick={() => setShowExportModal(true)}
            disabled={route.waypoints.length < 2}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-sm
              transition-all flex items-center justify-center gap-2
              ${route.waypoints.length >= 2
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            <span>⚙️</span>
            Options d'export
            {hasGeometry
              ? <span className="text-xs font-normal opacity-80">(trace calculée)</span>
              : <span className="text-xs font-normal opacity-80">(points uniquement)</span>}
          </button>

          {/* Inverser */}
          <button
            onClick={reverseRoute}
            disabled={route.waypoints.length < 2}
            className="w-full py-2 px-4 rounded-lg text-sm font-medium
                       text-blue-600 bg-blue-50 hover:bg-blue-100
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            🔄 Inverser l'itinéraire
          </button>

          {/* Supprimer la trace */}
          <button
            onClick={clearGeometry}
            disabled={!hasGeometry}
            className="w-full py-2 px-4 rounded-lg text-sm font-medium
                       text-orange-600 bg-orange-50 hover:bg-orange-100
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ✂️ Supprimer la trace calculée
          </button>

          {/* Effacer tout */}
          <button
            onClick={() => { if (confirm("Effacer tout l'itinéraire ?")) clearRoute(); }}
            disabled={route.waypoints.length === 0}
            className="w-full py-2 px-4 rounded-lg text-sm font-medium
                       text-gray-600 bg-gray-100 hover:bg-gray-200
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            🗑️ Effacer l'itinéraire
          </button>
        </div>
      </aside>

      {/* ── Carte ── */}
      <main className="flex-1 relative">
        <MapView
          waypoints={route.waypoints}
          routeGeometry={route.routeGeometry}
          onMarkerDragEnd={updateWaypointPosition}
          onInsertOnRoute={insertWaypoint}
          onContextMenuAction={handleContextMenuAction}
        />

        {route.waypoints.length === 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2
                          bg-white rounded-full shadow-lg px-6 py-3
                          text-sm text-gray-600 pointer-events-none animate-bounce">
            👆 Clic droit sur la carte pour commencer
          </div>
        )}
        {route.waypoints.length > 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2
                          bg-white/80 backdrop-blur rounded-full shadow px-4 py-2
                          text-xs text-gray-500 pointer-events-none">
            Clic droit sur la carte pour plus d'options
          </div>
        )}
      </main>

      {/* ── Modal export ── */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          hasGeometry={hasGeometry}
          waypointCount={route.waypoints.length}
        />
      )}
    </div>
  );
}

export default App;
