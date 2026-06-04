import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Waypoint, Group } from '../../types/route.types';
import type { SavedPlace } from '../../types/savedPlace.types';
import { getAllPlaces } from '../../services/savedPlaces';
import PlaceSearch from './PlaceSearch';
import type { PlaceResult } from '../../services/geocoding';
import SavePlaceModal from './SavePlaceModal';

const DEFAULT_SPEED = 60;

function wpLabel(wp: Waypoint | undefined, idx: number): string {
  if (!wp) return `Point ${idx + 1}`;
  if (wp.locality) return wp.locality;
  if (wp.name)     return wp.name;
  return `Point ${idx + 1}`;
}

function formatDur(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
}

function durFromSpeed(distKm: number, speedKmh: number): string | null {
  if (!distKm || distKm <= 0 || speedKmh <= 0) return null;
  return formatDur((distKm / speedKmh) * 3600);
}

// ── Ligne de groupe (remplace les waypoints masqués) ───────────
interface GroupRowProps {
  group: Group & { distKm: number; durationH: number };
  firstWpName: string;
  lastWpName: string;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Group>) => void;
  onExtend: (id: string, toWpIndex: number) => void;
  onToggleExpand: (id: string) => void;
  waypointCount: number;
}

const GroupRow = ({
  group, firstWpName, lastWpName, onRemove, onUpdate, onExtend, onToggleExpand, waypointCount,
}: GroupRowProps) => {
  const isManual = group.manualDurationH !== null;
  const hasNext = group.toWpIndex < waypointCount - 1;

  return (
    <li className="px-2 py-0.5 select-none">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg overflow-hidden">
        {/* 1e ligne : X–Y, nom, expand, dissoudre */}
        <div className="flex items-center gap-1.5 px-2 py-1">
          <button
            onClick={() => onToggleExpand(group.id)}
            className="text-indigo-400 hover:text-indigo-600 text-sm font-bold w-6 text-center flex-shrink-0 leading-none"
            title={group.expanded ? 'Replier' : 'Déplier'}
          >
            {group.expanded ? '−' : '+'}
          </button>

          <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide flex-shrink-0">
            {group.fromWpIndex + 1}–{group.toWpIndex + 1}
          </span>
          <span className="text-[10px] text-indigo-400 truncate max-w-[200px] flex-1 min-w-0">
            {firstWpName} – {lastWpName}
          </span>

          <button
            onClick={() => onRemove(group.id)}
            className="text-gray-300 hover:text-red-500 transition-colors text-xs leading-none flex-shrink-0 ml-auto"
            title="Dissoudre le groupe"
          >
            ×
          </button>
        </div>

        {/* 2e ligne : distance, durée, vitesse */}
        <div className="flex items-center gap-2 px-2 pb-1.5 pt-0 border-t border-indigo-100">
          <span className="text-[10px] text-blue-400 font-medium">
            {group.distKm.toFixed(1)} km
          </span>
          {group.distKm > 0 && (
            <span className="text-[10px] font-semibold text-purple-500 bg-purple-50
                             border border-purple-200 rounded px-1">
              {formatDur(group.durationH * 3600)}
            </span>
          )}
          {durFromSpeed(group.distKm, group.speedKmh) && (
            <span className="text-[10px] font-semibold text-orange-500 bg-orange-50
                             border border-orange-200 rounded px-1">
              {durFromSpeed(group.distKm, group.speedKmh)}
            </span>
          )}

          <input
            type="number"
            min={0}
            step={0.25}
            value={isManual ? group.manualDurationH! : group.durationH}
            onChange={e => onUpdate(group.id, {
              manualDurationH: Math.max(0, Number(e.target.value)),
            })}
            className={`w-14 border rounded px-1 py-0 text-[10px] text-right
              focus:outline-none focus:border-indigo-400
              ${isManual ? 'border-indigo-300 bg-white' : 'border-gray-200 bg-transparent'}`}
            title="Durée (heures)"
          />
          <span className="text-[9px] text-gray-400">h</span>

          <input
            type="number"
            min={1}
            max={300}
            value={group.speedKmh}
            onChange={e => onUpdate(group.id, {
              speedKmh: Math.max(1, Number(e.target.value)),
            })}
            className="w-10 border border-gray-300 rounded px-1 py-0 text-[10px] text-center
              focus:outline-none focus:border-orange-400"
            title="Vitesse (km/h)"
          />
          <span className="text-[9px] text-gray-400">km/h</span>

          {hasNext && (
            <button
              onClick={() => onExtend(group.id, group.toWpIndex + 1)}
              className="ml-auto text-[9px] text-indigo-400 hover:text-indigo-600
                         border border-dashed border-indigo-200 rounded px-1
                         hover:bg-indigo-100 transition-colors"
              title="Étendre au waypoint suivant"
            >
              + étendre
            </button>
          )}
        </div>
      </div>
    </li>
  );
};

