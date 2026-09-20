import { CONFIG } from './config.js';
import { createStore } from './store.js';
import { createMap, mountAutocomplete, availableBasemaps, loadBasemapChoice } from './map.js';
import { analyzeAddress } from './analyzer.js';
import { createList, createReport, createToast, createEntry } from './ui.js';
import { PERSONAS, byId, loadPersona, savePersona } from './personas.js';
import {
  makePlace, findMatch, toggleLike, setLike, likedBy,
  canonicalKey, nowIso, sortPlaces
} from './model.js';

const $ = id => document.getElementById(id);

let me = null;          // persona id of whoever is using the app
let map = null;
let selectedId = null;
let banner = null;
let busy = false;

const store = createStore({ userKey: 'local' });
const toast = createToast($('toast'), $('toastMsg'), $('toastAction'));

const entry = createEntry({
  root: $('entry'),
  onPick: id => { savePersona(id); setPersona(id); }
});

const list = createList({
  root: $('rows'),
  countEl: $('count'),
  statusEl: $('status'),
  onSelect: select,
  onToggleLike: like,
  onDelete: remove
});

const report = createReport({
  panel: $('report'),
  titleEl: $('reportTitle'),
  metaEl: $('reportMeta'),
  bodyEl: $('reportBody'),
  heartsEl: $('reportHearts'),
  bannerEl: $('reportBanner'),
  onToggleLike: like
});

/* ------------------------------ persona ----------------------------- */

function setPersona(id) {
  me = id;
  const p = byId(id);
  document.body.dataset.persona = id;

  const chip = $('personaChip');
  chip.textContent = p.name;
  chip.className = 'persona-chip ' + id;
  chip.hidden = false;

  entry.hide();
  render();
}

$('personaChip').addEventListener('click', () => {
  entry.show();
});

/* ------------------------------ render ------------------------------ */

function render() {
  if (!me) return;
  const places = store.list();
  list.render(places, me, store.status);
  map?.setPlaces(sortPlaces(places, me), { selectedId });

  const sel = selectedId && store.get(selectedId);
  if (sel && !sel.deleted) report.open(sel, me, { banner, busy });
  else report.close();
}

store.subscribe(render);

/* ------------------------------ actions ----------------------------- */

function select(id, nextBanner = null) {
  const p = store.get(id);
  if (!p) return;
  selectedId = id;
  banner = nextBanner;
  map?.focus(p.lat, p.lng);
  render();
}

function close() {
  selectedId = null;
  banner = null;
  render();
}

/**
 * Toggle a like. `personaId` may be either person: removing the other's
 * like is allowed, and gets an undo like any other destructive action.
 */
function like(placeId, personaId) {
  const place = store.get(placeId);
  if (!place) return;
  const was = likedBy(place, personaId);

  store.update(doc => toggleLike(doc.places[placeId], personaId, me));

  if (was && personaId !== me) {
    toast(`Removed ${byId(personaId).name}'s like.`, 'Undo', () => {
      store.update(doc => setLike(doc.places[placeId], personaId, true, me));
    });
  }
}

function remove(id) {
  const p = store.get(id);
  if (!p) return;
  const label = p.formatted.split(',')[0];

  store.update(doc => {
    doc.places[id].deleted = true;
    doc.places[id].updatedAt = nowIso();
    doc.places[id].updatedBy = me;
  });
  if (selectedId === id) close();

  toast(`Removed ${label} for both of you.`, 'Undo', () => {
    store.update(doc => {
      doc.places[id].deleted = false;
      doc.places[id].updatedAt = nowIso();
      doc.places[id].updatedBy = me;
    });
  });
}

