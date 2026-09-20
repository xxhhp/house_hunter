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

  DEFAULT_CENTER: { lat: 37.3230, lng: -121.8950 },
  DEFAULT_ZOOM: 13,

  // Autocomplete is biased to this box so local addresses rank first.
  // Widen or drop it if you start looking outside the South Bay.
  AUTOCOMPLETE_BOUNDS: { north: 37.55, south: 37.10, east: -121.60, west: -122.25 },
  AUTOCOMPLETE_REGION: 'us',

  // Milliseconds between Drive polls once M4 lands.
  SYNC_INTERVAL: 15000
};
