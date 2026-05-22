import type { MapLayer } from '../../App';

export interface TileLayerConfig {
  url: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string[] | string;
}

export const GOOGLE_SUBDOMAINS = ['0', '1', '2', '3'];

export const BASE_LAYERS: Record<MapLayer, TileLayerConfig> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abc',
    maxZoom: 19,
  },

  'google-road': {
    url: 'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '© Google Maps',
    subdomains: GOOGLE_SUBDOMAINS,
    maxZoom: 21,
  },

  'google-hybrid': {
    url: 'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '© Google Maps',
    subdomains: GOOGLE_SUBDOMAINS,
    maxZoom: 22,
  },

  'google-terrain': {
    url: 'https://mt0.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: '© Google Maps',
    subdomains: GOOGLE_SUBDOMAINS,
    maxZoom: 21,
  },

  swisstopo: {
    url:
      'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    attribution: '© swisstopo',
    maxZoom: 19,
  },

  'swisstopo-gray': {
    url:
      'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg',
    attribution: '© swisstopo',
    maxZoom: 19,
  },

  'swisstopo-imagery': {
    url:
      'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',
    attribution: '© swisstopo',
    maxZoom: 20,
  },
};

export const TRAFFIC_LAYER: TileLayerConfig = {
  url:
    'https://mt0.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}',
  attribution: '',
  subdomains: GOOGLE_SUBDOMAINS,
  maxZoom: 21,
};

export const EXCEPTIONAL_TRANSPORT_WMS = {
  url: 'https://geodienste.ch/db/kantonale_ausnahmetransportrouten_0/fra',

  options: {
    // Noms exacts confirmés par GetCapabilities
    layers: 'route,obstacle',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    // EPSG:3857 supporté nativement par le serveur → pas de reprojection
    uppercase: true,
    opacity: 0.85,
    attribution: '© geodienste.ch – Convois exceptionnels CH',
  },
};