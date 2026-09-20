import { CONFIG } from './config.js';
import { likers } from './model.js';
import { PERSONAS } from './personas.js';

/* ---------------------------------------------------------------
   One marker renderer for both providers, so a pin looks and
   behaves identically whichever map is underneath.

   The teardrop shape never changes. Only the fill and the glyph do:
     neutral body + dot     nobody liked it
     one colour + heart     that one person liked it
     split body + heart     both liked it, pink left, blue right
   --------------------------------------------------------------- */

const SHELL =
  '<path class="body" d="M11 29c0 0-9-9.6-9-16.2C2 6.9 6 2.6 11 2.6s9 4.3 9 10.2C20 19.4 11 29 11 29z"/>';
const DOT = '<circle class="dot" cx="11" cy="12.4" r="3.1"/>';
const HEART =
  '<path class="dot" d="M11 16.3c-.1 0-4.7-2.8-4.7-5.5 0-1.5 1.2-2.5 2.4-2.5.9 0 1.9.5 2.3 1.3.4-.8 1.4-1.3 2.3-1.3 1.2 0 2.4 1 2.4 2.5 0 2.7-4.6 5.5-4.7 5.5z"/>';

let gradSeq = 0;

export function markerElement(place, { selected }) {
  const liked = likers(place);
  const both = liked.length > 1;
  const single = liked.length === 1 ? liked[0] : null;

  const el = document.createElement('button');
  el.type = 'button';
  el.className =
    'pin' +
    (single ? ' liked liked-' + single : '') +
    (both ? ' liked liked-both' : '') +
    (selected ? ' sel' : '');

  const names = liked
    .map(id => PERSONAS.find(p => p.id === id)?.name)
    .filter(Boolean);
  el.setAttribute(
    'aria-label',
    place.formatted + (names.length ? `, liked by ${names.join(' and ')}` : '')
  );

  let defs = '';
  let bodyStyle = '';
  if (both) {
    const gid = 'split' + (++gradSeq);
    defs =
      `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">` +
      `<stop offset="50%" stop-color="var(--pink)"/>` +
      `<stop offset="50%" stop-color="var(--blue)"/>` +
      `</linearGradient></defs>`;
    bodyStyle = ` style="fill:url(#${gid})"`;
  }

  el.innerHTML =
    '<svg width="22" height="31" viewBox="0 0 22 31" aria-hidden="true">' +
    defs +
    (both ? SHELL.replace('<path ', '<path' + bodyStyle + ' ') : SHELL) +
    (liked.length ? HEART : DOT) +
    '</svg>';
  return el;
}

/* --------------------------- adapter --------------------------- */

/**
 * createMap resolves to an object with:
 *   setPlaces(places, { selectedId })
 *   focus(lat, lng)
 *   onSelect(fn)          fn(placeId)
 *   onBackgroundClick(fn)
 */
export async function createMap(el) {
  if (CONFIG.MAP_PROVIDER !== 'google') return leafletMap(el);

  if (!CONFIG.GOOGLE_MAPS_API_KEY) {
    if (!CONFIG.FALLBACK_TO_LEAFLET) {
      throw new Error('MAP_PROVIDER is "google" but GOOGLE_MAPS_API_KEY is empty in config.js');
    }
    const map = await leafletMap(el);
    map.degraded = 'No Google Maps key yet, so this is the OpenStreetMap fallback. ' +
                   'Address autocomplete is off until a key is set in config.js.';
    return map;
  }
  return googleMap(el);
}

/* --------------------------- leaflet --------------------------- */

function loadOnce(tag, attrs) {
  const key = attrs.src || attrs.href;
  if (document.querySelector(`[data-load="${key}"]`)) {
    return Promise.resolve();
  }
  return new Promise((res, rej) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    node.dataset.load = key;
    node.onload = res;
    node.onerror = () => rej(new Error('Failed to load ' + key));
    document.head.appendChild(node);
  });
}