// ── Entrée fantôme (départ ou arrivée non encore défini) ─────
interface GhostRowProps {
  label: string;
  color: string;
  onSearchSelect: (result: PlaceResult) => void;
}

const GhostRow = ({ label, color, onSearchSelect }: GhostRowProps) => {
  const [searching, setSearching] = useState(false);

  return (
    <li className="flex items-center gap-1.5 bg-gray-50 border border-dashed border-gray-300
                   rounded-lg px-2 py-1.5">
      <span className="w-5 flex-shrink-0" />
      <span className={`w-5 h-5 rounded-full flex-shrink-0 border-2 border-white shadow-sm ${color}`} />

      {searching ? (
        <div className="flex-1 min-w-0">
          <PlaceSearch
            placeholder={`Rechercher ${label.toLowerCase()}…`}
            onSelect={r => { onSearchSelect(r); setSearching(false); }}
            onCancel={() => setSearching(false)}
          />
        </div>
      ) : (
        <>
          <span className="flex-1 text-xs text-gray-400 italic">{label}</span>
          <button
            onClick={() => setSearching(true)}
            className="text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0"
            title={`Rechercher ${label.toLowerCase()}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" />
            </svg>
          </button>
        </>
      )}
    </li>
  );
};

// ── Item waypoint existant ───────────────────────────────────
interface SortableItemProps {
  waypoint: Waypoint;
  index: number;
  total: number;
  onRemove: (id: string) => void;
  onUpdatePosition: (id: string, lat: number, lng: number) => void;
  onSavePlace: (waypoint: Waypoint) => void;
  distFromPrev?: number;
  durFromPrev?: number;
  segSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  isInGroup?: boolean;
  showSegmentConnector?: boolean;
  isGroupBoundary?: boolean;
  onRemoveFromGroup?: () => void;
  onAddGroup?: (fromWpIndex: number, toWpIndex: number) => void;
  onWaypointClick?: (lat: number, lng: number) => void;
  compact?: boolean;
  savedPlaceName?: string;
}

const SortableItem = ({
  waypoint, index, total, onRemove, onUpdatePosition, onSavePlace,
  distFromPrev, durFromPrev, segSpeed, onSpeedChange, isInGroup,
  showSegmentConnector, isGroupBoundary, onRemoveFromGroup, onAddGroup,
  onWaypointClick, compact, savedPlaceName,
}: SortableItemProps) => {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: waypoint.id, disabled: isInGroup });

  const [searching, setSearching] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const dotColor =
    index === 0       ? 'bg-green-500' :
    index === total-1 ? 'bg-red-500'   :
    waypoint.direct   ? 'bg-purple-400': 'bg-blue-400';

  return (
    <>
      {/* ── Connecteur entre points ── */}
      {showSegmentConnector && index > 0 && (
        <li className="flex items-start gap-1 px-2 select-none py-0.5">
          <span className="w-5 flex-shrink-0" />
          <div className={`flex flex-col gap-0 flex-1 pl-2 border-l ${isInGroup ? 'border-indigo-200 ml-3' : 'border-gray-200'}`}>
            <div className="flex items-center gap-1">
              {distFromPrev !== undefined && distFromPrev > 0 ? (
                <span className="text-[10px] text-blue-400 font-medium">
                  {distFromPrev!.toFixed(1)} km
                </span>
              ) : (
                <span className="text-[10px] text-gray-300 italic">— km</span>
              )}
              {durFromPrev ? (
                <span className={`text-[10px] font-semibold border rounded px-1
                  ${isInGroup ? 'text-gray-400 border-gray-200 bg-gray-50' : 'text-purple-500 bg-purple-50 border-purple-200'}`}>
                  {formatDur(durFromPrev)}
                </span>
              ) : (
                <span className="text-[10px] text-gray-300 italic">— (OSRM)</span>
              )}
              {distFromPrev !== undefined && distFromPrev > 0 && (
                <>
                  <span className={`text-[10px] font-semibold border rounded px-1
                    ${isInGroup ? 'text-gray-400 border-gray-200 bg-gray-50' : 'text-orange-500 bg-orange-50 border-orange-200'}`}>
                    {durFromSpeed(distFromPrev!, segSpeed ?? DEFAULT_SPEED)}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={segSpeed ?? DEFAULT_SPEED}
                    onChange={e => onSpeedChange?.(Math.max(1, Number(e.target.value)))}
                    className={`w-10 border rounded px-1 py-0 text-[10px] text-center
                      focus:outline-none focus:border-orange-400 bg-white
                      ${isInGroup ? 'border-gray-200 opacity-50' : 'border-gray-300'}`}
                    title="Vitesse max pour ce segment (km/h)"
                    disabled={isInGroup}
                  />
                  <span className="text-[9px] text-gray-400">km/h</span>
                </>
              )}
              {/* Bouton créer groupe */}
              {!isInGroup && onAddGroup && index > 0 && (
                <button
                  onClick={() => onAddGroup(index - 1, index)}
                  className="ml-auto text-[9px] text-gray-300 hover:text-indigo-500
                             border border-dashed border-gray-200 hover:border-indigo-300
                             rounded px-1 hover:bg-indigo-50 transition-colors"
                  title="Grouper ce segment"
                >
                  {compact ? '+' : '+ groupe'}
                </button>
              )}
            </div>
          </div>
        </li>
      )}

      {/* ── Carte waypoint ── */}
      <li
        ref={setNodeRef}
        style={style}
        className={`border rounded-lg transition-colors select-none
          ${isInGroup
            ? 'bg-indigo-50/30 border-indigo-100 ml-5'
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
          }`}
      >
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* Poignée drag */}
          <button
            {...attributes}
            {...listeners}
            className={`text-base leading-none flex-shrink-0
              ${isInGroup ? 'text-gray-200 cursor-default' : 'text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing'}`}
            title={isInGroup ? 'Waypoint groupé' : 'Déplacer'}
            disabled={isInGroup}
          >
            ⠿
          </button>

          {/* Numéro — clic = zoom sur la carte */}
          <button
            type="button"
            onClick={() => onWaypointClick?.(waypoint.lat, waypoint.lng)}
            className={`
              w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
              text-[10px] font-bold text-white cursor-pointer
              hover:ring-2 hover:ring-offset-1 hover:ring-blue-300 transition-all
              ${dotColor}
              ${isInGroup ? 'opacity-60' : ''}
            `}
            title="Centrer la carte sur ce point"
          >
            {index + 1}
          </button>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium truncate leading-tight ${isInGroup ? 'text-gray-500' : 'text-gray-700'}`}>
              {savedPlaceName ?? waypoint.locality ?? waypoint.name ?? `Point ${index + 1}`}
            </p>
            {(waypoint.locality || savedPlaceName) && (
              <p className={`text-[10px] truncate leading-tight ${isInGroup ? 'text-gray-300' : 'text-gray-400'}`}>
                {waypoint.lat.toFixed(4)}, {waypoint.lng.toFixed(4)}
              </p>
            )}
          </div>

          {/* Badge direct */}
          {waypoint.direct && index !== 0 && index !== total - 1 && (
            <span className="text-[9px] text-purple-500 bg-purple-50 border border-purple-200
                             rounded px-1 font-medium flex-shrink-0">
              ↗
            </span>
          )}

          {/* × retirer du groupe (sur premier/dernier waypoint d'un groupe déplié) */}
          {isInGroup && isGroupBoundary && onRemoveFromGroup && (
            <button
              onClick={onRemoveFromGroup}
              className="text-gray-300 hover:text-red-500 transition-colors
                         text-base leading-none flex-shrink-0"
              title="Retirer du groupe"
            >
              ×
            </button>
          )}

          {/* Boutons (masqués pour les waypoints groupés) */}
          {!isInGroup && (
            <>
              <button
                onClick={() => onSavePlace(waypoint)}
                className="text-gray-300 hover:text-yellow-500 transition-colors flex-shrink-0"
                title="Enregistrer ce lieu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M5 5a2 2 0 012-2h7.586a2 2 0 011.414.586l2.414 2.414A2 2 0 0119 7.586V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5z"/>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15 3v4a1 1 0 001 1h4M9 13h6M9 17h3"/>
                </svg>
              </button>

              <button
                onClick={() => setSearching(s => !s)}
                className={`transition-colors flex-shrink-0 ${
                  searching ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500'
                }`}
                title="Rechercher un lieu pour ce point"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <circle cx="11" cy="11" r="7" />
                  <line x1="16.5" y1="16.5" x2="22" y2="22" />
                </svg>
              </button>

              <button
                onClick={() => onRemove(waypoint.id)}
                className="text-gray-300 hover:text-red-500 transition-colors
                           text-base leading-none flex-shrink-0"
                title="Supprimer"
              >
                ×
              </button>
            </>
          )}
        </div>

        {/* Recherche inline */}
        {searching && !isInGroup && (
          <div className="px-2 pb-2">
            <PlaceSearch
              placeholder="Remplacer par un lieu…"
              onSelect={r => {
                onUpdatePosition(waypoint.id, r.lat, r.lng);
                setSearching(false);
              }}
              onCancel={() => setSearching(false)}
            />
          </div>
        )}
      </li>
    </>
  );
};

// ── Props du composant principal ─────────────────────────────
interface WaypointListProps {
  waypoints: Waypoint[];
  groups: (Group & { distKm: number; durationH: number })[];
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onUpdatePosition: (id: string, lat: number, lng: number) => void;
  onSetStart: (lat: number, lng: number) => void;
  onSetEnd: (lat: number, lng: number) => void;
  segmentDistances?: number[];
  segmentDurations?: number[];
  segmentSpeeds?: number[];
  onSegmentSpeedChange?: (index: number, speed: number) => void;
  onAddGroup: (fromWpIndex: number, toWpIndex: number) => void;
  onRemoveGroup: (groupId: string) => void;
  onUpdateGroup: (groupId: string, patch: Partial<Group>) => void;
  onExtendGroup: (groupId: string, toWpIndex: number) => void;
  onToggleGroupExpanded: (groupId: string) => void;
  onRemoveWaypointFromGroup: (groupId: string, wpIndex: number) => void;
  onWaypointClick?: (lat: number, lng: number) => void;
  compact?: boolean;
}

const WaypointList = ({
  waypoints,
  groups,
  onRemove,
  onReorder,
  onUpdatePosition,
  onSetStart,
  onSetEnd,
  segmentDistances,
  segmentDurations,
  segmentSpeeds,
  onSegmentSpeedChange,
  onAddGroup,
  onRemoveGroup,
  onUpdateGroup,
  onExtendGroup,
  onToggleGroupExpanded,
  onRemoveWaypointFromGroup,
  onWaypointClick,
  compact,
}: WaypointListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [savingWaypoint, setSavingWaypoint] = useState<Waypoint | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);

  useEffect(() => {
    getAllPlaces().then(setSavedPlaces);
  }, []);

  function findSavedPlace(lat: number, lng: number): SavedPlace | undefined {
    return savedPlaces.find(sp =>
      Math.abs(sp.lat - lat) < 0.0001 && Math.abs(sp.lng - lng) < 0.0001,
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = waypoints.findIndex(wp => wp.id === active.id);
    const toIndex   = waypoints.findIndex(wp => wp.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorder(fromIndex, toIndex);
    }
  };

  // Calcule les waypoints masqués par les groupes repliés (y compris le 1er)
  const hiddenIndices = new Set<number>();
  for (const g of groups) {
    if (!g.expanded) {
      for (let i = g.fromWpIndex; i <= g.toWpIndex; i++) {
        hiddenIndices.add(i);
      }
    }
  }

  // Liste des sortables (exclut les waypoints groupés repliés)
  const sortableItems = waypoints
    .filter((_, i) => !hiddenIndices.has(i))
    .map(wp => wp.id);

  // Détermine si un waypoint est à l'intérieur d'un groupe (même si déplié)
  function isInsideGroup(idx: number): boolean {
    return groups.some(g => idx >= g.fromWpIndex && idx <= g.toWpIndex);
  }

  // Rendu des items dans l'ordre
  function renderItems() {
    const items: React.ReactNode[] = [];
    const total = waypoints.length;

    for (let i = 0; i < total; i++) {
      const group = groups.find(g => g.fromWpIndex === i);

      // Groupe commençant à ce waypoint — le groupe remplace le 1er waypoint
      if (group) {
        const firstWp = waypoints[group.fromWpIndex];
        const lastWp = waypoints[group.toWpIndex];
        const firstWpName = wpLabel(firstWp, group.fromWpIndex);
        const lastWpName = wpLabel(lastWp, group.toWpIndex);

        // Connecteur segment avant le groupe (visible même si le groupe est replié)
        if (i > 0) {
          const segDist = segmentDistances?.[i];
          const segDur  = segmentDurations?.[i];
          items.push(
            <li key={`seg-before-${i}`} className="flex items-start gap-1 px-2 select-none py-0.5">
              <span className="w-5 flex-shrink-0" />
              <div className="flex flex-col gap-0 flex-1 pl-2 border-l border-gray-200">
                <div className="flex items-center gap-1">
                  {segDist !== undefined && segDist > 0 ? (
                    <span className="text-[10px] text-blue-400 font-medium">
                      {segDist.toFixed(1)} km
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-300 italic">— km</span>
                  )}
                  {segDur ? (
                    <span className="text-[10px] font-semibold text-purple-500 bg-purple-50 border border-purple-200 rounded px-1">
                      {formatDur(segDur)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-300 italic">— (OSRM)</span>
                  )}
                </div>
              </div>
            </li>
          );
        }

        items.push(
          <GroupRow
            key={group.id}
            group={group}
            firstWpName={firstWpName}
            lastWpName={lastWpName}
            onRemove={onRemoveGroup}
            onUpdate={onUpdateGroup}
            onExtend={onExtendGroup}
            onToggleExpand={onToggleGroupExpanded}
            waypointCount={total}
          />
        );

        // Groupe déplié : on affiche aussi le 1er waypoint comme waypoint groupé
        if (group.expanded) {
          items.push(
            <SortableItem
              key={waypoints[i].id}
              waypoint={waypoints[i]}
              index={i}
              total={total}
              onRemove={onRemove}
              onUpdatePosition={onUpdatePosition}
              onSavePlace={setSavingWaypoint}
              isInGroup={true}
              showSegmentConnector={false}
              isGroupBoundary={true}
              onRemoveFromGroup={() => onRemoveWaypointFromGroup(group.id, i)}
              onAddGroup={undefined}
              onWaypointClick={onWaypointClick}
              compact={compact}
              savedPlaceName={findSavedPlace(waypoints[i].lat, waypoints[i].lng)?.name}
            />
          );
        }

        continue;
      }

      // Waypoint masqué par un groupe replié ?
      if (hiddenIndices.has(i)) continue;

      const isInGroup = isInsideGroup(i);
      const groupContaining = groups.find(g => g.fromWpIndex < i && g.toWpIndex >= i);
      const isGroupFirst = groupContaining ? i === groupContaining.fromWpIndex : false;
      const isGroupLast = groupContaining ? i === groupContaining.toWpIndex : false;

      const segDist = segmentDistances?.[i];
      const segDur  = segmentDurations?.[i];
      const segSpeed = segmentSpeeds?.[i];

      items.push(
        <SortableItem
          key={waypoints[i].id}
          waypoint={waypoints[i]}
          index={i}
          total={total}
          onRemove={onRemove}
          onUpdatePosition={onUpdatePosition}
          onSavePlace={setSavingWaypoint}
          distFromPrev={segDist}
          durFromPrev={segDur}
          segSpeed={segSpeed}
          onSpeedChange={s => onSegmentSpeedChange?.(i, s)}
          isInGroup={isInGroup}
          showSegmentConnector={i > 0}
          isGroupBoundary={isInGroup && (isGroupFirst || isGroupLast) && (groupContaining?.expanded ?? false)}
          onRemoveFromGroup={
            isInGroup && (isGroupFirst || isGroupLast) && groupContaining
              ? () => onRemoveWaypointFromGroup(groupContaining.id, i)
              : undefined
          }
          onAddGroup={!isInGroup ? onAddGroup : undefined}
          onWaypointClick={onWaypointClick}
          compact={compact}
          savedPlaceName={findSavedPlace(waypoints[i].lat, waypoints[i].lng)?.name}
        />
      );
    }

    return items;
  }

  const hasStart = waypoints.length > 0;
  const hasEnd   = waypoints.length > 1;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
        <ul className="space-y-0">

          {/* ── Départ (ghost si pas de waypoint) ── */}
          {!hasStart ? (
            <GhostRow
              label="Point de départ"
              color="bg-green-500"
              onSearchSelect={r => onSetStart(r.lat, r.lng)}
            />
          ) : null}

          {/* ── Tous les waypoints + groupes ── */}
          {renderItems()}

          {/* ── Arrivée (ghost si un seul waypoint) ── */}
          {hasStart && !hasEnd ? (
            <GhostRow
              label="Point d'arrivée"
              color="bg-red-500"
              onSearchSelect={r => onSetEnd(r.lat, r.lng)}
            />
          ) : null}

        </ul>
      </SortableContext>

      {savingWaypoint && (
        <SavePlaceModal
          defaultName={savingWaypoint.locality ?? savingWaypoint.name ?? ''}
          lat={savingWaypoint.lat}
          lng={savingWaypoint.lng}
          onClose={() => setSavingWaypoint(null)}
          onSaved={() => setSavingWaypoint(null)}
        />
      )}
    </DndContext>
  );
};

export default WaypointList;
