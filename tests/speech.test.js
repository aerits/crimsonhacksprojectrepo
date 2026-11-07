import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechService } from '../src/services/speech.js';

function fakeAudio() {
  return {
    src: '', paused: false, loaded: false, played: false,
    addEventListener() {},
    pause() { this.paused = true; },
    removeAttribute() { this.src = ''; },
    load() { this.loaded = true; },
    async play() { this.played = true; },
  };
}

test('server audio becomes a playable object URL and stop clears it', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/tts');
    assert.deepEqual(JSON.parse(options.body), { text: 'Turn left.', voiceId: 'velvet' });
    return new Response(Uint8Array.of(73, 68, 51), { headers: { 'Content-Type': 'audio/mpeg' } });
  };
  const audio = fakeAudio();
  const service = createSpeechService(audio);
  await service.speak('Turn left.', 'velvet');
  assert.match(audio.src, /^blob:/);
  assert.equal(audio.played, true);
  service.stop();
  assert.equal(audio.src, '');
  assert.equal(audio.paused, true);
});

test('turn speech requests an after-turn phrase', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { text: 'Turn left.', voiceId: 'velvet', afterTurnPhrase: true });
    return new Response('audio');
  };
  const service = createSpeechService(fakeAudio());
  await service.speak('Turn left.', 'velvet', { afterTurnPhrase: true });
});

test('stopped generation cannot play a late response', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let finish;
  globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
  const audio = fakeAudio();
  const service = createSpeechService(audio);
  const pending = service.speak('Turn right.', 'honey');
  service.stop();
  finish(new Response('late audio'));
  await pending;
  assert.equal(audio.played, false);
  assert.equal(audio.src, '');
});

test('autoplay rejection reports how to retry playback', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response('audio');
  const audio = fakeAudio();
  audio.play = async () => { throw new Error('NotAllowedError'); };
  const messages = [];
  const service = createSpeechService(audio, (message) => messages.push(message));
  await service.speak('Hello.', 'luna');
  assert.match(messages.at(-1), /playback was blocked/);
  assert.match(audio.src, /^blob:/);
  service.stop();
});

test('personal phrases travel only with turn speech and reflect the next request', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return new Response('audio');
  };
  const service = createSpeechService(fakeAudio());
  await service.speak('Turn left.', 'velvet', { afterTurnPhrase: true, customAfterTurnPhrases: ['Keep going.'] });
  await service.speak('Turn right.', 'velvet', { afterTurnPhrase: true, customAfterTurnPhrases: ['Updated phrase.'] });
  await service.speak('Hello.', 'velvet', { customAfterTurnPhrases: ['Keep going.'] });
  assert.deepEqual(bodies[0].customAfterTurnPhrases, ['Keep going.']);
  assert.deepEqual(bodies[1].customAfterTurnPhrases, ['Updated phrase.']);
  assert.equal(bodies[2].customAfterTurnPhrases, undefined);
  assert.equal(bodies[2].afterTurnPhrase, undefined);
  service.stop();
});
