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
  assert.equal(voices.length, 7);
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
    assert.equal(url.searchParams.get('limit'), '20');
    assert.equal(url.searchParams.get('lat'), '40.7649');
    assert.equal(url.searchParams.get('lon'), '-111.8421');
    assert.equal(options.headers['User-Agent'], 'Mommy-Maps/0.1');
    return Response.json({ features: [{ geometry: { coordinates: [-111.8421, 40.7649] }, properties: { name: 'University of Utah', city: 'Salt Lake City', state: 'Utah', country: 'United States' } }] });
  } });
  const path = '/api/geocode?q=University%20of%20Utah';
  const first = await (await api.get(path)).json();
  assert.deepEqual(first.results[0], { lat: 40.7649, lng: -111.8421, label: 'University of Utah, Salt Lake City, Utah, United States', distanceMeters: 0 });
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

const addressFeature = (lng, lat = 0, name = String(lng)) => ({
  geometry: { coordinates: [lng, lat] },
  properties: { name, housenumber: '10', street: 'Main Street', city: 'Test City' },
});

test('Utah landmarks are prioritized ahead of generic geocoder matches', async (t) => {
  const api = await withServer(t, { fetcher: async () => Response.json({ features: [addressFeature(-111.9, 40.7, 'Arches Apartments')] }) });
  const { results } = await (await api.get('/api/geocode?q=arches')).json();
  assert.equal(results[0].label, 'Arches National Park, Utah');
  assert.equal(results[1].label, 'Arches Apartments, 10 Main Street, Test City');
});

test('nearby search biases the provider and returns the closest five with distances and addresses', async (t) => {
  const api = await withServer(t, { fetcher: async (url) => {
    assert.equal(url.searchParams.get('lat'), '0');
    assert.equal(url.searchParams.get('lon'), '0');
    assert.equal(url.searchParams.get('limit'), '20');
    assert.equal(url.searchParams.get('location_bias_scale'), '0.1');
    return Response.json({ features: [
      ...[0.1, 0.05, 0.02, 0.04, 0.01, 0.03].map((lng) => addressFeature(lng)),
      addressFeature(0.015, 0, '0.01'), // Duplicate address must not occupy a suggestion slot.
      addressFeature(null), addressFeature(181), addressFeature(0, 91), {},
    ] });
  } });
  const response = await api.get('/api/geocode?q=Main&lat=0&lng=0');
  assert.equal(response.status, 200);
  const { results } = await response.json();
  assert.deepEqual(results.map((place) => place.lng), [0.01, 0.02, 0.03, 0.04, 0.05]);
  assert.ok(Math.abs(results[0].distanceMeters - 1111.95) < 1);
  assert.ok(results.every((place) => place.label.includes('10 Main Street, Test City')));
  assert.ok(results.every((place, index) => index === 0 || place.distanceMeters >= results[index - 1].distanceMeters));
});

test('unlocated searches fall back to Utah distance and use name as the final tie-breaker', async (t) => {
  const api = await withServer(t, { fetcher: async () => Response.json({ features: [
    addressFeature(139.76, 35.68, 'Burger King Tokyo'),
    addressFeature(-111.8421, 40.7649, 'Burger King Salt Lake'),
    addressFeature(-111.84, 40.76, 'Zeta Cafe'),
    addressFeature(-111.84, 40.76, 'Alpha Cafe'),
  ] }) });
  const { results } = await (await api.get('/api/geocode?q=Burger%20King')).json();
  assert.equal(results[0].label.startsWith('Burger King Salt Lake'), true);
  assert.equal(results.at(-1).label.startsWith('Burger King Tokyo'), true);
  assert.deepEqual(results.slice(1, 3).map((place) => place.label.split(',')[0]), ['Alpha Cafe', 'Zeta Cafe']);
});

test('cache keeps distances and nearby candidates separate for each origin and for unlocated searches', async (t) => {
  let calls = 0;
  const api = await withServer(t, { fetcher: async () => {
    calls += 1;
    return Response.json({ features: [addressFeature(0.01), addressFeature(0.09)] });
  } });
  const first = await (await api.get('/api/geocode?q=Main&lat=0&lng=0')).json();
  const second = await (await api.get('/api/geocode?q=Main&lat=0&lng=0.1')).json();
  assert.equal(first.results[0].lng, 0.01);
  assert.equal(second.results[0].lng, 0.09);
  assert.notEqual(first.results[0].distanceMeters, second.results[1].distanceMeters);
  assert.deepEqual(await (await api.get('/api/geocode?q=main&lat=0&lng=0')).json(), first);
  assert.equal(calls, 2);
  const unlocated = await (await api.get('/api/geocode?q=Main')).json();
  assert.ok(unlocated.results[0].distanceMeters > 0);
  assert.equal(calls, 3);
});