async function leafletMap(el) {
  await loadOnce('link', {
    rel: 'stylesheet',
    href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  });
  await loadOnce('script', {
    src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
  });

  const map = L.map(el, { zoomControl: false, attributionControl: true })
    .setView([CONFIG.DEFAULT_CENTER.lat, CONFIG.DEFAULT_CENTER.lng], CONFIG.DEFAULT_ZOOM);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  let markers = [];
  let onSelect = () => {};
  let onBg = () => {};
  map.on('click', () => onBg());

  return {
    provider: 'leaflet',
    setPlaces(places, opts) {
      markers.forEach(m => m.remove());
      markers = places.map(p => {
        const node = markerElement(p, { selected: p.id === opts.selectedId });
        const icon = L.divIcon({
          html: node.outerHTML,
          className: 'pin-wrap',
          iconSize: [22, 31],
          iconAnchor: [11, 31]
        });
        const m = L.marker([p.lat, p.lng], { icon, keyboard: true, title: p.formatted })
          .addTo(map)
          .on('click', e => { L.DomEvent.stop(e); onSelect(p.id); });
        return m;
      });
    },
    focus(lat, lng) {
      map.panTo([lat, lng], { animate: true });
    },
    onSelect(fn) { onSelect = fn; },
    onBackgroundClick(fn) { onBg = fn; }
  };
}

/* --------------------------- google ---------------------------- */

async function googleMap(el) {
  await loadOnce('script', {
    src: `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&libraries=marker,places&v=weekly&loading=async`,
    async: 'true'
  });
  await google.maps.importLibrary('marker');

  const map = new google.maps.Map(el, {
    center: CONFIG.DEFAULT_CENTER,
    zoom: CONFIG.DEFAULT_ZOOM,
    mapId: CONFIG.GOOGLE_MAPS_MAP_ID || undefined,
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    clickableIcons: false
  });

  let markers = [];
  let onSelect = () => {};
  let onBg = () => {};
  map.addListener('click', () => onBg());

  return {
    provider: 'google',
    innerMap: map,
    setPlaces(places, opts) {
      markers.forEach(m => (m.map = null));
      markers = places.map(p => {
        const node = markerElement(p, { selected: p.id === opts.selectedId });
        const m = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: p.lat, lng: p.lng },
          content: node,
          title: p.formatted
        });
        node.addEventListener('click', e => { e.stopPropagation(); onSelect(p.id); });
        return m;
      });
    },
    focus(lat, lng) {
      map.panTo({ lat, lng });
    },
    onSelect(fn) { onSelect = fn; },
    onBackgroundClick(fn) { onBg = fn; }
  };
}

/* --------------------- places autocomplete --------------------- */

/**
 * Mounts Google's PlaceAutocompleteElement into `host` and calls
 * `onPick({ formatted, placeId, lat, lng })` on selection.
 *
 * Returns null when the provider is not Google, so the caller can fall back
 * to the plain text field.
 */
export async function mountAutocomplete(host, onPick) {
  if (CONFIG.MAP_PROVIDER !== 'google' || !CONFIG.GOOGLE_MAPS_API_KEY) return null;

  const { PlaceAutocompleteElement } = await google.maps.importLibrary('places');

  const ac = new PlaceAutocompleteElement({
    locationBias: CONFIG.AUTOCOMPLETE_BOUNDS,
    requestedRegion: CONFIG.AUTOCOMPLETE_REGION
  });
  ac.id = 'placeAutocomplete';
  host.replaceChildren(ac);

  ac.addEventListener('gmp-select', async ({ placePrediction }) => {
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['id', 'formattedAddress', 'location'] });
    if (!place.location) return;
    onPick({
      formatted: place.formattedAddress,
      placeId: place.id,
      lat: place.location.lat(),
      lng: place.location.lng()
    });
    ac.value = '';
  });

  ac.addEventListener('gmp-requesterror', e => {
    console.error('Places autocomplete request failed', e);
  });

  return ac;
}
