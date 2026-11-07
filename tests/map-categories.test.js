import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCategories, mapCategoryColors } from '../src/data/map-categories.js';

test('map legend categories use the same colors as map markers', () => {
  assert.deepEqual(mapCategories.map(({ id }) => id), ['parks', 'trails', 'landmarks']);
  assert.deepEqual(mapCategoryColors, {
    parks: '#607d43',
    trails: '#317a8a',
    landmarks: '#9c6a9f',
  });
});
