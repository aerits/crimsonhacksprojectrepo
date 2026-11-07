import test from 'node:test';
import assert from 'node:assert/strict';
import { combineNearbySteps, parseCoordinates, instructionFor } from '../src/utils/directions.js';
import { getRoute } from '../src/services/routing.js';

test('coordinates reject missing, nonnumeric and out-of-range points', () => {
  assert.deepEqual(parseCoordinates('33.21, -87.54'), { lat: 33.21, lng: -87.54 });
  for (const value of ['', ',0', '0,', 'hello, world', '91,0', '0,-181', '0,0,0']) {
    assert.throws(() => parseCoordinates(value));
  }
});

test('directions preserve U-turns, numbered exits and arrival', () => {
  assert.equal(instructionFor({ name: 'Main St', maneuver: { type: 'turn', modifier: 'uturn' } }), 'Make a U-turn onto Main St.');
  assert.equal(instructionFor({ name: '', maneuver: { type: 'roundabout', exit: 3 } }), 'At the roundabout, take exit 3.');
  assert.equal(instructionFor({ maneuver: { type: 'arrive' } }), 'You have arrived at your destination.');
});

test('nearby turns are spoken as one direction', () => {
  const steps = combineNearbySteps([
    { distance: 180, duration: 20, instruction: 'Turn left onto Oak Street.', maneuver: { type: 'turn' } },
    { distance: 850, duration: 90, instruction: 'Turn right onto Pine Avenue.', maneuver: { type: 'turn' } },
    { distance: 100, duration: 10, instruction: 'You have arrived at your destination.', maneuver: { type: 'arrive' } },
  ]);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].instruction, 'Turn left onto Oak Street, then turn right onto Pine Avenue.');
  assert.equal(steps[0].distance, 1030);
});

test('OSRM requests use longitude first and flatten route legs', async () => {
  const route = await getRoute({ lat: 33, lng: -87 }, { lat: 34, lng: -88 }, {
    fetcher: async (url) => {
      assert.equal(url.pathname, '/route/v1/driving/-87,33;-88,34');
      assert.equal(url.searchParams.get('steps'), 'true');
      assert.equal(url.searchParams.get('geometries'), 'geojson');
      return Response.json({ code: 'Ok', routes: [{ distance: 42, duration: 10, geometry: {}, legs: [
        { steps: [{ name: 'Main', maneuver: { type: 'depart' } }] },
        { steps: [{ maneuver: { type: 'arrive' } }] },
      ] }] });
    },
  });
  assert.equal(route.steps.length, 2);
  assert.equal(route.steps[1].instruction, 'You have arrived at your destination.');
});

test('routing preferences are sent as OSRM exclusions', async () => {
  await getRoute({ lat: 33, lng: -87 }, { lat: 34, lng: -88 }, {
    avoid: ['toll', 'motorway', 'ferry'],
    fetcher: async (url) => {
      assert.equal(url.searchParams.get('exclude'), 'toll,motorway,ferry');
      return Response.json({ code: 'Ok', routes: [{ distance: 42, duration: 10, geometry: {}, legs: [{ steps: [] }] }] });
    },
  });
});

test('routing failures produce useful errors', async () => {
  const point = { lat: 0, lng: 0 };
  await assert.rejects(getRoute(point, point, { fetcher: async () => Response.json({ code: 'NoRoute' }) }), /No driving route/);
  await assert.rejects(getRoute(point, point, { fetcher: async () => new Response('', { status: 503 }) }), /unavailable/);
});
