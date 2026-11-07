import test from 'node:test';
import assert from 'node:assert/strict';
import { stateParkPageUrl, utahStateParks } from '../src/data/utah-outdoors.js';

test('Utah outdoors catalog includes all 46 distinct state parks', () => {
  assert.equal(utahStateParks.length, 46);
  assert.equal(new Set(utahStateParks).size, 46);
});

test('state park selections resolve to their own official Utah State Parks pages', () => {
  assert.equal(stateParkPageUrl('Antelope Island State Park'), 'https://stateparks.utah.gov/parks/antelope-island/');
  assert.equal(stateParkPageUrl('Fred Hayes State Park at Starvation'), 'https://stateparks.utah.gov/parks/starvation/');
  assert.equal(stateParkPageUrl('Utah Field House of Natural History State Park Museum'), 'https://stateparks.utah.gov/parks/utah-field-house/');
});
