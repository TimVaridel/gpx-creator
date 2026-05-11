import { useRef, useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Waypoint } from '../../types/route.types';

// ── Fix icônes Leaflet ───────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Icône numérotée ──────────────────────────────────────────
const createNumberedIcon = (index: number, total: number, direct = false) => {
  const isStart = index === 0;
  const isEnd   = index === total - 1;
  // Points directs = violet, start = vert, end = rouge, via = bleu
  const bg = isStart ? '#22c55e' : isEnd ? '#ef4444' : direct ? '#a855f7' : '#3b82f6';
  const label = index + 1;

  return new L.DivIcon({
    className: '',
    html: `
      <div style="position:relative;width:28px;height:40px;">
        <div style="
          position:absolute;top:0;left:0;
          width:28px;height:28px;
          background:${bg};
          border:2px solid white;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
        "></div>
        <div style="
          position:absolute;top:4px;left:0;
          width:28px;text-align:center;
          color:white;font-size:11px;font-weight:bold;
          font-family:sans-serif;line-height:20px;
          pointer-events:none;
        ">${label}</div>
        ${direct && !isStart && !isEnd ? `
        <div style="
          position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);
          font-size:8px;color:#a855f7;font-weight:bold;
          background:white;border-radius:4px;padding:0 2px;line-height:1.4;
        ">↗</div>` : ''}
      </div>`,
    iconSize:    [28, 40],
    iconAnchor:  [14, 40],
    popupAnchor: [0, -40],
  });
};

// ── Menu contextuel ──────────────────────────────────────────
type ContextAction = 'start' | 'end' | 'via' | 'via-direct';

interface ContextMenuProps {
  x: number; y: number;
  onAction: (action: ContextAction) => void;
  onClose: () => void;
}

const ContextMenu = ({ x, y, onAction, onClose }: ContextMenuProps) => (
  <>
    <div className="fixed inset-0 z-[999]" onClick={onClose} />
    <ul
      className="fixed z-[1000] bg-white border border-gray-200 rounded-xl
                 shadow-xl py-1 min-w-[250px] text-sm overflow-hidden"
      style={{ left: x, top: y }}
    >
      {/* Itinéraire à partir de ce point */}
      <li
        className="px-4 py-2.5 hover:bg-green-50 cursor-pointer flex items-center gap-2.5"
        onClick={() => { onAction('start'); onClose(); }}
      >
        <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
        Itinéraire à partir de ce point
      </li>

      {/* Séparateur */}
      <li className="border-t border-gray-100 my-1" />

      {/* Ajouter un point de passage */}
      <li
        className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center gap-2.5"
        onClick={() => { onAction('via'); onClose(); }}
      >
        <span className="w-3 h-3 rounded-full bg-blue-400 flex-shrink-0" />
        Ajouter un point de passage
      </li>

      {/* Ajouter un point de passage direct */}
      <li
        className="px-4 py-2.5 hover:bg-purple-50 cursor-pointer flex items-center gap-2.5"
        onClick={() => { onAction('via-direct'); onClose(); }}
      >
        <span className="w-3 h-3 rounded-full bg-purple-400 flex-shrink-0" />
        <span className="flex-1">Ajouter un point de passage direct</span>
        <span className="text-[10px] text-purple-400 bg-purple-50 border border-purple-200
                         rounded px-1.5 py-0.5 font-medium flex-shrink-0">
          ligne droite
        </span>
      </li>

      {/* Séparateur */}
      <li className="border-t border-gray-100 my-1" />

      {/* Itinéraire jusqu'à ce point */}
      <li
        className="px-4 py-2.5 hover:bg-red-50 cursor-pointer flex items-center gap-2.5"
        onClick={() => { onAction('end'); onClose(); }}
      >
        <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
        Itinéraire jusqu'à ce point
      </li>
    </ul>
  </>
);

// ── Gestionnaire clics carte ─────────────────────────────────
interface MapEventsHandlerProps {
  onContextMenu: (lat: number, lng: number, x: number, y: number) => void;
}

const MapEventsHandler = ({ onContextMenu }: MapEventsHandlerProps) => {
  useMapEvents({
    contextmenu: (e) => {
      e.originalEvent.preventDefault();
      onContextMenu(
        e.latlng.lat, e.latlng.lng,
        e.originalEvent.clientX, e.originalEvent.clientY,
      );
    },
  });
  return null;
};

// ── Trouver le segment le plus proche ───────────────────────
function findClosestSegmentIndex(
  clickLatLng: L.LatLng,
  geometry: [number, number][],
  waypoints: Waypoint[],
  map: L.Map,
): number {
  let minDist = Infinity;
  let closestGeomIndex = 0;

  for (let i = 0; i < geometry.length; i++) {
    const p     = map.latLngToLayerPoint(L.latLng(geometry[i][0], geometry[i][1]));
    const click = map.latLngToLayerPoint(clickLatLng);
    const d     = p.distanceTo(click);
    if (d < minDist) { minDist = d; closestGeomIndex = i; }
  }

  let bestWpIndex = 0;
  let bestDist    = Infinity;

  for (let i = 0; i < waypoints.length; i++) {
    let minWpDist   = Infinity;
    let closestForWp = 0;
    for (let j = 0; j < geometry.length; j++) {
      const d = Math.sqrt(
        (geometry[j][0] - waypoints[i].lat) ** 2 +
        (geometry[j][1] - waypoints[i].lng) ** 2,
      );
      if (d < minWpDist) { minWpDist = d; closestForWp = j; }
    }
    if (
      closestForWp <= closestGeomIndex &&
      Math.abs(closestGeomIndex - closestForWp) < bestDist
    ) {
      bestDist    = Math.abs(closestGeomIndex - closestForWp);
      bestWpIndex = i;
    }
  }

  return Math.min(bestWpIndex + 1, waypoints.length);
}

// ── Polyline draggable ───────────────────────────────────────
interface DraggablePolylineProps {
  geometry: [number, number][];
  waypoints: Waypoint[];
  onInsert: (lat: number, lng: number, atIndex: number) => void;
  suppressClickRef: React.MutableRefObject<number>;
}

const DraggablePolyline = ({
  geometry, waypoints, onInsert, suppressClickRef,
}: DraggablePolylineProps) => {
  const map = useMapEvents({});
  const [isDragging, setIsDragging] = useState(false);
  const [ghostPos, setGhostPos]     = useState<[number, number] | null>(null);
  const insertIndexRef              = useRef<number>(0);

  const handleMouseDown = useCallback((e: L.LeafletMouseEvent) => {
    e.originalEvent.stopPropagation();
    map.dragging.disable();
    setIsDragging(true);

    const idx = findClosestSegmentIndex(e.latlng, geometry, waypoints, map);
    insertIndexRef.current = idx;
    setGhostPos([e.latlng.lat, e.latlng.lng]);

    const onMouseMove = (ev: L.LeafletMouseEvent) => {
      setGhostPos([ev.latlng.lat, ev.latlng.lng]);
    };
    const onMouseUp = (ev: L.LeafletMouseEvent) => {
      map.dragging.enable();
      setIsDragging(false);
      setGhostPos(null);
      suppressClickRef.current = Date.now();
      onInsert(ev.latlng.lat, ev.latlng.lng, insertIndexRef.current);
      map.off('mousemove', onMouseMove);
      map.off('mouseup',   onMouseUp);
    };

    map.on('mousemove', onMouseMove);
    map.on('mouseup',   onMouseUp);
  }, [map, geometry, waypoints, onInsert, suppressClickRef]);

  return (
    <>
      <Polyline
        positions={geometry}
        color="#3b82f6"
        weight={5}
        opacity={0.8}
        eventHandlers={{ mousedown: handleMouseDown }}
      />
      {/* Zone de clic élargie (invisible) */}
      <Polyline
        positions={geometry}
        color="transparent"
        weight={15}
        opacity={0}
        eventHandlers={{ mousedown: handleMouseDown }}
      />
      {isDragging && ghostPos && (
        <Marker
          position={ghostPos}
          icon={new L.Icon({
            iconUrl:   'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize:  [25, 41], iconAnchor: [12, 41],
            className: 'opacity-60',
          })}
        />
      )}
    </>
  );
};

// ── Props MapView ────────────────────────────────────────────
interface MapViewProps {
  waypoints: Waypoint[];
  routeGeometry?: [number, number][];
  onMarkerDragEnd: (id: string, lat: number, lng: number) => void;
  onInsertOnRoute: (lat: number, lng: number, atIndex: number) => void;
  onContextMenuAction: (action: ContextAction, lat: number, lng: number) => void;
}

// ── Composant principal ──────────────────────────────────────
const MapView = ({
  waypoints,
  routeGeometry,
  onMarkerDragEnd,
  onInsertOnRoute,
  onContextMenuAction,
}: MapViewProps) => {
  const [contextMenu, setContextMenu] = useState<{
    lat: number; lng: number; x: number; y: number;
  } | null>(null);

  const suppressClickRef = useRef<number>(0);

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[46.603354, 1.888334]}
        zoom={6}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEventsHandler
          onContextMenu={(lat, lng, x, y) => setContextMenu({ lat, lng, x, y })}
        />

        {/* Tracé calculé avec drag-to-insert */}
        {routeGeometry && routeGeometry.length > 0 && (
          <DraggablePolyline
            geometry={routeGeometry}
            waypoints={waypoints}
            onInsert={onInsertOnRoute}
            suppressClickRef={suppressClickRef}
          />
        )}

        {/* Tracé pointillé si pas encore de géométrie */}
        {(!routeGeometry || routeGeometry.length === 0) && waypoints.length >= 2 && (
          <Polyline
            positions={waypoints.map(wp => [wp.lat, wp.lng])}
            color="#94a3b8"
            weight={3}
            opacity={0.5}
            dashArray="6"
          />
        )}

        {/* Markers numérotés et draggables */}
        {waypoints.map((wp, index) => (
          <Marker
            key={wp.id}
            position={[wp.lat, wp.lng]}
            icon={createNumberedIcon(index, waypoints.length, wp.direct)}
            draggable={true}
            eventHandlers={{
              dragstart: () => { suppressClickRef.current = Date.now(); },
              dragend: (e) => {
                suppressClickRef.current = Date.now();
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                onMarkerDragEnd(wp.id, lat, lng);
              },
            }}
          />
        ))}
      </MapContainer>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onAction={(action) => {
            onContextMenuAction(action, contextMenu.lat, contextMenu.lng);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default MapView;
