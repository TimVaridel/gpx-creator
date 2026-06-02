import { useRef, useState, useCallback, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Pane,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Waypoint } from '../../types/route.types';
import type { MapLayer } from '../../App';

// ── Fix icônes Leaflet ───────────────────────────────────────
delete (L.Icon.Default.prototype as typeof L.Icon.Default.prototype & { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Icône numérotée ──────────────────────────────────────────
const createNumberedIcon = (index: number, total: number, direct = false) => {
  const isStart = index === 0;
  const isEnd   = index === total - 1;
  const bg = isStart ? '#22c55e' : isEnd ? '#ef4444' : direct ? '#a855f7' : '#3b82f6';

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
        ">${index + 1}</div>
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
  lat: number; lng: number;
  onAction: (action: ContextAction) => void;
  onClose: () => void;
}

const ContextMenu = ({ x, y, lat, lng, onAction, onClose }: ContextMenuProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCoords = () => {
    const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1000);
    }).catch(() => onClose());
  };

  const handleStreetView = () => {
    // Street View direct — si pas de panorama disponible, Google Maps bascule en vue hybride
    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[1000]" onClick={onClose} />
      <ul
        className="fixed z-[1001] bg-white rounded-xl shadow-2xl border border-gray-100
                   py-1 min-w-[230px] text-sm text-gray-700 overflow-hidden"
        style={{ left: x, top: y }}
      >
        <li
          className="px-4 py-2.5 hover:bg-green-50 cursor-pointer flex items-center gap-2.5"
          onClick={() => { onAction('start'); onClose(); }}
        >
          <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
          Définir comme point de départ
        </li>
        <li
          className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center gap-2.5"
          onClick={() => { onAction('via'); onClose(); }}
        >
          <span className="w-3 h-3 rounded-full bg-blue-400 flex-shrink-0" />
          Ajouter un point de passage
        </li>
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
        <li className="border-t border-gray-100 my-1" />
        <li
          className="px-4 py-2.5 hover:bg-red-50 cursor-pointer flex items-center gap-2.5"
          onClick={() => { onAction('end'); onClose(); }}
        >
          <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
          Itinéraire jusqu'à ce point
        </li>
        <li className="border-t border-gray-100 my-1" />
        <li
          className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer flex items-center gap-2.5"
          onClick={handleCopyCoords}
        >
          <span className="w-3 h-3 flex items-center justify-center flex-shrink-0 text-gray-400 text-[11px]">📋</span>
          <span className="flex-1">Copier les coordonnées</span>
          {copied && (
            <span className="text-[10px] text-green-500 bg-green-50 border border-green-200
                             rounded px-1.5 py-0.5 font-medium flex-shrink-0">
              copié !
            </span>
          )}
        </li>
        <li
          className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer flex items-center gap-2.5"
          onClick={handleStreetView}
        >
          <span className="w-3 h-3 flex items-center justify-center flex-shrink-0 text-gray-400 text-[11px]">🗺️</span>
          Google Street View
        </li>
      </ul>
    </>
  );
};

// ── Gestionnaire événements carte ────────────────────────────
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
    let minWpDist    = Infinity;
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

// ── Calcul distance cumulée ──────────────────────────────────
function cumulativeDistAtClick(
  clickLatLng: L.LatLng,
  geometry: [number, number][],
  map: L.Map,
): number {
  let minDist    = Infinity;
  let closestIdx = 0;

  for (let i = 0; i < geometry.length; i++) {
    const p     = map.latLngToLayerPoint(L.latLng(geometry[i][0], geometry[i][1]));
    const click = map.latLngToLayerPoint(clickLatLng);
    const d     = p.distanceTo(click);
    if (d < minDist) { minDist = d; closestIdx = i; }
  }

  let cumul = 0;
  for (let i = 1; i <= closestIdx; i++) {
    const a = L.latLng(geometry[i - 1][0], geometry[i - 1][1]);
    const b = L.latLng(geometry[i][0],     geometry[i][1]);
    cumul += a.distanceTo(b);
  }
  return cumul;
}

// ── Config fonds de carte ────────────────────────────────────
import {
  BASE_LAYERS,
  TRAFFIC_LAYER,
  EXCEPTIONAL_TRANSPORT_WMS,
} from './mapLayers';

// ── Polyline draggable + tooltip hover ───────────────────────
interface DraggablePolylineProps {
  geometry:         [number, number][];
  waypoints:        Waypoint[];
  onInsert:         (lat: number, lng: number, atIndex: number) => void;
  suppressClickRef: React.MutableRefObject<number>;
}

