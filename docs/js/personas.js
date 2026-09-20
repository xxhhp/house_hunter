/**
 * The two personas. Identity here is a self-declaration, not a credential:
 * either person can pick either name. That is deliberate — the Google account
 * behind Drive is what actually controls access. This only labels likes.
 */

export const PERSONAS = [
  { id: 'shuaige', name: '绝世大帅哥', colorVar: '--pink', short: '帅' },
  { id: 'jizhi',   name: '睿智大机智', colorVar: '--blue', short: '智' }
];

export const byId = id => PERSONAS.find(p => p.id === id) || null;
export const other = id => PERSONAS.find(p => p.id !== id) || null;

const STORAGE_KEY = 'house-hunter.persona';

export function loadPersona() {
  try {
    return byId(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;   // private mode, storage disabled, whatever. Ask again.
  }
}

export function savePersona(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* the app still works for this session without it */
  }
}

export function clearPersona() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
