import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCustomPhrases } from '../src/utils/phrases.js';
import { createPhraseStore } from '../src/services/phrase-preferences.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('custom phrases trim whitespace and collapse duplicate entries without mutating input', () => {
  const input = ['  Keep   going.  ', 'KEEP going.', 'You’ve got this!'];
  assert.deepEqual(normalizeCustomPhrases(input), ['Keep going.', 'You’ve got this!']);
  assert.equal(input[0], '  Keep   going.  ');
  assert.deepEqual(normalizeCustomPhrases(), []);
});

test('custom phrases reject blank, oversized, non-text, and excessive entries', () => {
  for (const value of [null, 'text', {}, [null], [42], ['  '], ['x'.repeat(161)], Array(21).fill('Hello')]) {
    assert.throws(() => normalizeCustomPhrases(value));
  }
  assert.equal(normalizeCustomPhrases(['x'.repeat(160)])[0].length, 160);
});

test('saved phrases can be reloaded, edited, and removed without mutating snapshots', () => {
  const storage = memoryStorage();
  const firstVisit = createPhraseStore(storage);
  assert.equal(firstVisit.save(['Keep going.', 'One turn at a time.']), true);
  const secondVisit = createPhraseStore(storage);
  assert.deepEqual(secondVisit.get(), ['Keep going.', 'One turn at a time.']);
  const snapshot = secondVisit.get();
  snapshot[0] = 'Changed only in the snapshot';
  assert.equal(secondVisit.get()[0], 'Keep going.');
  secondVisit.save(['You’ve got this.', 'One turn at a time.']);
  assert.equal(createPhraseStore(storage).get()[0], 'You’ve got this.');
  secondVisit.save([]);
  assert.deepEqual(createPhraseStore(storage).get(), []);
});

test('bad stored data recovers safely and unavailable storage keeps phrases for the visit', () => {
  for (const value of ['{broken', '{"not":"a list"}', '[null]', '[" "]']) {
    const store = createPhraseStore({ getItem: () => value });
    assert.deepEqual(store.get(), []);
    assert.equal(store.loadError, true);
  }
  const store = createPhraseStore({ getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Full'); } });
  assert.equal(store.save(['Still here.']), false);
  assert.deepEqual(store.get(), ['Still here.']);
  assert.throws(() => store.save(['']));
  assert.deepEqual(store.get(), ['Still here.']);
  const unavailable = createPhraseStore();
  assert.equal(unavailable.save(['This visit only.']), false);
  assert.deepEqual(unavailable.get(), ['This visit only.']);
});