const DraggablePolyline = ({
  geometry, waypoints, onInsert, suppressClickRef,
}: DraggablePolylineProps) => {
  const map            = useMapEvents({});
  const [isDragging, setIsDragging] = useState(false);
  const [ghostPos, setGhostPos]     = useState<[number, number] | null>(null);
  const insertIndexRef = useRef<number>(0);
  const popupRef       = useRef<L.Popup | null>(null);

  // ── Popup hover ──────────────────────────────────────────
  const openHoverPopup = useCallback((latlng: L.LatLng) => {
    const distKm = (cumulativeDistAtClick(latlng, geometry, map) / 1000).toFixed(1);

    if (!popupRef.current) {
      popupRef.current = L.popup({
        closeButton:  false,
        offset:       [0, -4],
        className:    'dist-popup',
        autoClose:    false,
        closeOnClick: false,
      });
    }

    popupRef.current
      .setLatLng(latlng)
      .setContent(
        `<div style="font-size:12px;font-weight:600;white-space:nowrap;padding:2px 4px;">
           📍 ${distKm} km depuis le départ
         </div>`,
      )
      .openOn(map);
  }, [map, geometry]);

  const closeHoverPopup = useCallback(() => {
    if (popupRef.current) map.closePopup(popupRef.current);
  }, [map]);

  // ── Handlers polyline ────────────────────────────────────
  const handleMouseMove = useCallback((e: L.LeafletMouseEvent) => {
    if (!isDragging) openHoverPopup(e.latlng);
  }, [isDragging, openHoverPopup]);

  const handleMouseOut = useCallback(() => {
    closeHoverPopup();
  }, [closeHoverPopup]);

  // ── Drag sans délai ──────────────────────────────────────
  const handleMouseDown = useCallback((e: L.LeafletMouseEvent) => {
    e.originalEvent.stopPropagation();

    insertIndexRef.current = findClosestSegmentIndex(e.latlng, geometry, waypoints, map);

    closeHoverPopup();
    map.dragging.disable();
    setIsDragging(true);
    setGhostPos([e.latlng.lat, e.latlng.lng]);

    const mouseMoveHandler = (ev: L.LeafletMouseEvent) => {
      setGhostPos([ev.latlng.lat, ev.latlng.lng]);
    };

    const mouseUpHandler = (ev: L.LeafletMouseEvent) => {
      map.dragging.enable();
      setIsDragging(false);
      setGhostPos(null);
      suppressClickRef.current = Date.now();
      onInsert(ev.latlng.lat, ev.latlng.lng, insertIndexRef.current);
      map.off('mousemove', mouseMoveHandler);
      map.off('mouseup',   mouseUpHandler);
    };

    map.on('mousemove', mouseMoveHandler);
    map.on('mouseup',   mouseUpHandler);

  }, [map, geometry, waypoints, onInsert, suppressClickRef, closeHoverPopup]);

  return (
    <>
      <Polyline
        positions={geometry}
        color="#3b82f6"
        weight={5}
        opacity={0.85}
        eventHandlers={{
          mousedown: handleMouseDown,
          mousemove: handleMouseMove,
          mouseout:  handleMouseOut,
        }}
      />
      {isDragging && ghostPos && (
        <Marker
          position={ghostPos}
          icon={new L.DivIcon({
            className: '',
            html: `<div style="
              width:16px;height:16px;
              background:#3b82f6;
              border:3px solid white;
              border-radius:50%;
              box-shadow:0 2px 8px rgba(0,0,0,0.4);
              transform:translate(-50%,-50%);
            "></div>`,
            iconSize:   [0, 0],
            iconAnchor: [0, 0],
          })}
          interactive={false}
        />
      )}
    </>
  );
};

const ExceptionalTransportLayer = () => {
  const map = useMapEvents({});

  useEffect(() => {
    const layer = L.tileLayer.wms(
      EXCEPTIONAL_TRANSPORT_WMS.url,
      {
        layers:      EXCEPTIONAL_TRANSPORT_WMS.options.layers,
        format:      EXCEPTIONAL_TRANSPORT_WMS.options.format,
        transparent: EXCEPTIONAL_TRANSPORT_WMS.options.transparent,
        version:     EXCEPTIONAL_TRANSPORT_WMS.options.version,
        uppercase:   EXCEPTIONAL_TRANSPORT_WMS.options.uppercase,
        opacity:     EXCEPTIONAL_TRANSPORT_WMS.options.opacity,
        attribution: EXCEPTIONAL_TRANSPORT_WMS.options.attribution,
        // Pas de crs forcé : Leaflet utilise EPSG:3857 par défaut,
        // supporté nativement par ce WMS → pas de reprojection, pas d'erreur BBOX
      }
    );
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map]);

  return null;
};

// ── Composant principal ──────────────────────────────────────
interface MapViewProps {
  waypoints:           Waypoint[];
  routeGeometry?:      [number, number][];
  onMarkerDragEnd:     (id: string, lat: number, lng: number) => void;
  onInsertOnRoute:     (lat: number, lng: number, atIndex: number) => void;
  onContextMenuAction: (action: ContextAction, lat: number, lng: number) => void;
  mapLayer:            MapLayer;
  showTraffic:         boolean;
  showExceptionalRoutes: boolean;
}

const MapView = ({
  waypoints,
  routeGeometry,
  onMarkerDragEnd,
  onInsertOnRoute,
  onContextMenuAction,
  mapLayer,
  showTraffic,
  showExceptionalRoutes,
}: MapViewProps) => {
  const suppressClickRef = useRef<number>(0);
  const [contextMenu, setContextMenu] = useState<{
    lat: number; lng: number; x: number; y: number;
  } | null>(null);

  const handleContextMenu = useCallback((
    lat: number, lng: number, x: number, y: number,
  ) => {
    setContextMenu({ lat, lng, x, y });
  }, []);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[46.8, 8.3]}
        zoom={8}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution={BASE_LAYERS[mapLayer].attribution}
          url={BASE_LAYERS[mapLayer].url}
          maxZoom={BASE_LAYERS[mapLayer].maxZoom ?? 19}
        />
        {showTraffic && (
          <Pane name="traffic-pane" style={{ zIndex: 450 }}>
            <TileLayer
              url={TRAFFIC_LAYER.url}
              maxZoom={TRAFFIC_LAYER.maxZoom}
              opacity={0.85}
            />
          </Pane>
        )}
        {showExceptionalRoutes && (
          <Pane name="exceptional-pane" style={{ zIndex: 460 }}>
            <ExceptionalTransportLayer />
          </Pane>
        )}

        <MapEventsHandler onContextMenu={handleContextMenu} />

        {/* Tracé routé draggable */}
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
              dragend:   (e) => {
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
          lat={contextMenu.lat}
          lng={contextMenu.lng}
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
