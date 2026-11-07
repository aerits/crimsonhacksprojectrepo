const MIN_SPEED_MPS = 70 / 3.6;
const MIN_CLEAR_DISTANCE_METERS = 8_047;
const MIN_CRUISE_MS = 5 * 60 * 1000;
const FACT_COOLDOWN_MS = 18 * 60 * 1000;

const facts = [
  { name: 'Tuscaloosa', lat: 33.2098, lng: -87.5692, text: 'You’re near Tuscaloosa, where the Black Warrior River helped turn a river crossing into one of Alabama’s oldest cities.' },
  { name: 'the Appalachian region', lat: 35.5, lng: -84, text: 'These old mountains began forming hundreds of millions of years ago. Time has rounded their peaks, but their geology still tells a very long story.' },
  { name: 'the Rocky Mountain region', lat: 39.5, lng: -106, text: 'The Rocky Mountains are still rising in places. Their dramatic relief comes from a long history of uplift, erosion, and glaciation.' },
  { name: 'the Great Plains', lat: 39, lng: -98, text: 'The open horizon here was shaped by rivers carrying sediment east from the Rockies for millions of years.' },
  { name: 'the Gulf Coast region', lat: 30.5, lng: -89, text: 'This low, coastal landscape was built gradually from river sediment meeting the Gulf—always changing, one grain at a time.' },
];

export const distanceMeters = (a, b) => {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export function nextManeuverDistance(point, steps) {
  const maneuvers = steps.map((step, index) => ({ index, location: step.maneuver?.location })).filter((step) => Array.isArray(step.location));
  if (!maneuvers.length) return Infinity;
  const closest = maneuvers.reduce((nearest, candidate) => {
    const distance = distanceMeters(point, { lng: candidate.location[0], lat: candidate.location[1] });
    return distance < nearest.distance ? { ...candidate, distance } : nearest;
  }, { distance: Infinity });
  const next = maneuvers.find((candidate) => candidate.index > closest.index);
  return next ? distanceMeters(point, { lng: next.location[0], lat: next.location[1] }) : Infinity;
}

export function factFor(point) {
  return facts.reduce((nearest, fact) => distanceMeters(point, fact) < distanceMeters(point, nearest) ? fact : nearest, facts[0]);
}

export function createAmbientTrivia({ now = () => Date.now() } = {}) {
  let cruiseStartedAt;
  let lastFactAt = -Infinity;
  return {
    consider({ point, speedMps, steps, navigating, muted }) {
      const clearRoad = nextManeuverDistance(point, steps) >= MIN_CLEAR_DISTANCE_METERS;
      if (!navigating || muted || !Number.isFinite(speedMps) || speedMps < MIN_SPEED_MPS || !clearRoad) { cruiseStartedAt = undefined; return null; }
      const time = now();
      cruiseStartedAt ??= time;
      if (time - cruiseStartedAt < MIN_CRUISE_MS || time - lastFactAt < FACT_COOLDOWN_MS) return null;
      lastFactAt = time;
      cruiseStartedAt = time;
      return factFor(point);
    },
    skip() { lastFactAt = now(); cruiseStartedAt = undefined; },
    reset() { cruiseStartedAt = undefined; },
  };
}
