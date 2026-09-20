// Pure data logic. No DOM, no network. Everything here is unit-testable.

const SUFFIX = {
  STREET: 'ST', ST: 'ST', AVENUE: 'AVE', AVE: 'AVE', AV: 'AVE',
  ROAD: 'RD', RD: 'RD', DRIVE: 'DR', DR: 'DR', LANE: 'LN', LN: 'LN',
  COURT: 'CT', CT: 'CT', BOULEVARD: 'BLVD', BLVD: 'BLVD', BLV: 'BLVD',
  WAY: 'WAY', TERRACE: 'TER', TER: 'TER', PLACE: 'PL', PL: 'PL',
  CIRCLE: 'CIR', CIR: 'CIR', PARKWAY: 'PKWY', PKWY: 'PKWY',
  HIGHWAY: 'HWY', HWY: 'HWY', SQUARE: 'SQ', TRAIL: 'TRL'
};

const DIRECTION = {
  NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
  NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW'
};

const UNIT_WORDS = /\b(APT|APARTMENT|UNIT|STE|SUITE|NO|RM|ROOM)\b/g;

/**
 * Pull a unit designator out of a raw address string.
 * Returns { unit, rest } where rest has the unit removed.
 */
export function splitUnit(raw) {
  let unit = '';
  let rest = raw;

  // "#2", "Apt 2", "Unit 2B", "Suite 300"
  const m = rest.match(/(?:#\s*|\b(?:APT|APARTMENT|UNIT|STE|SUITE)\b\.?\s*)([A-Za-z0-9-]+)/i);
  if (m) {
    unit = m[1].toUpperCase();
    rest = rest.replace(m[0], ' ');
  }
  return { unit, rest };
}

/**
 * Normalize an address into a comparison key.
 * Two strings that describe the same property should produce the same key.
 * The unit is part of the key, so #2 and #3 stay distinct properties.
 */
export function canonicalKey(raw) {
  const { unit, rest } = splitUnit(String(raw || ''));

  const core = rest
    .toUpperCase()
    .replace(/[.,]/g, ' ')
    .replace(/#/g, ' ')
    .replace(UNIT_WORDS, ' ')
    .replace(/\bUNITED STATES\b|\bUSA\b|\bUS\b$/g, ' ')
    // ZIP is dropped on purpose. Autocomplete supplies one and hand-typed
    // addresses often do not, and a single property never spans two ZIPs,
    // so including it would split records rather than distinguish them.
    .replace(/\b\d{5}(-\d{4})?\b/g, ' ')
    .replace(/\bCALIFORNIA\b/g, 'CA')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => DIRECTION[w] || SUFFIX[w] || w)
    .join(' ')
    .trim();

  return unit ? `${core}|#${unit}` : core;
}

export const uid = () =>
  'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const nowIso = () => new Date().toISOString();

/**
 * Metres between two coordinates. Used by the proximity dedup layer.
 */
export function metresBetween(a, b) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function houseNumber(key) {
  const m = key.match(/^(\d+)\b/);
  return m ? m[1] : null;
}

/**
 * Three-layer dedup from the plan, §7.
 *
 * Returns one of:
 *   { kind: 'none' }
 *   { kind: 'exact',    place }  placeId or canonical key matched
 *   { kind: 'revive',   place }  matched a tombstoned record
 *   { kind: 'maybe',    place }  proximity match, needs the user to confirm
 */
export function findMatch(places, candidate) {
  const key = candidate.canonicalKey || canonicalKey(candidate.formatted);

  if (candidate.placeId) {
    const byId = places.find(p => p.placeId && p.placeId === candidate.placeId);
    if (byId) return { kind: byId.deleted ? 'revive' : 'exact', place: byId };
  }

  const byKey = places.find(p => p.canonicalKey === key);
  if (byKey) return { kind: byKey.deleted ? 'revive' : 'exact', place: byKey };

  if (candidate.lat != null) {
    const num = houseNumber(key);
    const near = places.find(p =>
      !p.deleted &&
      num && houseNumber(p.canonicalKey) === num &&
      metresBetween(candidate, p) <= 25
    );
    if (near) return { kind: 'maybe', place: near };
  }

  return { kind: 'none' };
}

/**
 * Build a new place record. `report` is attached later by the analyzer.
 */
export function makePlace({ formatted, placeId = null, lat, lng, userKey }) {
  const { unit } = splitUnit(formatted);
  const t = nowIso();
  return {
    id: uid(),
    formatted,
    placeId,
    unit,
    canonicalKey: canonicalKey(formatted),
    lat,
    lng,
    // { [personaId]: { on, at } }. A like is timestamped state rather than a
    // flag, because either person can remove either person's like and the
    // merge has to be able to tell an unlike from a stale copy. Plan §5.
    likes: {},
    deleted: false,
    addedAt: t,
    addedBy: userKey,   // recorded, never displayed in v1
    updatedAt: t,
    updatedBy: userKey,
    report: null
  };
}

/** Is this place liked by the given persona right now? */
export const likedBy = (place, personaId) =>
  Boolean(place?.likes?.[personaId]?.on);

export const likers = place =>
  Object.entries(place?.likes || {})
    .filter(([, v]) => v.on)
    .map(([id]) => id);

export const likedByAnyone = place => likers(place).length > 0;

/**
 * Set or clear one persona's like. `actor` is whoever is using the app, which
 * may differ from `personaId` — either person can remove the other's like.
 */
export function setLike(place, personaId, on, actor = personaId) {
  place.likes = place.likes || {};
  place.likes[personaId] = { on: Boolean(on), at: nowIso() };
  place.updatedAt = nowIso();
  place.updatedBy = actor;
  return place;
}

export function toggleLike(place, personaId, actor = personaId) {
  return setLike(place, personaId, !likedBy(place, personaId), actor);
}

/**
 * Ordering, plan §8: the places you liked first, then ones only the other
 * person liked, then everything else. Newest first inside each band.
 */
export function sortPlaces(places, myPersonaId) {
  const band = p =>
    likedBy(p, myPersonaId) ? 0 : likedByAnyone(p) ? 1 : 2;
  return places
    .filter(p => !p.deleted)
    .sort((a, b) =>
      band(a) - band(b) ||
      new Date(b.addedAt) - new Date(a.addedAt)
    );
}

/**
 * Per-place merge used when two clients write concurrently, plan §6.
 * Tombstones win. Otherwise the newer updatedAt wins, except likes,
 * which are unioned so neither person's heart is lost.
 */
export function mergeLikes(a = {}, b = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id];
    const y = b[id];
    if (!x) { out[id] = y; continue; }
    if (!y) { out[id] = x; continue; }
    out[id] = new Date(y.at) > new Date(x.at) ? y : x;
  }
  return out;
}

