import { useState } from 'react';
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
import type { Waypoint } from '../../types/route.types';
import PlaceSearch from './PlaceSearch';
import type { PlaceResult } from '../../services/geocoding';

const DEFAULT_SPEED = 60;

function formatDur(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
}

function durFromSpeed(distKm: number, speedKmh: number): string | null {
  if (!distKm || distKm <= 0 || speedKmh <= 0) return null;
  return formatDur((distKm / speedKmh) * 3600);
}

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
  distFromPrev?: number;
  durFromPrev?: number;    // secondes OSRM
  segSpeed?: number;       // km/h vitesse perso pour ce segment
  onSpeedChange?: (speed: number) => void;
}

const SortableItem = ({
  waypoint, index, total, onRemove, onUpdatePosition,
  distFromPrev, durFromPrev, segSpeed, onSpeedChange,
}: SortableItemProps) => {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: waypoint.id });

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

  const speed        = segSpeed ?? DEFAULT_SPEED;
  const hasSegData   = distFromPrev !== undefined && distFromPrev > 0;
  const osrmTime     = hasSegData && durFromPrev ? formatDur(durFromPrev)               : null;
  const customTime   = hasSegData                ? durFromSpeed(distFromPrev!, speed)   : null;

  return (
    <>
      {/* ── Connecteur entre points ── */}
      {index > 0 && (
        <li className="flex items-start gap-1 px-2 select-none py-1">
          <span className="w-5 flex-shrink-0" />
          <div className="flex flex-col gap-0.5 flex-1 pl-2 border-l border-gray-200">

            {/* Distance */}
            <div className="flex items-center gap-1">
              {hasSegData ? (
                <span className="text-[10px] text-blue-400 font-medium">
                  {distFromPrev!.toFixed(1)} km
                </span>
              ) : (
                <span className="text-[10px] text-gray-300 italic">— km</span>
              )}
              {/* Temps OSRM */}
              {osrmTime ? (
                <>
                  <span className="text-[10px] font-semibold text-purple-500 bg-purple-50
                                   border border-purple-200 rounded px-1">
                    {osrmTime}
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-gray-300 italic">— (OSRM)</span>
              )}
              {/* Temps vitesse perso + champ vitesse */}
              {customTime ? (
                <span className="text-[10px] font-semibold text-orange-500 bg-orange-50
                                 border border-orange-200 rounded px-1">
                  {customTime}
                </span>
              ) : (
                <span className="text-[10px] text-gray-300 italic">—</span>
              )}
              <input
                type="number"
                min={1}
                max={300}
                value={speed}
                onChange={e => onSpeedChange?.(Math.max(1, Number(e.target.value)))}
                className="w-10 border border-gray-300 rounded px-1 py-0 text-[10px]
                           text-center focus:outline-none focus:border-orange-400 bg-white"
                title="Vitesse max pour ce segment (km/h)"
              />
              <span className="text-[9px] text-gray-400">km/h</span>
            </div>

          </div>
        </li>
      )}

      {/* ── Carte waypoint ── */}
      <li
        ref={setNodeRef}
        style={style}
        className="bg-gray-50 border border-gray-200 rounded-lg
                   hover:bg-gray-100 transition-colors select-none"
      >
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* Poignée drag */}
          <button
            {...attributes}
            {...listeners}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing
                       text-base leading-none flex-shrink-0"
            title="Déplacer"
          >
            ⠿
          </button>

          {/* Numéro */}
          <span className={`
            w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
            text-[10px] font-bold text-white ${dotColor}
          `}>
            {index + 1}
          </span>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate leading-tight">
              {waypoint.locality ?? waypoint.name ?? `Point ${index + 1}`}
            </p>
            {waypoint.locality && (
              <p className="text-[10px] text-gray-400 truncate leading-tight">
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

          {/* Loupe */}
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

          {/* Supprimer */}
          <button
            onClick={() => onRemove(waypoint.id)}
            className="text-gray-300 hover:text-red-500 transition-colors
                       text-base leading-none flex-shrink-0"
            title="Supprimer"
          >
            ×
          </button>
        </div>

        {/* Recherche inline */}
        {searching && (
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
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onUpdatePosition: (id: string, lat: number, lng: number) => void;
  onSetStart: (lat: number, lng: number) => void;
  onSetEnd: (lat: number, lng: number) => void;
  segmentDistances?: number[];
  segmentDurations?: number[];
  segmentSpeeds?: number[];
  onSegmentSpeedChange?: (index: number, speed: number) => void;
}

const WaypointList = ({
  waypoints,
  onRemove,
  onReorder,
  onUpdatePosition,
  onSetStart,
  onSetEnd,
  segmentDistances,
  segmentDurations,
  segmentSpeeds,
  onSegmentSpeedChange,
}: WaypointListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = waypoints.findIndex(wp => wp.id === active.id);
    const toIndex   = waypoints.findIndex(wp => wp.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) onReorder(fromIndex, toIndex);
  };

  const hasStart = waypoints.length > 0;
  const hasEnd   = waypoints.length > 1;
  const sortableItems = waypoints.map(wp => wp.id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
        <ul className="space-y-0">

          {/* ── Départ ── */}
          {!hasStart ? (
            <GhostRow
              label="Point de départ"
              color="bg-green-500"
              onSearchSelect={r => onSetStart(r.lat, r.lng)}
            />
          ) : (
            <SortableItem
              key={waypoints[0].id}
              waypoint={waypoints[0]}
              index={0}
              total={waypoints.length}
              onRemove={onRemove}
              onUpdatePosition={onUpdatePosition}
            />
          )}

          {/* ── Points intermédiaires ── */}
          {waypoints.slice(1, waypoints.length > 1 ? waypoints.length - 1 : undefined).map((wp, i) => (
            <SortableItem
              key={wp.id}
              waypoint={wp}
              index={i + 1}
              total={waypoints.length}
              onRemove={onRemove}
              onUpdatePosition={onUpdatePosition}
              distFromPrev={segmentDistances?.[i + 1]}
              durFromPrev={segmentDurations?.[i + 1]}
              segSpeed={segmentSpeeds?.[i + 1]}
              onSpeedChange={s => onSegmentSpeedChange?.(i + 1, s)}
            />
          ))}

          {/* ── Arrivée ── */}
          {!hasEnd ? (
            <GhostRow
              label="Point d'arrivée"
              color="bg-red-500"
              onSearchSelect={r => onSetEnd(r.lat, r.lng)}
            />
          ) : waypoints.length > 1 ? (
            <SortableItem
              key={waypoints[waypoints.length - 1].id}
              waypoint={waypoints[waypoints.length - 1]}
              index={waypoints.length - 1}
              total={waypoints.length}
              onRemove={onRemove}
              onUpdatePosition={onUpdatePosition}
              distFromPrev={segmentDistances?.[waypoints.length - 1]}
              durFromPrev={segmentDurations?.[waypoints.length - 1]}
              segSpeed={segmentSpeeds?.[waypoints.length - 1]}
              onSpeedChange={s => onSegmentSpeedChange?.(waypoints.length - 1, s)}
            />
          ) : null}

        </ul>
      </SortableContext>
    </DndContext>
  );
};

export default WaypointList;
