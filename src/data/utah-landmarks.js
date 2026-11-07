// Curated, static coordinates keep notable Utah destinations discoverable even
// when a general-purpose geocoder returns broad or distant matches first.
import catalog from './utah-landmarks.json' with { type: 'json' };

const landmarks = catalog.landmarks;

export const utahNationalParks = landmarks.filter(({ name }) => name.endsWith('National Park'));

const utahTrails = catalog.trails;

export const utahMapDestinations = [
  ...utahNationalParks.map((place) => ({ ...place, category: 'parks' })),
  ...utahTrails.map((place) => ({ ...place, category: 'trails' })),
  ...landmarks.filter((place) => !place.name.endsWith('National Park'))
    .map((place) => ({ ...place, category: 'landmarks' })),
];

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function findUtahLandmarks(query, categories) {
  const needle = normalize(query);
  if (!needle) return [];
  const candidates = categories ? utahMapDestinations.filter((place) => categories.has(place.category)) : landmarks;
  return candidates.map((landmark) => {
    // Trails need only a display name; landmarks may optionally have aliases.
    // Keep mixed category searches from failing on alias-less trail records.
    const names = [landmark.name, ...(landmark.aliases || [])].map(normalize);
    const score = names.reduce((best, name) => {
      if (name === needle) return 0;
      if (name.startsWith(needle)) return Math.min(best, 1);
      if (name.includes(needle) || needle.includes(name)) return Math.min(best, 2);
      return best;
    }, Infinity);
    return { ...landmark, score };
  }).filter((landmark) => Number.isFinite(landmark.score))
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
}
