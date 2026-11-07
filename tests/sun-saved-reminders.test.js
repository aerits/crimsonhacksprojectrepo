import test from 'node:test';
import assert from 'node:assert/strict';
import { solarPosition, sunGlare } from '../src/utils/sun.js';
import { loadSavedPlaces, saveSavedPlaces, upsertPlace, removePlace } from '../src/utils/saved-places.js';
import { createReminder } from '../src/utils/reminders.js';

test('solar math puts the equatorial noon sun high in the sky near an equinox', () => {
  const sun = solarPosition({ lat: 0, lng: 0 }, '2024-03-20T12:00:00Z');
  assert.ok(sun.elevation > 80);
  assert.equal(sunGlare({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, '2024-03-20T12:00:00Z').glare, false);
});

test('saved places survive updates and tolerate unavailable storage', () => {
  const data = new Map(); const storage = { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
  let places = upsertPlace([], { id: 'home', name: 'Home', lat: 40, lng: -111 });
  assert.equal(saveSavedPlaces(places, storage), true);
  assert.equal(loadSavedPlaces(storage)[0].name, 'Home');
  places = removePlace(places, 'home'); assert.equal(places.length, 0);
  assert.deepEqual(loadSavedPlaces({ getItem() { throw new Error('blocked'); } }), []);
});

test('reminders fire only after the selected elapsed interval', () => {
  let time = 0; const reminder = createReminder({ now: () => time }); reminder.start();
  time = 29 * 60_000; assert.equal(reminder.due(30, true), false);
  time = 30 * 60_000; assert.equal(reminder.due(30, true), true);
  time = 45 * 60_000; assert.equal(reminder.due(30, true), false);
});
