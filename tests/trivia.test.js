import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmbientTrivia, nextManeuverDistance } from '../src/services/trivia.js';

const point = { lat: 33, lng: -87 };
const clearSteps = [{ maneuver: { location: [-87, 33] } }, { maneuver: { location: [-87, 33.1] } }];

test('uses the maneuver after the current location to detect a clear road', () => {
  assert.ok(nextManeuverDistance(point, clearSteps) > 8_047);
});

test('trivia requires sustained, clear-road cruising and observes cooldown', () => {
  let time = 0;
  const trivia = createAmbientTrivia({ now: () => time });
  const input = { point, speedMps: 21, navigating: true, muted: false, steps: clearSteps };
  assert.equal(trivia.consider(input), null);
  time = 5 * 60 * 1000;
  assert.ok(trivia.consider(input));
  time += 10 * 60 * 1000;
  assert.equal(trivia.consider(input), null);
  time += 8 * 60 * 1000;
  assert.ok(trivia.consider(input));
});

test('slow or muted driving never starts trivia', () => {
  const trivia = createAmbientTrivia({ now: () => 10 * 60 * 1000 });
  assert.equal(trivia.consider({ point, speedMps: 10, navigating: true, muted: false, steps: clearSteps }), null);
  assert.equal(trivia.consider({ point, speedMps: 21, navigating: true, muted: true, steps: clearSteps }), null);
});
