import { nowIso } from './model.js';

/**
 * The one function the rest of the app knows about.
 *
 *   analyzeAddress(place) -> Promise<Report>
 *
 * Report shape, fixed now so the UI is stable while the implementation
 * changes underneath:
 *
 *   {
 *     generatedAt: ISO string,
 *     engineVersion: string,
 *     sections: [
 *       {
 *         key: string,
 *         title: string,
 *         body: string,
 *         sources: [{ label, url, retrievedAt }],
 *         gap: string | null      // what could not be established, and why
 *       }
 *     ]
 *   }
 *
 * Two rules the real engine must keep:
 *
 *   1. Every claim carries its source. A section with no source is a gap,
 *      not a sentence with the source left off.
 *   2. Nothing is estimated to fill a hole. If the county has no record of
 *      a permit, the section says so rather than guessing.
 *
 * The search-backed engine replaces `placeholderEngine` below. A browser
 * page cannot hold a search API key, so that version needs either a key
 * the user pastes into settings or a small proxy — plan §9, decision 2.
 */

export const ENGINE_VERSION = '0.1-placeholder';

const SECTIONS = [
  { key: 'ownership', title: 'Ownership and sale history' },
  { key: 'tax', title: 'Property tax' },
  { key: 'permits', title: 'Permit history' },
  { key: 'hazard', title: 'Hazard zones' }
];

async function placeholderEngine(place) {
  await new Promise(r => setTimeout(r, 700));
  return {
    generatedAt: nowIso(),
    engineVersion: ENGINE_VERSION,
    sections: SECTIONS.map(s => ({
      key: s.key,
      title: s.title,
      body: '',
      sources: [],
      gap: 'No analysis engine is connected yet, so nothing has been looked up for this address.'
    }))
  };
}

let engine = placeholderEngine;

/** Swap the implementation without touching callers. */
export function setEngine(fn) {
  engine = fn;
}

export function analyzeAddress(place) {
  return engine(place);
}
