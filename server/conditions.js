import phrases from './voice-phrases.json' with { type: 'json' };

const UDOT_API = 'https://www.udottraffic.utah.gov/api/v2/get';
const RADIUS_METERS = 1_000;
const radians = Math.PI / 180;

export const distanceMeters = (a, b) => {
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export function nearRoute(item, coordinates) {
  const point = { lat: Number(item.Latitude ?? item.latitude), lng: Number(item.Longitude ?? item.longitude) };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  return coordinates.some(([lng, lat]) => distanceMeters(point, { lat, lng }) <= RADIUS_METERS);
}

export function severityOf(event) {
  const text = `${event.EventType || ''} ${event.EventCategory || ''} ${event.Severity || ''} ${event.Description || ''}`.toLowerCase();
  if (event.IsFullClosure || text.includes('closure')) return 4;
  if (text.includes('accident') || text.includes('incident') || text.includes('high')) return 3;
  if (text.includes('construction') || text.includes('roadwork') || text.includes('lane')) return 2;
  return 1;
}

function normalizeEvent(event) {
  const type = event.IsFullClosure ? 'closure' : event.EventType === 'roadwork' ? 'construction' : 'incident';
  const location = event.Location || event.RoadwayName || event.Name || 'your route';
  return { id: String(event.ID ?? event.SourceId), type, severity: severityOf(event), location, description: event.Description || event.EventCategory || 'UDOT traffic update', lat: Number(event.Latitude), lng: Number(event.Longitude), phrase: (phrases[type] || phrases.default).replace('{location}', location) };
}

export async function getRouteConditions({ geometry, destinationId, apiKey, fetcher = fetch }) {
  if (!apiKey) return { configured: false, alerts: [], cameras: [], canyonStatus: null };
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates) || !coordinates.length) throw new Error('A route geometry is required.');
  const request = (resource) => fetcher(`${UDOT_API}/${resource}?key=${encodeURIComponent(apiKey)}&format=json`).then(async (response) => {
    if (!response.ok) throw new Error('UDOT did not return conditions.');
    return response.json();
  });
  const [eventData, cameraData] = await Promise.all([request('event'), request('camera')]);
  const events = eventData.Events ?? eventData ?? [];
  const cameras = cameraData.Cameras ?? cameraData ?? [];
  const alerts = events.filter((event) => nearRoute(event, coordinates)).map(normalizeEvent).sort((a, b) => b.severity - a.severity);
  const visibleCameras = cameras.filter((camera) => nearRoute(camera, coordinates)).map((camera) => ({ id: String(camera.ID ?? camera.CameraId), name: camera.Name || camera.Description || 'UDOT camera', lat: Number(camera.Latitude), lng: Number(camera.Longitude), url: camera.Url || camera.CameraUrl || null }));
  const canyon = { littleCottonwood: /little cottonwood|sr[- ]?210/i, bigCottonwood: /big cottonwood|sr[- ]?190/i, parkCity: /park city|us[- ]?189/i, snowbasin: /snowbasin|sr[- ]?226/i }[destinationId];
  const canyonAlerts = canyon ? alerts.filter((alert) => canyon.test(`${alert.location} ${alert.description}`)) : [];
  return { configured: true, alerts, cameras: visibleCameras, canyonStatus: canyon ? { destinationId, alerts: canyonAlerts } : null };
}

export const unhealthyMessage = (aqi) => Number(aqi) >= 101 ? 'The air’s not great out there, maybe stay in today, love.' : null;

export async function getAirQuality({ start, end, apiKey, fetcher = fetch, baseUrl = 'https://www.airnowapi.org/aq/observation/latLong/current/' }) {
  if (!apiKey) return { configured: false, start: null, destination: null };
  const observation = async (point) => {
    const url = new URL(baseUrl);
    url.search = new URLSearchParams({ format: 'application/json', latitude: point.lat, longitude: point.lng, distance: '25', API_KEY: apiKey });
    const response = await fetcher(url);
    if (!response.ok) throw new Error('AirNow did not return air quality.');
    const data = await response.json();
    const readings = Array.isArray(data) ? data : data.observations ?? [];
    const reading = readings.reduce((worst, item) => Number(item.AQI ?? item.aqi) > Number(worst?.AQI ?? worst?.aqi ?? -1) ? item : worst, null);
    return reading ? { aqi: Number(reading.AQI ?? reading.aqi), category: reading.Category?.Name ?? reading.category ?? 'Unknown', reportingArea: reading.ReportingArea ?? reading.reportingArea ?? null } : null;
  };
  const [startResult, destination] = await Promise.all([observation(start), observation(end)]);
  return { configured: true, start: startResult, destination };
}
