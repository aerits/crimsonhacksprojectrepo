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

const config = { fish: { apiKey: 'secret-test-key', voices: { velvet: 'fish-voice-a', honey: 'fish-voice-b' } } };

test('voice list exposes setup status without keys or provider IDs', async (t) => {
  const api = await withServer(t, { config });
  const response = await api.get('/api/voices');
  const text = await response.text();
  assert.ok(!text.includes('secret-test-key'));
  assert.ok(!text.includes('fish-voice-a'));
  const voices = JSON.parse(text);
  assert.equal(voices.length, 6);
  assert.equal(voices[0].configured, true);
  assert.equal(voices[2].configured, false);
});

test('runtime endpoint exposes simulator mode without exposing configuration', async (t) => {
  const api = await withServer(t, { config: { simulator: true } });
  assert.deepEqual(await (await api.get('/api/runtime')).json(), { simulator: true });
});

test('address search returns a map point and caches repeat requests', async (t) => {
  let calls = 0;
  const api = await withServer(t, { fetcher: async (url, options) => {
    calls += 1;
    assert.equal(url.hostname, 'photon.komoot.io');
    assert.equal(url.pathname, '/api/');
    assert.equal(url.searchParams.get('q'), 'University of Utah');
    assert.equal(url.searchParams.get('limit'), '5');
    assert.equal(options.headers['User-Agent'], 'Mommy-Maps/0.1');
    return Response.json({ features: [{ geometry: { coordinates: [-111.8421, 40.7649] }, properties: { name: 'University of Utah', city: 'Salt Lake City', state: 'Utah', country: 'United States' } }] });
  } });
  const path = '/api/geocode?q=University%20of%20Utah';
  assert.deepEqual(await (await api.get(path)).json(), { results: [{ lat: 40.7649, lng: -111.8421, label: 'University of Utah, Salt Lake City, Utah, United States' }] });
  assert.equal((await api.get(path)).status, 200);
  assert.equal(calls, 1);
});

test('address search forwards a valid origin as a Photon location bias', async (t) => {
  const api = await withServer(t, { fetcher: async (url) => {
    assert.equal(url.searchParams.get('lat'), '40.7649');
    assert.equal(url.searchParams.get('lon'), '-111.8421');
    assert.equal(url.searchParams.get('zoom'), '13');
    return Response.json({ features: [{ geometry: { coordinates: [-111.84, 40.76] }, properties: { name: 'Nearby place' } }] });
  } });
  const response = await api.get('/api/geocode?q=coffee&lat=40.7649&lng=-111.8421');
  assert.equal(response.status, 200);
});

test('address search rejects missing input and no matches', async (t) => {
  const api = await withServer(t, { fetcher: async () => Response.json([]) });
  assert.equal((await api.get('/api/geocode')).status, 400);
  assert.equal((await api.get('/api/geocode?q=not-a-real-place')).status, 404);
});

test('server sends selected Fish voice and returns binary MP3', async (t) => {
  let calls = 0;
  const bytes = Uint8Array.of(73, 68, 51, 0, 1, 2);
  const api = await withServer(t, { config, fetcher: async (url, options) => {
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

test('navigation turns receive one random configured after-turn phrase', async (t) => {
  const api = await withServer(t, { config, random: () => 0, phrases: { afterTurn: ['You’re right on track.'] }, fetcher: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.match(body.text, /Turn left\. You’re right on track\.$/);
    return new Response(Uint8Array.of(73, 68, 51));
  } });
  assert.equal((await api.post({ text: 'Turn left.', voiceId: 'velvet', afterTurnPhrase: true })).status, 200);
});

test('invalid input and missing voice configuration never call Fish', async (t) => {
  const api = await withServer(t, { config: {}, fetcher: () => { throw new Error('Must not call Fish'); } });
  for (const body of [null, {}, { text: '  ' }, { text: 42 }, { text: 'x'.repeat(601) }, { text: 'Hi', voiceId: 'unknown' }]) {
    assert.equal((await api.post(body)).status, 400);
  }
  assert.equal((await api.post({ text: 'Hi', voiceId: 'velvet' })).status, 503);
  assert.equal((await api.post({ text: 'x'.repeat(5000) })).status, 413);
});

test('Fish errors are safe and actionable', async (t) => {
  const api = await withServer(t, { config, fetcher: async () => new Response('secret upstream details', { status: 402 }) });
  const response = await api.post({ text: 'Hi', voiceId: 'velvet' });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /credit/);
});

test('empty audio is rejected rather than played', async (t) => {
  const api = await withServer(t, { config, fetcher: async () => new Response('') });
  assert.equal((await api.post({ text: 'Hi', voiceId: 'velvet' })).status, 502);
});

test('static server serves app source and blocks private files', async (t) => {
  const api = await withServer(t, { config });
  assert.equal((await api.get('/')).status, 200);
  assert.match((await api.get('/src/main.js')).headers.get('content-type'), /javascript/);
  for (const path of ['/config.json', '/config.local.json', '/server/app.js', '/package.json', '/.git/config', '/src/%2e%2e%2fserver/app.js']) {
    assert.equal((await api.get(path)).status, 404);
  }
});
