import { instructionFor } from '../utils/directions.js';

export async function getRoute(start, end, { signal, baseUrl = 'https://router.project-osrm.org', fetcher = fetch, avoid = [] } = {}) {
  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/route/v1/driving/${coordinates}`);
  const query = { overview: 'full', geometries: 'geojson', steps: 'true' };
  if (avoid.length) query.exclude = avoid.join(',');
  url.search = new URLSearchParams(query);
  const response = await fetcher(url, { signal });
  if (!response.ok) throw new Error('The routing service is unavailable. Please try again.');
  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No driving route found. Try points closer to a road.');
  const route = data.routes[0];
  return {
    distance: route.distance, duration: route.duration, geometry: route.geometry,
    steps: route.legs.flatMap((leg) => leg.steps).map((step) => ({ ...step, instruction: instructionFor(step) })),
  };
}
