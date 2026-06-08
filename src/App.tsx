import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminPage from './pages/AdminPage';
import MapView from './components/Map/MapView';
import type { MapViewHandle } from './components/Map/MapView';
import WaypointList from './components/Sidebar/WaypointList';
import PlaceSearch from './components/Sidebar/PlaceSearch';
import ExportModal from './components/Export/ExportModal';
import PlanningModal from './components/Planning/PlanningModal';
import ImportButton from './components/Sidebar/ImportButton';
import SavedPlacesMenu from './components/Sidebar/SavedPlacesMenu';
import { useRoute } from './hooks/useRoute';
import { useGroups, useGroupMetrics } from './store/routeStore';
import { generateExport } from './utils/exportGenerator';
import type { ParsedRoute } from './services/importParser';
import type { Group } from './types/route.types';
import type { SavedPlaceCategory } from './types/savedPlace.types';
import { SAVED_PLACE_CATEGORIES } from './types/savedPlace.types';

export type MapLayer =
  | 'osm'
  | 'google-road'
  | 'google-hybrid'
  | 'google-terrain'
  | 'swisstopo'
  | 'swisstopo-gray'
  | 'swisstopo-imagery';

// ── Mode d'insertion ────────────────────────────────────────
type InsertMode = 'start' | 'via' | 'end';

/**
 * Calcule l'index d'insertion dans la liste des waypoints
 * selon le mode sélectionné. Fonction centralisée — utilisée
 * par tous les chemins d'insertion (recherche, lieux enregistrés).
 */
function getInsertIndex(mode: InsertMode, waypointCount: number): number {
  switch (mode) {
    case 'start': return 0;
    case 'end':   return waypointCount;
    case 'via':
    default:      return Math.max(1, waypointCount > 1 ? waypointCount - 1 : waypointCount);
  }
}

// ── Catégories filtrées dans la barre de boutons ────────────
// On affiche les 4 catégories nommées (pas la catégorie vide '')
const FILTER_CATEGORIES = SAVED_PLACE_CATEGORIES.filter(c => c.value !== '');

