import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceBetween, isValidPoint, addressSearchOrigin } from '../src/utils/location.js';
import { searchAddresses } from '../src/services/geocoding.js';
import { findUtahLandmarks } from '../src/data/utah-landmarks.js';

test('straight-line distances handle identical points, the dateline, and antipodes', () => {
  assert.equal(distanceBetween({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.ok(Math.abs(distanceBetween({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111195.08) < 1);
  assert.ok(Math.abs(distanceBetween({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 }) - 22239.02) < 1);
  assert.ok(Math.abs(distanceBetween({ lat: 90, lng: 0 }, { lat: -90, lng: 0 }) - 20015114.44) < 1);
});

test('only finite coordinates in geographic bounds are valid', () => {
  for (const point of [null, {}, { lat: null, lng: 0 }, { lat: '40', lng: 0 },
    { lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: NaN, lng: 0 }, { lat: 0, lng: Infinity }]) {
    assert.equal(isValidPoint(point), false);
  }
  assert.equal(isValidPoint({ lat: 0, lng: 0 }), true);
  assert.equal(isValidPoint({ lat: -90, lng: 180 }), true);
});

test('destination searches use the selected start and starting-address searches use device location', () => {
  const start = { lat: 40.76, lng: -111.84, label: 'Selected address' };
  const location = { lat: 40.77, lng: -111.85 };
  assert.deepEqual(addressSearchOrigin('end', start, location), { ...start, label: 'your starting point' });
  assert.deepEqual(addressSearchOrigin('start', start, location), { ...location, label: 'your current location' });
  assert.deepEqual(addressSearchOrigin('end', null, location), { ...location, label: 'your current location' });
  assert.deepEqual(addressSearchOrigin('end', start, null), { ...start, label: 'your starting point' });
  assert.equal(addressSearchOrigin('start', null, null), null);
  assert.equal(addressSearchOrigin('end', null, null), null);
  assert.equal(start.label, 'Selected address');
});

test('geocoding client sends query, search origin, and cancellation signal', async () => {
  const controller = new AbortController();
  const results = [{ label: 'Coffee & cake', lat: 0, lng: 0.01, distanceMeters: 1112 }];
  const response = await searchAddresses('Coffee & cake', {
    origin: { lat: 0, lng: -111.84 }, signal: controller.signal,
    fetcher: async (path, options) => {
      const url = new URL(path, 'http://localhost');
      assert.equal(url.pathname, '/api/geocode');
      assert.equal(url.searchParams.get('q'), 'Coffee & cake');
      assert.equal(url.searchParams.get('lat'), '0');
      assert.equal(url.searchParams.get('lng'), '-111.84');
      assert.equal(options.signal, controller.signal);
      return Response.json({ results });
    },
  });
  assert.deepEqual(response, { results });
});

test('geocoding without a known origin still searches and reports errors', async () => {
  await assert.rejects(searchAddresses('A place', { fetcher: async (path) => {
    const url = new URL(path, 'http://localhost');
    assert.equal(url.searchParams.has('lat'), false);
    assert.equal(url.searchParams.has('lng'), false);
    return Response.json({ error: 'No address match found.' }, { status: 404 });
  } }), /No address match found/);
});

test('Utah landmark lookup ranks exact and alias matches before broad matches', () => {
  assert.equal(findUtahLandmarks('arches').at(0).name, 'Arches National Park');
  assert.equal(findUtahLandmarks('u of u').at(0).name, 'University of Utah');
  assert.equal(findUtahLandmarks('not a Utah landmark').length, 0);
});