/** The add path, including the three dedup outcomes from plan §8. */
async function addPlace(geocoded) {
  const candidate = { ...geocoded, canonicalKey: canonicalKey(geocoded.formatted) };
  const match = findMatch(store.list(), candidate);

  if (match.kind === 'exact') {
    select(
      match.place.id,
      `Already on the list, added <strong>${new Date(match.place.addedAt).toLocaleDateString()}</strong>. Nothing new was created.`
    );
    return match.place;
  }

  if (match.kind === 'revive') {
    const id = match.place.id;
    await store.update(doc => {
      doc.places[id].deleted = false;
      doc.places[id].updatedAt = nowIso();
      doc.places[id].updatedBy = me;
      if (candidate.placeId) doc.places[id].placeId = candidate.placeId;
    });
    select(id, 'This address was removed earlier. The original record was restored.');
    await runAnalysis(id);
    return store.get(id);
  }

  if (match.kind === 'maybe') {
    const same = window.confirm(
      `This looks like ${match.place.formatted}, which is already on the list.\n\n` +
      'OK to open that one, or Cancel to add this as a separate property.'
    );
    if (same) {
      select(match.place.id, 'Opened the existing record instead of adding a duplicate.');
      return match.place;
    }
  }

  const place = makePlace({ ...geocoded, userKey: me });
  await store.update(doc => { doc.places[place.id] = place; });
  select(place.id);
  await runAnalysis(place.id);
  return store.get(place.id);
}

async function runAnalysis(id) {
  const place = store.get(id);
  if (!place) return;
  busy = true;
  banner = null;
  render();
  try {
    const result = await analyzeAddress(place);
    await store.update(doc => {
      doc.places[id].report = result;
      doc.places[id].updatedAt = nowIso();
      doc.places[id].updatedBy = me;
    });
  } catch (err) {
    console.error(err);
    toast('The analysis did not finish. Try again.');
  } finally {
    busy = false;
    render();
  }
}

/* ------------------------------- wiring ----------------------------- */

$('reportClose').addEventListener('click', close);
$('reportDelete').addEventListener('click', () => selectedId && remove(selectedId));
$('reportRerun').addEventListener('click', () => selectedId && runAnalysis(selectedId));

$('drawerHandle').addEventListener('click', () => {
  const open = $('drawer').classList.toggle('open');
  $('drawerHandle').setAttribute('aria-expanded', String(open));
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('entry').hidden) close();
});

/* Fallback address entry, used when Places autocomplete is unavailable. */
$('addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('addressInput');
  const text = input.value.trim();
  if (text.length < 5) return;
  const jitter = () => (Math.random() - 0.5) * 0.03;
  await addPlace({
    formatted: text,
    placeId: null,
    lat: CONFIG.DEFAULT_CENTER.lat + jitter(),
    lng: CONFIG.DEFAULT_CENTER.lng + jitter()
  });
  input.value = '';
});

/* ----------------------------- map style ---------------------------- */

function buildStyleMenu() {
  const menu = $('styleMenu');
  const btn = $('styleBtn');
  btn.hidden = false;

  const paint = () => {
    const current = loadBasemapChoice();
    menu.textContent = '';
    for (const b of availableBasemaps()) {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('aria-current', String(b.id === current));
      const l = document.createElement('span');
      l.className = 'sl';
      l.textContent = b.label;
      const n = document.createElement('span');
      n.className = 'sn';
      n.textContent = b.note;
      item.append(l, n);
      item.addEventListener('click', () => {
        map.setBasemap(b.id);
        paint();
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      });
      menu.appendChild(item);
    }
  };
  paint();

  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    btn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', e => {
    if (!menu.hidden && !menu.contains(e.target)) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* -------------------------------- boot ------------------------------ */

(async function boot() {
  const saved = loadPersona();
  if (saved) setPersona(saved.id);
  else entry.show();

  try {
    map = await createMap($('map'));
    map.onSelect(id => select(id));
    map.onBackgroundClick(close);
    if (map.degraded) $('notice').textContent = map.degraded;
    if (map.setBasemap) buildStyleMenu();

    const ac = await mountAutocomplete($('acHost'), geocoded => addPlace(geocoded));
    if (ac) $('addForm').classList.add('has-autocomplete');
  } catch (err) {
    console.error(err);
    $('notice').textContent =
      'The map could not load. Check MAP_PROVIDER and the keys in js/config.js.';
  }

  await store.load();
  render();
})();

window.__houseHunter = { store, addPlace, runAnalysis, PERSONAS };
