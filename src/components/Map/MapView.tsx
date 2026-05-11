import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Waypoint } from '../../types/route.types';


// Fix icônes Leaflet avec Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Icône de départ (verte)
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Icône d'arrivée (rouge)
const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Composant interne pour capturer les clics
const MapClickHandler = ({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

interface MapViewProps {
  waypoints: Waypoint[];
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick: (id: string) => void;
}

const MapView = ({ waypoints, onMapClick, onMarkerClick }: MapViewProps) => {
  const polylinePoints = waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);

  const getIcon = (index: number) => {
    if (index === 0) return startIcon;
    if (index === waypoints.length - 1) return endIcon;
    return new L.Icon.Default();
  };

  return (
    <MapContainer
      center={[46.603354, 1.888334]} // Centre de la France
      zoom={6}
      className="h-full w-full"
    >
      {/* Couche de tuiles OpenStreetMap */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Couche topographique alternative - décommenter si besoin */}
      {/* <TileLayer
        attribution='Map data: &copy; OpenTopoMap'
        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
      /> */}

      <MapClickHandler onMapClick={onMapClick} />

      {/* Tracé de l'itinéraire */}
      {polylinePoints.length > 1 && (
        <Polyline
          positions={polylinePoints}
          color="#3b82f6"
          weight={4}
          opacity={0.8}
        />
      )}

      {/* Marqueurs */}
      {waypoints.map((wp, index) => (
        <Marker
          key={wp.id}
          position={[wp.lat, wp.lng]}
          icon={getIcon(index)}
          eventHandlers={{
            click: () => onMarkerClick(wp.id),
          }}
        />
      ))}
    </MapContainer>
  );
};

export default MapView;
