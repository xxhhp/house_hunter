// Everything here is public. It ships in the page source by design.
// Protect the Google key with an HTTP referrer restriction in Cloud Console,
// not by hiding it.

export const CONFIG = {
  MAP_PROVIDER: 'google',

  // Fill these in from Google Cloud. Both are public values; the key is
  // protected by an HTTP referrer restriction, not by secrecy.
  GOOGLE_MAPS_API_KEY: '',
  GOOGLE_MAPS_MAP_ID: '',        // required by AdvancedMarkerElement
  GOOGLE_OAUTH_CLIENT_ID: '',    // M1

  // With no key yet, fall back to Leaflet so the app still runs locally.
  // A banner says which map you are looking at. Set false to fail loudly.
  FALLBACK_TO_LEAFLET: true,

  DRIVE_FILE_NAME: 'house-hunter-data.json',

  // Free, no account needed, takes a minute: carto.com/basemaps/apikey
  // Without it the two CARTO styles below are hidden, because unkeyed
  // CARTO tiles now come back stamped with a watermark.
  CARTO_API_KEY: '',

  DEFAULT_BASEMAP: 'esri-gray',


  DEFAULT_CENTER: { lat: 37.3230, lng: -121.8950 },
  DEFAULT_ZOOM: 13,

  // Autocomplete is biased to this box so local addresses rank first.
  // Widen or drop it if you start looking outside the South Bay.
  AUTOCOMPLETE_BOUNDS: { north: 37.55, south: 37.10, east: -121.60, west: -122.25 },
  AUTOCOMPLETE_REGION: 'us',

  // Milliseconds between Drive polls once M4 lands.
  SYNC_INTERVAL: 15000
};

/**
 * Basemaps for the Leaflet provider. Each entry may carry a `dark` variant,
 * used automatically when the page is in dark mode.
 *
 * `overlay` is a labels-only layer drawn on top. Esri splits its grey canvas
 * into a base with no text and a separate reference layer, and street names
 * matter here, so both get drawn.
 */
export const BASEMAPS = [
  {
    id: 'esri-gray',
    label: 'Soft grey',
    note: 'Clean, no key needed',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    overlay: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      overlay: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
    },
    attribution: 'Tiles &copy; Esri'
  },
  {
    id: 'carto-positron',
    label: 'Near white',
    note: 'The cleanest. Needs a free CARTO key.',
    needsCartoKey: true,
    url: 'https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png',
    dark: { url: 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png' },
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  },
  {
    id: 'carto-positron-nolabels',
    label: 'Near white, no text',
    note: 'Only your pins carry labels. Needs a free CARTO key.',
    needsCartoKey: true,
    url: 'https://basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}{r}.png',
    dark: { url: 'https://basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png' },
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    note: 'The colourful default',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  }
];
