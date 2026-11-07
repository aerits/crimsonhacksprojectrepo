import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { createApp } from '../server/app.js';

// Exercise the real request handler without opening sockets (sandbox-friendly).
async function withServer(t, options = {}) {
  const server = createApp(options);
  const handler = server.listeners('request')[0];
  async function request(path, method = 'GET', body) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    Object.assign(req, { url: path, method, headers: { 'content-type': 'application/json' } });
    const res = new EventEmitter();
    res.destroyed = false;
    res.writableEnded = false;
    res.writeHead = (status, headers) => { res.status = status; res.headers = headers; };
    res.end = (bytes) => { res.bytes = bytes; res.writableEnded = true; };
    await handler(req, res);
    return new Response(res.bytes, { status: res.status, headers: res.headers });
  }
  return { get: (path) => request(path), post: (body) => request('/api/tts', 'POST', body) };
}

const env = { FISH_API_KEY: 'secret-test-key', FISH_VOICE_VELVET: 'fish-voice-a', FISH_VOICE_HONEY: 'fish-voice-b' };

test('voice list exposes setup status without keys or provider IDs', async (t) => {
  const api = await withServer(t, { env });
  const response = await api.get('/api/voices');
  const text = await response.text();
  assert.ok(!text.includes('secret-test-key'));
  assert.ok(!text.includes('fish-voice-a'));
  const voices = JSON.parse(text);
  assert.equal(voices.length, 3);
  assert.equal(voices[0].configured, true);
  assert.equal(voices[2].configured, false);
});

test('server sends selected Fish voice and returns binary MP3', async (t) => {
  let calls = 0;
  const bytes = Uint8Array.of(73, 68, 51, 0, 1, 2);
  const api = await withServer(t, { env, fetcher: async (url, options) => {
    calls += 1;
    assert.equal(url, 'https://api.fish.audio/v1/tts');
    assert.equal(options.headers.Authorization, 'Bearer secret-test-key');
    assert.equal(options.headers.model, 's2.1-pro');
    const body = JSON.parse(options.body);
    assert.equal(body.reference_id, 'fish-voice-b');
    assert.equal(body.format, 'mp3');
    assert.match(body.text, /Turn right/);
    return new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } });
  } });
  const response = await api.post({ text: 'Turn right.', voiceId: 'honey' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  assert.equal(calls, 1);
});

test('invalid input and missing voice configuration never call Fish', async (t) => {
  const api = await withServer(t, { env: {}, fetcher: () => { throw new Error('Must not call Fish'); } });
  for (const body of [null, {}, { text: '  ' }, { text: 42 }, { text: 'x'.repeat(601) }, { text: 'Hi', voiceId: 'unknown' }]) {
    assert.equal((await api.post(body)).status, 400);
  }
  assert.equal((await api.post({ text: 'Hi', voiceId: 'velvet' })).status, 503);
  assert.equal((await api.post({ text: 'x'.repeat(5000) })).status, 413);
});

test('Fish errors are safe and actionable', async (t) => {
  const api = await withServer(t, { env, fetcher: async () => new Response('secret upstream details', { status: 402 }) });
  const response = await api.post({ text: 'Hi', voiceId: 'velvet' });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /credit/);
});

test('empty audio is rejected rather than played', async (t) => {
  const api = await withServer(t, { env, fetcher: async () => new Response('') });
  assert.equal((await api.post({ text: 'Hi', voiceId: 'velvet' })).status, 502);
});

test('static server serves app source and blocks private files', async (t) => {
  const api = await withServer(t, { env });
  assert.equal((await api.get('/')).status, 200);
  assert.match((await api.get('/src/main.js')).headers.get('content-type'), /javascript/);
  for (const path of ['/.env', '/server/app.js', '/package.json', '/.git/config', '/src/%2e%2e%2fserver/app.js']) {
    assert.equal((await api.get(path)).status, 404);
  }
});
