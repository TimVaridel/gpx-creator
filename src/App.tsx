import { useState } from 'react';
import MapView from './components/Map/MapView';
import WaypointList from './components/Sidebar/WaypointList';
import PlaceSearch from './components/Sidebar/PlaceSearch';
import ExportModal from './components/Export/ExportModal';
import PlanningModal from './components/Planning/PlanningModal';
import ImportButton from './components/Sidebar/ImportButton';
import { useRoute } from './hooks/useRoute';
import { generateExport } from './utils/exportGenerator';
import type { ExportOptions } from './utils/exportGenerator';
import type { ParsedRoute } from './services/importParser';

export type MapLayer = 'osm' | 'google-road' | 'google-hybrid' | 'google-terrain';

function App() {
  const {
    route,
    isCalculating,
    autoCalculate,
    setAutoCalculate,
    triggerCalculate,
    segmentDistances,
    insertWaypoint,
    insertDirectWaypoint,
    removeWaypoint,
    updateWaypointPosition,
    moveWaypoint,
    renameRoute,
    clearRoute,
    clearGeometry,
    reverseRoute,
    importRoute,
  } = useRoute();

  const [isEditingName,     setIsEditingName]     = useState(false);
  const [showExportModal,   setShowExportModal]    = useState(false);
  const [showPlanningModal, setShowPlanningModal]  = useState(false);
  const [showAddVia,        setShowAddVia]         = useState(false);
  const [mapLayer,          setMapLayer]           = useState<MapLayer>('osm');
  const [showTraffic,       setShowTraffic]        = useState(false);

  // ── Stats ────────────────────────────────────────────────
  const distanceKm = route.totalDistance
    ? (route.totalDistance / 1000).toFixed(1)
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
      case 'start':      insertWaypoint(lat, lng, 0); break;
      case 'end':        insertWaypoint(lat, lng, route.waypoints.length); break;
      case 'via':        insertWaypoint(lat, lng, Math.max(1, route.waypoints.length - 1)); break;
      case 'via-direct': insertDirectWaypoint(lat, lng, Math.max(1, route.waypoints.length - 1)); break;
    }
  };

  // ── Import ───────────────────────────────────────────────
  const handleImport = (parsed: ParsedRoute) => {
    if (
      route.waypoints.length > 0 &&
      !confirm(
        `Remplacer l'itinéraire actuel (${route.waypoints.length} point(s)) par « ${parsed.name} » ?`,
      )
    ) return;
    importRoute(parsed.name, parsed.waypoints, parsed.geometry);
  };

  const hasGeometry = !!route.routeGeometry?.length;
  const duration    = formatDuration(route.duration);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">

      {/* ── Sidebar gauche ── */}
      <aside className="w-72 bg-white shadow-lg flex flex-col z-10">

        {/* Header compact */}
        <div className="bg-blue-600 text-white px-3 py-2.5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold leading-tight">🗺️ GPX Creator</h1>
            <p className="text-blue-200 text-[10px]">Clic droit sur la carte pour ajouter</p>
          </div>
        </div>

        {/* Nom de l'itinéraire */}
        <div className="px-3 py-2 border-b border-gray-200">
          {isEditingName ? (
            <input
              type="text"
              value={route.name}
              onChange={e => renameRoute(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={e => e.key === 'Enter' && setIsEditingName(false)}
              className="w-full border border-blue-400 rounded px-2 py-1
                         text-xs font-medium focus:outline-none"
              autoFocus
            />
          ) : (
            <div
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => setIsEditingName(true)}
            >
              <span className="font-medium text-gray-800 text-xs truncate">
                {route.name}
              </span>
              <span className="text-gray-400 group-hover:text-blue-500 text-xs ml-2 flex-shrink-0">
                ✏️
              </span>
            </div>
          )}
        </div>

        {/* Stats compactes */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-1 bg-blue-50 rounded px-2 py-1">
            <span className="text-sm font-bold text-blue-600">{route.waypoints.length}</span>
            <span className="text-[10px] text-gray-500">pts</span>
          </div>
          <div className="flex items-center gap-1 bg-green-50 rounded px-2 py-1">
            <span className="text-sm font-bold text-green-600">{distanceKm}</span>
            <span className="text-[10px] text-gray-500">km</span>
          </div>
          {duration && (
            <div className="flex items-center gap-1 bg-purple-50 rounded px-2 py-1">
              <span className="text-xs font-semibold text-purple-600">🕐 {duration}</span>
            </div>
          )}
          {isCalculating && (
            <span className="text-[10px] text-yellow-600 bg-yellow-50 rounded px-2 py-1 animate-pulse">
              ⏳ Calcul…
            </span>
          )}
        </div>

        {/* Contrôles calcul */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-200">
          <button
            onClick={() => setAutoCalculate(v => !v)}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
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
              className="flex-1 py-1.5 rounded text-xs font-medium
                         bg-green-500 text-white hover:bg-green-600
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCalculating ? '⏳…' : '▶ Calculer'}
            </button>
          )}
        </div>

        {/* Sélecteur fond de carte */}
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Fond de carte</p>
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                { id: 'osm',            label: '🗺 OpenStreetMap' },
                { id: 'google-road',    label: '🛣 Google Route' },
                { id: 'google-hybrid',  label: '🛰 Google Hybrid' },
                { id: 'google-terrain', label: '⛰ Google Terrain' },
              ] as { id: MapLayer; label: string }[]
            ).map(opt => (
              <button
                key={opt.id}
                onClick={() => setMapLayer(opt.id)}
                className={`py-1 px-1.5 rounded text-[10px] font-medium text-left transition-colors ${
                  mapLayer === opt.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Toggle trafic */}
          <button
            onClick={() => setShowTraffic(v => !v)}
            className={`w-full py-1 px-2 rounded text-[10px] font-medium transition-colors flex items-center gap-1.5 ${
              showTraffic
                ? 'bg-orange-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>🚦</span>
            <span>Trafic Google {showTraffic ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Liste des waypoints */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <WaypointList
            waypoints={route.waypoints}
            onRemove={removeWaypoint}
            onReorder={moveWaypoint}
            onUpdatePosition={updateWaypointPosition}
            onSetStart={(lat, lng) => insertWaypoint(lat, lng, 0)}
            onSetEnd={(lat, lng) => insertWaypoint(lat, lng, route.waypoints.length)}
            segmentDistances={segmentDistances}
          />
        </div>

        {/* Bouton Ajouter un point de passage */}
        <div className="px-2 pb-1 border-t border-gray-100 pt-2">
          {showAddVia ? (
            <PlaceSearch
              placeholder="Rechercher un point de passage…"
              onSelect={r => {
                insertWaypoint(r.lat, r.lng, Math.max(1, route.waypoints.length > 1 ? route.waypoints.length - 1 : route.waypoints.length));
                setShowAddVia(false);
              }}
              onCancel={() => setShowAddVia(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddVia(true)}
              className="w-full py-1.5 px-2 rounded-lg text-xs font-medium
                         bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200
                         transition-colors flex items-center justify-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                   viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Ajouter un point de passage
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="p-2 border-t border-gray-200 space-y-1.5">

          {/* Import — pleine largeur */}
          <ImportButton onImport={handleImport} />

          {/* Ligne 1 : Planning + Export */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setShowPlanningModal(true)}
              disabled={route.waypoints.length < 2}
              className={`py-2 px-2 rounded-lg font-semibold text-xs
                transition-all flex items-center justify-center gap-1
                ${route.waypoints.length >= 2
                  ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              📅 Planning
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              disabled={route.waypoints.length < 2}
              className={`py-2 px-2 rounded-lg font-semibold text-xs
                transition-all flex items-center justify-center gap-1
                ${route.waypoints.length >= 2
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              ⚙️ Export
            </button>
          </div>

          {/* Ligne 2 : Inverser + Supprimer trace */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={reverseRoute}
              disabled={route.waypoints.length < 2}
              className="py-1.5 px-2 rounded-lg text-xs font-medium
                         text-blue-600 bg-blue-50 hover:bg-blue-100
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              🔄 Inverser
            </button>
            <button
              onClick={clearGeometry}
              disabled={!hasGeometry}
              className="py-1.5 px-2 rounded-lg text-xs font-medium
                         text-orange-600 bg-orange-50 hover:bg-orange-100
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ✂️ Suppr. trace
            </button>
          </div>

          {/* Ligne 3 : Effacer tout */}
          <button
            onClick={() => { if (confirm("Effacer tout l'itinéraire ?")) clearRoute(); }}
            disabled={route.waypoints.length === 0}
            className="w-full py-1.5 px-2 rounded-lg text-xs font-medium
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
          mapLayer={mapLayer}
          showTraffic={showTraffic}
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
          onExport={(opts) => generateExport(route.waypoints, route.routeGeometry, route.name, opts)}
          waypointCount={route.waypoints.length}
          routeName={route.name}   // ← ajouter
        />
      )}


      {/* ── Modal planning ── */}
      {showPlanningModal && (
        <PlanningModal
          waypoints={route.waypoints}
          segmentDistances={segmentDistances}
          routeName={route.name}
          onClose={() => setShowPlanningModal(false)}
        />
      )}
    </div>
  );
}

export default App;