test('incomplete or invalid search origins are rejected before contacting the provider', async (t) => {
  let calls = 0;
  const api = await withServer(t, { fetcher: () => { calls += 1; return Response.json({ features: [] }); } });
  for (const location of ['lat=0', 'lng=0', 'lat=&lng=0', 'lat=0&lng=',
    'lat=91&lng=0', 'lat=0&lng=-181', 'lat=Infinity&lng=0', 'lat=nope&lng=0']) {
    assert.equal((await api.get('/api/geocode?q=Main&' + location)).status, 400, location);
  }
  assert.equal(calls, 0);
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

test('navigation turns use the selected encouragement style', async (t) => {
  const api = await withServer(t, { config, random: () => 0, phrases: { afterTurn: [], affirmations: { enby: ['You’re doing beautifully, enby.'] } }, fetcher: async (_url, options) => {
    assert.match(JSON.parse(options.body).text, /Turn left\. You’re doing beautifully, enby\.$/);
    return new Response(Uint8Array.of(73, 68, 51));
  } });
  assert.equal((await api.post({ text: 'Turn left.', voiceId: 'velvet', afterTurnPhrase: true, affirmation: 'enby' })).status, 200);
  assert.equal((await api.post({ text: 'Turn left.', voiceId: 'velvet', afterTurnPhrase: true, affirmation: 'invalid' })).status, 400);
});

test('arrival directions use only the arrival phrase collection', async (t) => {
  const spoken = [];
  const api = await withServer(t, { config, random: () => 0.999, phrases: {
    afterTurn: ['Turn phrase.'], arrival: ['Preset arrival phrase.'], affirmations: { neutral: ['Style phrase.'] },
  }, fetcher: async (_url, options) => {
    spoken.push(JSON.parse(options.body).text);
    return new Response(Uint8Array.of(73, 68, 51));
  } });
  assert.equal((await api.post({ text: 'You have arrived.', voiceId: 'velvet', arrivalPhrase: true,
    customArrivalPhrases: ['Personal arrival phrase.'] })).status, 200);
  assert.match(spoken[0], /You have arrived\. Personal arrival phrase\.$/);
  assert.doesNotMatch(spoken[0], /Turn phrase|Style phrase/);
});

test('custom turn phrases join the preset pool without leaking into later requests', async (t) => {
  const spoken = [];
  const presets = { afterTurn: ['Preset phrase.'] };
  const api = await withServer(t, { config, phrases: presets, random: () => 0.999, fetcher: async (_url, options) => {
    spoken.push(JSON.parse(options.body).text);
    return new Response(Uint8Array.of(73, 68, 51));
  } });
  assert.equal((await api.post({ text: 'Turn left.', voiceId: 'velvet', afterTurnPhrase: true,
    customAfterTurnPhrases: ['  Personal   encouragement.  '] })).status, 200);
  assert.match(spoken[0], /Turn left\. Personal encouragement\.$/);
  assert.equal((await api.post({ text: 'Turn right.', voiceId: 'velvet', afterTurnPhrase: true })).status, 200);
  assert.match(spoken[1], /Turn right\. Preset phrase\.$/);
  assert.deepEqual(presets.afterTurn, ['Preset phrase.']);
});

test('voice previews do not append custom or preset phrases', async (t) => {
  const api = await withServer(t, { config, phrases: { afterTurn: ['Preset phrase.'] }, fetcher: async (_url, options) => {
    const text = JSON.parse(options.body).text;
    assert.ok(text.endsWith('Preview exactly.'));
    assert.ok(!text.includes('Personal phrase.'));
    return new Response(Uint8Array.of(73, 68, 51));
  } });
  assert.equal((await api.post({ text: 'Preview exactly.', voiceId: 'velvet',
    customAfterTurnPhrases: ['Personal phrase.'] })).status, 200);
});

test('invalid personal phrase lists are rejected before synthesis', async (t) => {
  let calls = 0;
  const api = await withServer(t, { config, fetcher: async () => { calls += 1; return new Response('audio'); } });
  for (const customAfterTurnPhrases of [null, 'text', {}, [42], [''], ['x'.repeat(161)], Array(21).fill('Hello')]) {
    assert.equal((await api.post({ text: 'Turn left.', voiceId: 'velvet', afterTurnPhrase: true, customAfterTurnPhrases })).status, 400);
  }
  assert.equal(calls, 0);
});

test('a full list of Unicode phrases fits the bounded request body', async (t) => {
  const customAfterTurnPhrases = Array.from({ length: 20 }, (_, index) => String(index).padStart(2, '0') + '好'.repeat(158));
  const api = await withServer(t, { config, random: () => 0.999, fetcher: async (_url, options) => {
    assert.ok(JSON.parse(options.body).text.endsWith(customAfterTurnPhrases.at(-1)));
    return new Response(Uint8Array.of(73, 68, 51));
  } });
  assert.equal((await api.post({ text: '左'.repeat(600), voiceId: 'velvet', afterTurnPhrase: true, customAfterTurnPhrases })).status, 200);
});

test('invalid input and missing voice configuration never call Fish', async (t) => {
  const api = await withServer(t, { config: {}, fetcher: () => { throw new Error('Must not call Fish'); } });
  for (const body of [null, {}, { text: '  ' }, { text: 42 }, { text: 'x'.repeat(601) }, { text: 'Hi', voiceId: 'unknown' }]) {
    assert.equal((await api.post(body)).status, 400);
  }
  assert.equal((await api.post({ text: 'Hi', voiceId: 'velvet' })).status, 503);
  assert.equal((await api.post({ text: 'x'.repeat(50000) })).status, 413);
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

test('static server serves browser assets and blocks private files', async (t) => {
  const api = await withServer(t, { config });
  assert.equal((await api.get('/')).status, 200);
  assert.match((await api.get('/src/main.js')).headers.get('content-type'), /javascript/);
  assert.match((await api.get('/images/guide-luna.png')).headers.get('content-type'), /image\/png/);
  assert.match((await api.get('/images/sakura-blossom-cc0.svg')).headers.get('content-type'), /image\/svg\+xml/);
  for (const path of ['/config.json', '/config.local.json', '/server/app.js', '/package.json', '/.git/config', '/src/%2e%2e%2fserver/app.js']) {
    assert.equal((await api.get(path)).status, 404);
  }
});
