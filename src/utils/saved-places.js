const KEY = 'softly-saved-places';
export function loadSavedPlaces(storage = localStorage) { try { return JSON.parse(storage.getItem(KEY) || '[]'); } catch { return []; } }
export function saveSavedPlaces(places, storage = localStorage) { try { storage.setItem(KEY, JSON.stringify(places)); return true; } catch { return false; } }
export function upsertPlace(places, place) { return [...places.filter((item) => item.id !== place.id), place]; }
export const removePlace = (places, id) => places.filter((place) => place.id !== id);
