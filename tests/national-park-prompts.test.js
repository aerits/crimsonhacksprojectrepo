import test from 'node:test';
import assert from 'node:assert/strict';
import { utahNationalParks } from '../src/data/utah-landmarks.js';
import { nationalParkPromptFor } from '../src/data/national-park-prompts.js';

test('each Utah national park has custom journey start and arrival prompts', () => {
  for (const park of utahNationalParks) {
    const prompt = nationalParkPromptFor({ label: `${park.name}, Utah` });
    assert.equal(prompt?.name, park.name);
    assert.match(prompt.start, /Let’s get going\./);
    assert.ok(prompt.arrival.length > 60);
  }
});

test('non-park destinations use the usual navigation prompts', () => {
  assert.equal(nationalParkPromptFor({ label: 'Salt Lake Temple, Utah' }), null);
});
