import { normalizeCustomPhrases } from '../utils/phrases.js';

const STORAGE_KEY = 'mommy-maps-after-turn-phrases';

export function createPhraseStore(storage) {
  let phrases = [];
  let loadError = false;
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    if (saved) phrases = normalizeCustomPhrases(JSON.parse(saved));
  } catch { loadError = true; }
  return {
    loadError,
    get() { return [...phrases]; },
    save(value) {
      const next = normalizeCustomPhrases(value);
      let persisted = false;
      try {
        if (storage) {
          storage.setItem(STORAGE_KEY, JSON.stringify(next));
          persisted = true;
        }
      } catch { /* Keep changes usable for this visit if storage is unavailable. */ }
      phrases = next;
      return persisted;
    },
  };
}
