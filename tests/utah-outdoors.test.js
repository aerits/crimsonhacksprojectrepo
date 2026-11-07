import test from 'node:test';
import assert from 'node:assert/strict';
import { utahStateParks, utahTrails } from '../src/data/utah-outdoors.js';

test('Utah outdoors catalog includes all 46 distinct state parks and expanded trail options', () => {
  assert.equal(utahStateParks.length, 46);
  assert.equal(new Set(utahStateParks).size, 46);
  assert.ok(utahTrails.length >= 20);
});
