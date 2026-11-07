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

const isMergeableManeuver = (step) => !['depart', 'arrive'].includes(step?.maneuver?.type);
const startLowercase = (text) => text ? text[0].toLowerCase() + text.slice(1) : text;

export function combineNearbySteps(steps, maximumDistance = 300) {
  const combined = [];
  for (let index = 0; index < steps.length; index += 1) {
    const first = steps[index];
    const second = steps[index + 1];
    const shouldCombine = second
      && first.distance <= maximumDistance
      && isMergeableManeuver(first)
      && isMergeableManeuver(second);

    if (!shouldCombine) {
      combined.push(first);
      continue;
    }

    const firstCoordinates = first.geometry?.coordinates || [];
    const secondCoordinates = second.geometry?.coordinates || [];
    combined.push({
      ...first,
      distance: first.distance + second.distance,
      duration: first.duration + second.duration,
      geometry: firstCoordinates.length && secondCoordinates.length
        ? { ...first.geometry, coordinates: [...firstCoordinates, ...secondCoordinates.slice(1)] }
        : first.geometry,
      instruction: `${first.instruction.replace(/\.$/, '')}, then ${startLowercase(second.instruction)}`,
    });
    index += 1;
  }
  return combined;
}

export const formatDistance = (meters) => meters < 160.9344
  ? `${Math.round(meters * 3.28084)} ft`
  : `${(meters / 1609.344).toFixed(1)} mi`;
export const formatDuration = (seconds) => {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${totalMinutes} min`;
  if (!minutes) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
};