// ── Shell de routage ────────────────────────────────────────
function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-100">
        <div className="text-sm text-gray-500 animate-pulse">Chargement…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/*" element={
        <ProtectedRoute><MainApp /></ProtectedRoute>
      } />
    </Routes>
  );
}

// ── Application principale (authentifiée) ────────────────────
function MainApp() {
  const { user, profile, signOut } = useAuth();

  const {
    route,
    isCalculating,
    autoCalculate,
    setAutoCalculate,
    triggerCalculate,
    segmentDistances,
    segmentDurations,
    insertWaypoint,
    insertDirectWaypoint,
    removeWaypoint,
    updateWaypointPosition,
    moveWaypoint,
    setWaypoints,
    renameRoute,
    clearRoute,
    clearGeometry,
    reverseRoute,
    importRoute,
  } = useRoute();

  // ── Groupes (nouveau système unifié) ──────────────────────────
  const {
    groups,
    addGroup,
    removeGroup,
    updateGroup,
    rebaseGroups,
    extendGroup,
    toggleGroupExpanded,
    removeWaypointFromGroup,
    resetAllDurations,
    splitGroup,
  } = useGroups();

  const { groupMetrics } = useGroupMetrics(
    groups,
    segmentDistances,
    route.waypoints,
  );

  const [isEditingName,     setIsEditingName]     = useState(false);
  const [showExportModal,   setShowExportModal]    = useState(false);
  const [showPlanningModal, setShowPlanningModal]  = useState(false);
  const [showAddVia,        setShowAddVia]         = useState(false);
  const [mapLayer,          setMapLayer]           = useState<MapLayer>('osm');
  const [showTraffic,       setShowTraffic]        = useState(false);
  const [sidebarOpen,       setSidebarOpen]        = useState(true);
  const [sidebarWide,       setSidebarWide]        = useState(false);
  const [maxSpeed,                setMaxSpeed]           = useState<number>(60);
  const [segmentSpeeds,           setSegmentSpeeds]      = useState<number[]>([]);
  const [manualSegmentDuration,   setManualSegmentDuration] = useState<(number | null)[]>([]);
  const [segmentPause,            setSegmentPause]            = useState<number[]>([]);
  const [segmentRemark,           setSegmentRemark]           = useState<string[]>([]);
  const [showMapMenu,             setShowMapMenu]             = useState(false);
  const [showExceptionalRoutes,   setShowExceptionalRoutes]   = useState(false);

  // ── Mode d'insertion (Fonctionnalité 3) ──────────────────
  const [insertMode, setInsertMode] = useState<InsertMode>('via');

  // ── Menus lieux enregistrés (Fonctionnalité 2) ───────────
  type OpenMenu = 'all' | SavedPlaceCategory;
  const [openMenu,  setOpenMenu]  = useState<OpenMenu | null>(null);
  const [anchorEl,  setAnchorEl]  = useState<HTMLElement | null>(null);

  const toggleMenu = useCallback((key: OpenMenu, el: HTMLElement) => {
    setOpenMenu(prev => {
      if (prev === key) { setAnchorEl(null); return null; }
      setAnchorEl(el);
      return key;
    });
  }, []);

  // ── Ref vers l'API impérative de la carte ────────────────
  const mapRef = useRef<MapViewHandle>(null);

  const pendingFlyTo = useRef<{ lat: number; lng: number } | null>(null);

  const flyToAfterInsert = useCallback((lat: number, lng: number) => {
    if (autoCalculate) {
      pendingFlyTo.current = { lat, lng };
    } else {
      mapRef.current?.flyToPoint(lat, lng, 14);
    }
  }, [autoCalculate]);

  const handleWaypointClick = useCallback((lat: number, lng: number) => {
    mapRef.current?.flyToPoint(lat, lng, 15);
  }, []);

  // Wrapper qui injecte segmentDistances dans updateGroup
  const handleUpdateGroup = useCallback((
    groupId: string, patch: Partial<Group>,
  ) => {
    updateGroup(groupId, patch, segmentDistances);
  }, [updateGroup, segmentDistances]);

  // Déplacement d'un bloc de waypoints (groupe)
  const handleMoveGroup = useCallback((
    fromIndex: number, toIndex: number, count: number,
  ) => {
    const newWps = [...route.waypoints];
    const moved = newWps.splice(fromIndex, count);
    newWps.splice(toIndex, 0, ...moved);
    setWaypoints(newWps);
    rebaseGroups(route.waypoints, newWps);
  }, [route.waypoints, setWaypoints, rebaseGroups]);

  useEffect(() => {
    if (!pendingFlyTo.current) return;
    if (route.routeGeometry && route.routeGeometry.length > 0) {
      mapRef.current?.fitRoute(route.routeGeometry);
      pendingFlyTo.current = null;
    }
  }, [route.routeGeometry]);

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

  const formatDurationFromSpeed = (distKm: number, speedKmh: number) => {
    if (!distKm || distKm <= 0 || speedKmh <= 0) return null;
    const totalSeconds = (distKm / speedKmh) * 3600;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
  };

  const formatDurationHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
  };

  // Stats cumulées globales (groupes + segments individuels)
  const totalPlannedDuration = useMemo(() => {
    let total = groupMetrics.reduce((sum, g) => sum + g.durationH, 0);
    for (let i = 1; i < route.waypoints.length; i++) {
      // Si ce segment est dans un groupe, déjà compté
      const inGroup = groups.some(g => i > g.fromWpIndex && i <= g.toWpIndex);
      if (inGroup) continue;

      const distKm = segmentDistances?.[i] ?? 0;
      if (distKm <= 0) continue;

      const manual = manualSegmentDuration[i];
      if (manual !== null && manual !== undefined) {
        total += manual;
      } else {
        const speed = segmentSpeeds[i] ?? maxSpeed;
        total += distKm / speed;
      }
    }
    return total;
  }, [groupMetrics, groups, segmentDistances, manualSegmentDuration, segmentSpeeds, maxSpeed, route.waypoints.length]);

  const totalDistKm = parseFloat(distanceKm);
  const avgSpeed = totalPlannedDuration > 0 && totalDistKm > 0
    ? Math.round(totalDistKm / totalPlannedDuration * 10) / 10
    : null;

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

  // ── Suppression d'un waypoint (avec rebase des groupes) ───
  const handleRemoveWaypoint = useCallback((id: string) => {
    const oldWps = route.waypoints;
    removeWaypoint(id);
    const newWps = oldWps.filter(wp => wp.id !== id);
    rebaseGroups(oldWps, newWps);
  }, [route.waypoints, removeWaypoint, rebaseGroups]);

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

  // ── Vitesses et durées par segment ───────────────────────
  const handleSegmentSpeedChange = (index: number, speed: number) => {
    setSegmentSpeeds(prev => {
      const next = [...prev];
      next[index] = speed;
      return next;
    });
    setManualSegmentDuration(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const handleSegmentDurationChange = (index: number, durationH: number) => {
    setManualSegmentDuration(prev => {
      const next = [...prev];
      next[index] = durationH;
      return next;
    });
    // Recalculer la vitesse (arrondie sans virgule)
    const distKm = segmentDistances?.[index] ?? 0;
    if (distKm > 0 && durationH > 0) {
      const newSpeed = Math.round(distKm / durationH);
      setSegmentSpeeds(prev => {
        const next = [...prev];
        next[index] = Math.max(1, newSpeed);
        return next;
      });
    }
  };

  const handleSegmentPauseChange = (index: number, pauseH: number) => {
    setSegmentPause(prev => {
      const next = [...prev];
      next[index] = pauseH;
      return next;
    });
  };

  const handleSegmentRemarkChange = (index: number, remark: string) => {
    setSegmentRemark(prev => {
      const next = [...prev];
      next[index] = remark;
      return next;
    });
  };

  // Réinitialiser toutes les durées personnalisées
  const handleResetAll = useCallback(() => {
    resetAllDurations(maxSpeed);
    setManualSegmentDuration([]);
    setSegmentPause([]);
    setSegmentRemark([]);
    const speeds = route.waypoints.map((_, i) => i > 0 ? maxSpeed : 0);
    setSegmentSpeeds(speeds);
  }, [resetAllDurations, maxSpeed, route.waypoints.length]);

  // ── Insertion depuis lieux enregistrés ou recherche ──────
  // Callback unique, utilise getInsertIndex()
  const handlePlaceSelect = useCallback((lat: number, lng: number) => {
    const idx = getInsertIndex(insertMode, route.waypoints.length);
    insertWaypoint(lat, lng, idx);
    flyToAfterInsert(lat, lng);
  }, [insertMode, route.waypoints.length, insertWaypoint, flyToAfterInsert]);

  const sidebarWidth   = sidebarWide ? 432 : 288;
  const hasGeometry    = !!route.routeGeometry?.length;
  const duration       = formatDuration(route.duration);

  // ── Labels des boutons toggle ────────────────────────────
  const INSERT_MODES: { mode: InsertMode; label: string; title: string }[] = [
    { mode: 'start', label: 'Départ',       title: 'Insérer en première position' },
    { mode: 'via',   label: 'Intermédiaire', title: 'Insérer en avant-dernière position' },
    { mode: 'end',   label: 'Arrivée',       title: 'Insérer en dernière position' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">

      {/* ── Sidebar gauche ── */}
      <aside className={`relative bg-white shadow-lg flex flex-col z-10 transition-all duration-300 ${sidebarOpen ? (sidebarWide ? 'w-[432px]' : 'w-72') : 'w-0 overflow-hidden'}`}>

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

        {/* Utilisateur connecté + admin + déconnexion */}
        <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between gap-1">
          <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
            {user?.email}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {profile?.is_admin && (
              <Link
                to="/admin"
                className="text-[9px] text-indigo-500 hover:text-indigo-700
                           border border-dashed border-indigo-200 rounded px-1.5 py-0.5
                           hover:bg-indigo-50 transition-colors"
              >
                Admin
              </Link>
            )}
            <button
              onClick={signOut}
              className="text-[9px] text-red-400 hover:text-red-600
                         border border-dashed border-red-200 rounded px-1.5 py-0.5
                         hover:bg-red-50 transition-colors"
              title="Se déconnecter"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Stats compactes */}
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-green-50 rounded px-1 py-1">
              <span className="text-xs font-bold text-green-600">{distanceKm}</span>
              <span className="text-[10px] text-gray-500">km</span>
            </div>
            {duration && (
              <div className="flex items-center gap-1 bg-purple-50 rounded px-1 py-1">
                <span className="text-xs font-semibold text-purple-600">{duration}</span>
              </div>
            )}
            {isCalculating && (
              <span className="text-[10px] text-yellow-600 bg-yellow-50 rounded px-2 py-1 animate-pulse">
                ⏳ Calcul…
              </span>
            )}
            <div className="flex items-center gap-1 bg-orange-50 rounded px-1 py-1">
              <span className="text-xs font-semibold text-orange-600">
                {formatDurationFromSpeed(parseFloat(distanceKm), maxSpeed) ?? '—'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={300}
                value={maxSpeed === 0 ? '' : maxSpeed}
                onChange={e => setMaxSpeed(Math.max(0, Number(e.target.value)))}
                className="w-11 border border-gray-300 rounded px-1 py-0.5 text-xs text-center
                           focus:outline-none focus:border-orange-400"
              />
              <span className="text-[10px] text-gray-500">km/h</span>
            </div>
          </div>
          {/* Stats groupes : durée cumulée + vitesse moyenne */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-indigo-50 rounded px-1 py-1">
              <span className="text-[10px] font-semibold text-indigo-600">
                {formatDurationHours(totalPlannedDuration)}
              </span>
              <span className="text-[9px] text-gray-500">plan.</span>
            </div>
            {avgSpeed !== null && (
              <div className="flex items-center gap-1 bg-teal-50 rounded px-1 py-1">
                <span className="text-[10px] font-semibold text-teal-600">{avgSpeed}</span>
                <span className="text-[9px] text-gray-500">km/h moy.</span>
              </div>
            )}
            <button
              onClick={handleResetAll}
              className="ml-auto text-[9px] text-indigo-400 hover:text-indigo-600
                         border border-dashed border-indigo-200 rounded px-1
                         hover:bg-indigo-100 transition-colors"
              title="Réinitialiser toutes les durées personnalisées"
            >
              ↺ Reset durées
            </button>
          </div>
        </div>

        {/* Contrôles calcul */}
        <div className="flex items-center gap-1.5 px-1 py-1 border-b border-gray-200">
          <button
            onClick={() => setAutoCalculate(v => !v)}
            className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
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
              className="flex-1 py-1 rounded text-xs font-medium
                         bg-green-500 text-white hover:bg-green-600
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCalculating ? '⏳…' : '▶ Calculer'}
            </button>
          )}
        </div>

        {/* Liste des waypoints */}
        <div className="flex-1 overflow-y-auto px-1 py-0.5">
          <WaypointList
            waypoints={route.waypoints}
            groups={groupMetrics}
            onRemove={handleRemoveWaypoint}
            onReorder={(fromIndex, toIndex) => {
              const oldWps = [...route.waypoints];
              const newWps = [...oldWps];
              const [moved] = newWps.splice(fromIndex, 1);
              newWps.splice(toIndex, 0, moved);
              moveWaypoint(fromIndex, toIndex);
              rebaseGroups(oldWps, newWps);
            }}
            onUpdatePosition={updateWaypointPosition}
            onSetStart={(lat, lng) => insertWaypoint(lat, lng, 0)}
            onSetEnd={(lat, lng) => insertWaypoint(lat, lng, route.waypoints.length)}
            segmentDistances={segmentDistances}
            segmentDurations={segmentDurations}
            segmentSpeeds={segmentSpeeds}
            manualSegmentDuration={manualSegmentDuration}
            onSegmentSpeedChange={handleSegmentSpeedChange}
            onSegmentDurationChange={handleSegmentDurationChange}
            onAddGroup={addGroup}
            onRemoveGroup={removeGroup}
            onUpdateGroup={handleUpdateGroup}
            onMoveGroup={handleMoveGroup}
            onExtendGroup={extendGroup}
            onToggleGroupExpanded={toggleGroupExpanded}
            onRemoveWaypointFromGroup={removeWaypointFromGroup}
            onSplitGroup={splitGroup}
            onWaypointClick={handleWaypointClick}
            compact={!sidebarWide}
          />
        </div>

        {/* ── Zone d'insertion ── */}
        <div className="px-1 pb-1 border-t border-gray-100 pt-1 space-y-1">

          {/* Boutons toggle mode d'insertion (Fonctionnalité 3) */}
          <div className="flex gap-1">
            {INSERT_MODES.map(({ mode, label, title }) => (
              <button
                key={mode}
                onClick={() => setInsertMode(mode)}
                title={title}
                className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors border
                  ${insertMode === mode
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Recherche de point / Boutons lieux enregistrés (Fonctionnalité 2) */}
          {showAddVia ? (
            <PlaceSearch
              placeholder="Rechercher un point de passage…"
              onSelect={r => {
                handlePlaceSelect(r.lat, r.lng);
                setShowAddVia(false);
              }}
              onCancel={() => setShowAddVia(false)}
            />
          ) : (
            <div className="flex gap-1 flex-wrap">

              {/* Ajouter un point de passage */}
              <button
                onClick={() => setShowAddVia(true)}
                className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium
                           bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200
                           transition-colors flex items-center justify-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="whitespace-nowrap">Point</span>
              </button>

              {/* Tous les lieux enregistrés */}
              <button
                onClick={e => toggleMenu('all', e.currentTarget)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors flex-shrink-0
                  ${openMenu === 'all'
                    ? 'bg-yellow-400 text-white border-yellow-400'
                    : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border-yellow-200'
                  }`}
                title="Tous les lieux enregistrés"
              >
                ✅
              </button>

              {/* Boutons filtrés par catégorie (Fonctionnalité 2) */}
              {FILTER_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={e => toggleMenu(cat.value as SavedPlaceCategory, e.currentTarget)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors flex-shrink-0
                    ${openMenu === cat.value
                      ? 'bg-yellow-400 text-white border-yellow-400'
                      : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200'
                    }`}
                  title={cat.label}
                >
                  {cat.emoji}
                </button>
              ))}
            </div>
          )}

          {/* Menu lieux enregistrés (portal) */}
          {openMenu !== null && (
            <SavedPlacesMenu
              anchorEl={anchorEl}
              onSelect={(lat, lng) => handlePlaceSelect(lat, lng)}
              onClose={() => setOpenMenu(null)}
              categoryFilter={openMenu === 'all' ? undefined : (openMenu as SavedPlaceCategory)}
            />
          )}
        </div>

        {/* ── Actions compactées (Fonctionnalité 4) ── */}
        <div className="p-1.5 border-t border-gray-200 space-y-1">

          {/* Ligne 1 : Import | Planning | Export */}
          <div className="grid grid-cols-3 gap-1">
            <ImportButton onImport={handleImport} />
            <button
              onClick={() => setShowPlanningModal(true)}
              disabled={route.waypoints.length < 2}
              className={`py-1.5 px-1 rounded-lg font-semibold text-xs
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
              className={`py-1.5 px-1 rounded-lg font-semibold text-xs
                transition-all flex items-center justify-center gap-1
                ${route.waypoints.length >= 2
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              ⚙️ Export
            </button>
          </div>

          {/* Ligne 2 : Inverser | Suppr. trace | Effacer */}
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={reverseRoute}
              disabled={route.waypoints.length < 2}
              className="py-1.5 px-1 rounded-lg text-xs font-medium
                         text-blue-600 bg-blue-50 hover:bg-blue-100
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              🔄 Inverser
            </button>
            <button
              onClick={clearGeometry}
              disabled={!hasGeometry}
              className="py-1.5 px-1 rounded-lg text-xs font-medium
                         text-orange-600 bg-orange-50 hover:bg-orange-100
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ✂️ Trace
            </button>
            <button
              onClick={() => { if (confirm("Effacer tout l'itinéraire ?")) clearRoute(); }}
              disabled={route.waypoints.length === 0}
              className="py-1.5 px-1 rounded-lg text-xs font-medium
                         text-gray-600 bg-gray-100 hover:bg-gray-200
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              🗑️ Effacer
            </button>
          </div>
        </div>
      </aside>

      {/* Boutons toggle sidebar + largeur */}
      <div className="fixed top-20 z-[1000] flex gap-0.5 transition-all duration-300"
           style={{ left: sidebarOpen ? sidebarWidth : 8 }}>
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="w-7 h-7 bg-white border border-gray-300 rounded shadow-md
                     flex items-center justify-center text-gray-600
                     hover:text-blue-500 hover:bg-blue-50 transition-colors"
          title={sidebarOpen ? 'Réduire le panneau' : 'Ouvrir le panneau'}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
        {sidebarOpen && (
          <button
            onClick={() => setSidebarWide(w => !w)}
            className="w-7 h-7 bg-white border border-gray-300 rounded shadow-md
                       flex items-center justify-center text-xs font-bold
                       hover:text-blue-500 hover:bg-blue-50 transition-colors"
            title={sidebarWide ? 'Largeur normale' : 'Largeur agrandie (×1.5)'}
          >
            ↔️
          </button>
        )}
      </div>

      {/* Bouton fond de carte flottant */}
      <div className="fixed top-28 z-[1000] transition-all duration-300"
           style={{ left: sidebarOpen ? sidebarWidth : 8 }}>
        <button
          onClick={() => setShowMapMenu(v => !v)}
          className={`w-7 h-7 border rounded shadow-md flex items-center justify-center
                      text-sm transition-colors
                      ${showMapMenu
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-gray-300 text-gray-600 hover:text-blue-500 hover:bg-blue-50'
                      }`}
          title="Fond de carte"
        >
          🗺
        </button>

        {showMapMenu && (
          <div
            className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg
                        shadow-xl p-2 space-y-1 w-44"
            onMouseLeave={() => setShowMapMenu(false)}
          >
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide px-1 pb-0.5">
              Fond de carte
            </p>
            {(
              [
                { id: 'osm',               label: '🗺 OpenStreetMap' },
                { id: 'google-road',       label: '🛣 Google Route' },
                { id: 'google-hybrid',     label: '🛰 Google Hybrid' },
                { id: 'google-terrain',    label: '⛰ Google Terrain' },
                { id: 'swisstopo',         label: '🏞 Swisstopo' },
                { id: 'swisstopo-gray',    label: '⬜ Swisstopo Gray' },
                { id: 'swisstopo-imagery', label: '📷 Swisstopo Imagery' },
              ] as { id: MapLayer; label: string }[]
            ).map(opt => (
              <button
                key={opt.id}
                onClick={() => { setMapLayer(opt.id); setShowMapMenu(false); }}
                className={`w-full text-left py-1 px-2 rounded text-[11px] font-medium transition-colors ${
                  mapLayer === opt.id
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="border-t border-gray-100 pt-1">
              <button
                onClick={() => setShowTraffic(v => !v)}
                className={`w-full text-left py-1 px-2 rounded text-[11px] font-medium
                            transition-colors flex items-center gap-1.5
                  ${showTraffic
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <span>🚦</span>
                <span>Trafic {showTraffic ? 'ON' : 'OFF'}</span>
              </button>
              <button
                onClick={() => setShowExceptionalRoutes(v => !v)}
                className={`w-full text-left py-1 px-2 rounded text-[11px] font-medium
                            transition-colors flex items-center gap-1.5
                  ${showExceptionalRoutes
                    ? 'bg-red-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <span>🚛</span>
                <span>Convois exceptionnels</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Carte ── */}
      <main className="flex-1 relative">
        <MapView
          ref={mapRef}
          waypoints={route.waypoints}
          routeGeometry={route.routeGeometry}
          onMarkerDragEnd={updateWaypointPosition}
          onInsertOnRoute={insertWaypoint}
          onContextMenuAction={handleContextMenuAction}
          mapLayer={mapLayer}
          showTraffic={showTraffic}
          showExceptionalRoutes={showExceptionalRoutes}
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
          routeName={route.name}
        />
      )}

      {/* ── Modal planning ── */}
      {showPlanningModal && (
        <PlanningModal
          waypoints={route.waypoints}
          segmentDistances={segmentDistances}
          groups={groupMetrics}
          onUpdateGroup={handleUpdateGroup}
          onRemoveGroup={removeGroup}
          segmentSpeeds={segmentSpeeds}
          manualSegmentDuration={manualSegmentDuration}
          onSegmentSpeedChange={handleSegmentSpeedChange}
          onSegmentDurationChange={handleSegmentDurationChange}
          segmentPause={segmentPause}
          segmentRemark={segmentRemark}
          onSegmentPauseChange={handleSegmentPauseChange}
          onSegmentRemarkChange={handleSegmentRemarkChange}
          maxSpeed={maxSpeed}
          routeName={route.name}
          onClose={() => setShowPlanningModal(false)}
        />
      )}
    </div>
  );
}

export default App;
