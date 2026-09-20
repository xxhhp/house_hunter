import { mergeDocs } from './model.js';

/**
 * The store owns the document and tells the app when it changes.
 *
 * M0 keeps everything in memory. M1 swaps `load` and `persist` for Drive
 * calls without touching anything above this file — that is the whole
 * point of routing every mutation through here.
 */
export function createStore({ userKey }) {
  let doc = { schemaVersion: 1, places: {} };
  let revision = null;              // Drive headRevisionId, M1
  const listeners = new Set();
  let status = 'ready';             // ready | saving | error

  const emit = () => listeners.forEach(fn => fn(doc, status));

  return {
    get userKey() { return userKey; },
    get status() { return status; },

    subscribe(fn) {
      listeners.add(fn);
      fn(doc, status);
      return () => listeners.delete(fn);
    },

    list() {
      return Object.values(doc.places);
    },

    get(id) {
      return doc.places[id] || null;
    },

    /** Apply a mutation and persist. `fn` receives the live document. */
    async update(fn) {
      fn(doc);
      status = 'saving';
      emit();
      try {
        await this.persist();
        status = 'ready';
      } catch (err) {
        console.error(err);
        status = 'error';
      }
      emit();
    },

    /** Replace the document wholesale, e.g. after a load. */
    setDoc(next) {
      doc = next;
      emit();
    },

    /**
     * Fold a remote document into the local one. Called by the poll loop
     * in M4 and before every write, per plan §6.
     */
    mergeRemote(remote) {
      doc = mergeDocs(doc, remote);
      emit();
      return doc;
    },

    /* ---- replaced in M1 -------------------------------------- */

    async load() {
      return doc;
    },

    async persist() {
      // M1: re-read the Drive file, merge if headRevisionId moved, upload.
      await new Promise(r => setTimeout(r, 120));
      return revision;
    }
  };
}
