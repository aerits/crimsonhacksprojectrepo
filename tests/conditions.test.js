import test from 'node:test';
import assert from 'node:assert/strict';
import { getAirQuality, getRouteConditions, unhealthyMessage } from '../server/conditions.js';

test('route conditions retain nearby alerts and order closures first', async () => {
  const fetcher = async (url) => url.includes('/event') ? Response.json({ Events: [
    { ID: 1, Latitude: 40, Longitude: -111, EventType: 'roadwork', Description: 'Lane work', Location: 'Main Street' },
    { ID: 2, Latitude: 40.0002, Longitude: -111.0002, IsFullClosure: true, Description: 'Road closed', Location: 'Canyon Road' },
    { ID: 3, Latitude: 41, Longitude: -112, Description: 'Far away' },
  ] }) : Response.json({ Cameras: [{ ID: 4, Latitude: 40, Longitude: -111, Name: 'Route camera' }] });
  const result = await getRouteConditions({ apiKey: 'key', fetcher, geometry: { coordinates: [[-111, 40], [-111.1, 40.1]] } });
  assert.deepEqual(result.alerts.map((alert) => alert.id), ['2', '1']);
  assert.equal(result.cameras.length, 1);
});

test('AirNow selects the worst AQI and warnings begin at unhealthy', async () => {
  const fetcher = async () => Response.json([{ AQI: 42, Category: { Name: 'Good' } }, { AQI: 132, Category: { Name: 'Unhealthy' } }]);
  const result = await getAirQuality({ apiKey: 'key', fetcher, start: { lat: 40, lng: -111 }, end: { lat: 41, lng: -112 } });
  assert.equal(result.start.aqi, 132);
  assert.match(unhealthyMessage(132), /air is not great/i);
  assert.equal(unhealthyMessage(100), null);
});
