// Curated, static coordinates keep notable Utah destinations discoverable even
// when a general-purpose geocoder returns broad or distant matches first.
const landmarks = [
  ['Salt Lake Temple', 40.7706, -111.8910, ['temple', 'salt lake temple']],
  ['Temple Square', 40.7700, -111.8911, ['temple square']],
  ['Utah State Capitol', 40.7775, -111.8880, ['capitol', 'state capitol']],
  ['University of Utah', 40.7649, -111.8421, ['university', 'u of u']],
  ['Natural History Museum of Utah', 40.7650, -111.8226, ['natural history museum', 'nhmu']],
  ['Red Butte Garden', 40.7668, -111.8255, ['red butte']],
  ['Hogle Zoo', 40.7505, -111.8162, ['zoo', 'hogle']],
  ['Round1 Bowling & Arcade', 40.7430, -111.8998, ['round 1', 'round1', 'round 1 arcade']],
  ['This Is the Place Heritage Park', 40.7504, -111.8143, ['this is the place', 'heritage park']],
  ['Antelope Island State Park', 41.0548, -112.2272, ['antelope island']],
  ['Great Salt Lake State Park', 40.7379, -112.2115, ['great salt lake']],
  ['Park City Mountain', 40.6514, -111.5080, ['park city', 'park city mountain']],
  ['Sundance Mountain Resort', 40.3915, -111.5815, ['sundance']],
  ['Arches National Park', 38.7331, -109.5925, ['arches']],
  ['Delicate Arch', 38.7436, -109.4993, ['delicate arch']],
  ['Canyonlands National Park', 38.3269, -109.8783, ['canyonlands']],
  ['Capitol Reef National Park', 38.2822, -111.2470, ['capitol reef']],
  ['Bryce Canyon National Park', 37.6283, -112.1677, ['bryce', 'bryce canyon']],
  ['Zion National Park', 37.2982, -113.0263, ['zion']],
  ['Bonneville Salt Flats', 40.7619, -113.8958, ['bonneville', 'salt flats']],
  ['Monument Valley', 37.0042, -110.1735, ['monument valley']],
].map(([name, lat, lng, aliases]) => ({ name, lat, lng, aliases }));

export const utahNationalParks = landmarks.filter(({ name }) => name.endsWith('National Park'));

const utahTrails = [
  { name: 'Angels Landing Trailhead', lat: 37.2596, lng: -112.9510 },
  { name: 'Delicate Arch Trailhead', lat: 38.7435, lng: -109.4997 },
  { name: 'Navajo Loop Trailhead', lat: 37.6287, lng: -112.1673 },
  { name: 'Timpanogos Trailhead', lat: 40.4270, lng: -111.6830 },
  { name: 'Cecret Lake Trailhead', lat: 40.5739, lng: -111.6352 },
];

export const utahMapDestinations = [
  ...utahNationalParks.map((place) => ({ ...place, category: 'parks' })),
  ...utahTrails.map((place) => ({ ...place, category: 'trails' })),
  ...landmarks.filter((place) => !place.name.endsWith('National Park'))
    .map((place) => ({ ...place, category: 'landmarks' })),
];

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function findUtahLandmarks(query) {
  const needle = normalize(query);
  if (!needle) return [];
  return landmarks.map((landmark) => {
    const names = [landmark.name, ...landmark.aliases].map(normalize);
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
