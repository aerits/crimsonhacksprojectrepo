export function parseCoordinates(value) {
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length !== 2 || parts.some((part) => !part)) throw new Error('Use latitude, longitude — or select a point on the map.');
  const [lat, lng] = parts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('Latitude must be −90 to 90 and longitude −180 to 180.');
  }
  return { lat, lng };
}

export function instructionFor(step) {
  const { type, modifier, exit } = step.maneuver;
  const road = step.name ? ` onto ${step.name}` : '';
  const direction = modifier ? modifier.replaceAll('-', ' ') : '';
  if (type === 'depart') return `Head ${direction || 'out'}${road}.`;
  if (type === 'arrive') return 'You have arrived at your destination.';
  if (direction === 'uturn') return `Make a U-turn${road}.`;
  if (type.includes('roundabout') || type === 'rotary') return `At the roundabout, ${exit ? `take exit ${exit}` : 'continue'}${road}.`;
  if (type === 'merge') return `Merge ${direction}${road}.`;
  if (type === 'on ramp') return `Take the ramp ${direction}${road}.`;
  if (type === 'off ramp') return `Take the exit ${direction}${road}.`;
  if (type === 'fork') return `Keep ${direction || 'straight'}${road}.`;
  if (type === 'end of road' || type === 'turn') return `Turn ${direction || 'ahead'}${road}.`;
  return `Continue ${direction || 'straight'}${road}.`;
}

export const formatDistance = (meters) => meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
export const formatDuration = (seconds) => `${Math.max(1, Math.round(seconds / 60))} min`;
