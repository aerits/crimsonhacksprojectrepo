const EARTH_RADIUS_METERS = 6371008.8;
const radians = (degrees) => degrees * Math.PI / 180;

export function isValidPoint(point) {
  return Number.isFinite(point?.lat) && Math.abs(point.lat) <= 90
    && Number.isFinite(point?.lng) && Math.abs(point.lng) <= 180;
}

// Great-circle distance, not road distance. Clamp rounding near antipodal points.
export function distanceBetween(from, to) {
  const a = Math.sin(radians(to.lat - from.lat) / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat))
    * Math.sin(radians(to.lng - from.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function addressSearchOrigin(kind, start, currentLocation) {
  if (kind === 'end' && isValidPoint(start)) return { ...start, label: 'your starting point' };
  if (isValidPoint(currentLocation)) return { ...currentLocation, label: 'your current location' };
  return null;
}