export function mergePlace(mine, theirs) {
  if (!mine) return theirs;
  if (!theirs) return mine;

  const likes = mergeLikes(mine.likes, theirs.likes);
  const winner =
    mine.deleted || theirs.deleted
      ? (mine.deleted ? mine : theirs)
      : new Date(theirs.updatedAt) > new Date(mine.updatedAt) ? theirs : mine;

  return { ...winner, likes };
}

/**
 * Merge two whole documents. Also collapses same-key duplicates created
 * by simultaneous adds: the older record survives and inherits both
 * likes plus the newer report.
 */
export function mergeDocs(mine, theirs) {
  const out = {};
  for (const id of new Set([...Object.keys(mine.places || {}), ...Object.keys(theirs.places || {})])) {
    out[id] = mergePlace(mine.places?.[id], theirs.places?.[id]);
  }

  const byKey = new Map();
  for (const p of Object.values(out)) {
    if (p.deleted) continue;
    const seen = byKey.get(p.canonicalKey);
    if (!seen) { byKey.set(p.canonicalKey, p); continue; }

    const keep = new Date(seen.addedAt) <= new Date(p.addedAt) ? seen : p;
    const drop = keep === seen ? p : seen;
    keep.likes = mergeLikes(keep.likes, drop.likes);
    if (drop.report && (!keep.report || new Date(drop.report.generatedAt) > new Date(keep.report.generatedAt))) {
      keep.report = drop.report;
    }
    drop.deleted = true;
    drop.updatedAt = nowIso();
    byKey.set(p.canonicalKey, keep);
  }

  return { schemaVersion: 1, places: out };
}
