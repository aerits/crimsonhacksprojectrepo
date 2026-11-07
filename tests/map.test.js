import test from 'node:test';
import assert from 'node:assert/strict';
import { routeColorForTheme } from '../src/services/map.js';

test('route colors follow the active app theme', () => {
  assert.equal(routeColorForTheme('light'), '#9471b8');
  assert.equal(routeColorForTheme('pink'), '#d75a89');
  assert.equal(routeColorForTheme('verity'), '#f4cc28');
  assert.equal(routeColorForTheme('dark'), '#c8a6dd');
  assert.equal(routeColorForTheme('unknown'), '#9471b8');
});
