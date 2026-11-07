import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { getVoices, publicVoices } from './voices.js';
import { distanceBetween, isValidPoint } from '../src/utils/location.js';
import { findUtahLandmarks } from '../src/data/utah-landmarks.js';
import voicePhrases from '../voice-phrases.json' with { type: 'json' };
import { normalizeCustomPhrases } from '../src/utils/phrases.js';
import { getAirQuality, getRouteConditions } from './conditions.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE = resolve(ROOT, 'src');
const PUBLIC = resolve(ROOT, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function bodyOf(req) {
  let body = '';
  req.setEncoding('utf8');
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    body += chunk;
    if (Buffer.byteLength(body) > 32 * 1024) {
      req.resume();
      throw Object.assign(new Error('Request too large.'), { status: 413 });
    }
  }
  try { return JSON.parse(body); }
  catch { throw Object.assign(new Error('Expected a JSON request.'), { status: 400 }); }
}

export function createApp({ config = {}, fetcher = fetch, phrases = voicePhrases, random = Math.random } = {}) {
  const voices = getVoices(config);
  const fish = config.fish || {};
  let active = 0;
  let nextGeocodeAt = 0;
  const geocodeCache = new Map();
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/voices') {
        return json(res, 200, publicVoices(voices, fish.apiKey));
      }
      if (req.method === 'GET' && url.pathname === '/api/runtime') {
        return json(res, 200, { simulator: Boolean(config.simulator) });
      }
      if (req.method === 'POST' && url.pathname === '/api/conditions') {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Use application/json.' });
        const body = await bodyOf(req);
        try { return json(res, 200, await getRouteConditions({ geometry: body?.geometry, destinationId: body?.destinationId, apiKey: config.conditions?.udotApiKey, fetcher })); }
        catch (error) { return json(res, 502, { error: error.message || 'Conditions are unavailable.' }); }
      }
      if (req.method === 'POST' && url.pathname === '/api/air-quality') {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Use application/json.' });
        const body = await bodyOf(req);
        if (!isValidPoint(body?.start) || !isValidPoint(body?.end)) return json(res, 400, { error: 'Start and destination coordinates are required.' });
        try { return json(res, 200, await getAirQuality({ start: body.start, end: body.end, apiKey: config.conditions?.airNowApiKey, fetcher })); }
        catch (error) { return json(res, 502, { error: error.message || 'Air quality is unavailable.' }); }
      }
      if (req.method === 'GET' && url.pathname === '/api/geocode') {
        const query = url.searchParams.get('q')?.trim();
        if (!query || query.length > 200) return json(res, 400, { error: 'Enter an address, place, or city up to 200 characters.' });
        let origin;
        if (url.searchParams.has('lat') || url.searchParams.has('lng')) {
          const lat = url.searchParams.get('lat');
          const lng = url.searchParams.get('lng');
          origin = { lat: Number(lat), lng: Number(lng) };
          if (!lat?.trim() || !lng?.trim() || !isValidPoint(origin)) {
            return json(res, 400, { error: 'Search location needs a valid latitude and longitude.' });
          }
        }
        // A query near one location must never reuse matches or distances from another.
        const cacheKey = JSON.stringify([query.toLowerCase(), origin?.lat, origin?.lng]);
        const cached = geocodeCache.get(cacheKey);
        if (cached) return json(res, 200, cached);
        const wait = Math.max(0, nextGeocodeAt - Date.now());
        nextGeocodeAt = Math.max(Date.now(), nextGeocodeAt) + 1000;
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        const searchUrl = new URL('https://photon.komoot.io/api/');
        searchUrl.search = new URLSearchParams({ q: query, limit: origin ? '20' : '5', lang: 'en' });
        if (origin) {
          searchUrl.searchParams.set('lat', origin.lat);
          searchUrl.searchParams.set('lon', origin.lng);
          searchUrl.searchParams.set('zoom', '13');
          searchUrl.searchParams.set('location_bias_scale', '0.1');
        }
        const upstream = await fetcher(searchUrl, { headers: { Accept: 'application/json', 'User-Agent': 'Mommy-Maps/0.1' } });
        if (!upstream.ok) {
          await upstream.body?.cancel();
          return json(res, 502, { error: 'Address search is unavailable. Please try again.' });
        }
        const places = await upstream.json();
        const photonResults = (Array.isArray(places.features) ? places.features : []).map((place) => {
          const properties = place.properties || {};
          const [lng, lat] = place.geometry?.coordinates || [];
          const street = [properties.housenumber, properties.street].filter(Boolean).join(' ');
          const locality = [properties.city || properties.district, properties.state, properties.country].filter(Boolean).join(', ');
          return { lat, lng, label: [properties.name, street, locality].filter(Boolean).join(', ') };
        })
          .filter((place) => isValidPoint(place) && place.label);
        const photonLabels = photonResults.map((place) => place.label.toLowerCase());
        const landmarks = findUtahLandmarks(query)
          .filter(({ name }) => !photonLabels.some((label) => label.startsWith(name.toLowerCase())))
          .map(({ name, lat, lng, score }) => ({
            lat, lng, label: `${name}, Utah`, landmarkScore: score,
          }));
        const results = [...landmarks, ...photonResults].filter((place) => isValidPoint(place) && place.label);
        if (origin) {
          for (const place of results) place.distanceMeters = distanceBetween(origin, place);
          results.sort((a, b) => (a.landmarkScore ?? Infinity) - (b.landmarkScore ?? Infinity)
            || a.distanceMeters - b.distanceMeters);
        } else {
          results.sort((a, b) => (a.landmarkScore ?? Infinity) - (b.landmarkScore ?? Infinity));
        }
        if (!results.length) return json(res, 404, { error: 'No address match found. Try adding a city or state.' });
        const labels = new Set();
        const uniqueResults = results.filter((place) => {
          if (labels.has(place.label)) return false;
          labels.add(place.label);
          return true;
        });
        const result = { results: uniqueResults.slice(0, 5).map(({ landmarkScore, ...place }) => place) };
        if (geocodeCache.size >= 200) geocodeCache.delete(geocodeCache.keys().next().value);
        geocodeCache.set(cacheKey, result);
        return json(res, 200, result);
      }
      if (req.method === 'POST' && url.pathname === '/api/tts') {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Use application/json.' });
        const body = await bodyOf(req);
        if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 600) {
          return json(res, 400, { error: 'Text must contain between 1 and 600 characters.' });
        }
        let customPhrases;
        try { customPhrases = normalizeCustomPhrases(body.customAfterTurnPhrases); }
        catch (error) { return json(res, 400, { error: error.message }); }
        let customArrivalPhrases;
        try { customArrivalPhrases = normalizeCustomPhrases(body.customArrivalPhrases); }
        catch (error) { return json(res, 400, { error: error.message }); }
        const affirmation = body.affirmation || 'neutral';
        if (typeof affirmation !== 'string' || !['neutral', 'girl', 'boy', 'enby'].includes(affirmation)) {
          return json(res, 400, { error: 'Choose a valid after-turn encouragement style.' });
        }
        const voice = voices.find((item) => item.id === body.voiceId);
        if (!voice) return json(res, 400, { error: 'Choose a valid voice.' });
        if (!fish.apiKey || !voice.referenceId) {
          return json(res, 503, { error: 'This voice needs a Fish Audio API key and voice ID configured in the server config files.' });
        }
        if (active >= 2) return json(res, 429, { error: 'The voice server is busy. Try again shortly.' });
        // Build a per-request pool so personal phrases never affect another user's turns.
        const phrasePool = body.arrivalPhrase === true
          ? [...new Map([...(phrases.arrival || []), ...customArrivalPhrases].map((phrase) => [phrase.toLowerCase(), phrase])).values()]
          : body.afterTurnPhrase === true
            ? [...new Map([...(phrases.afterTurn || []), ...(phrases.affirmations?.[affirmation] || []), ...customPhrases].map((phrase) => [phrase.toLowerCase(), phrase])).values()]
            : [];
        const afterTurn = phrasePool.length ? phrasePool[Math.floor(random() * phrasePool.length)] : '';
        const spokenText = voice.cue + ' ' + body.text.trim() + (afterTurn ? ' ' + afterTurn : '');
        active += 1;
        const controller = new AbortController();
        const abort = () => { if (!res.writableEnded) controller.abort(); };
        res.on('close', abort);
        try {
          const upstream = await fetcher('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${fish.apiKey}`, 'Content-Type': 'application/json', model: fish.model || 's2.1-pro' },
            body: JSON.stringify({ text: spokenText, reference_id: voice.referenceId,
              format: 'mp3', prosody: { speed: voice.speed }, normalize: true }),
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
          });
          if (!upstream.ok) {
            await upstream.body?.cancel();
            const message = upstream.status === 401 ? 'Fish Audio rejected the API key.'
              : upstream.status === 402 ? 'Fish Audio needs API credit for this request.'
              : upstream.status === 429 ? 'Fish Audio is busy. Try again shortly.'
              : 'Fish Audio could not generate this voice. Check the voice ID and model access.';
            return json(res, upstream.status === 429 ? 429 : 502, { error: message });
          }
          // Buffer short navigation clips so the client gets a complete playable MP3.
          const chunks = [];
          let bytes = 0;
          for await (const chunk of upstream.body) {
            bytes += chunk.length;
            if (bytes > 8 * 1024 * 1024) { controller.abort(); throw new Error('Audio too large'); }
            chunks.push(chunk);
          }
          if (!bytes) throw new Error('Empty audio');
          res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
          res.end(Buffer.concat(chunks));
        } catch (error) {
          if (!res.destroyed) json(res, error.name === 'TimeoutError' ? 504 : 502, { error: 'Speech generation failed or timed out. Please try again.' });
        } finally { active -= 1; res.off('close', abort); }
        return;
      }
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'API endpoint not found.' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
      const pathname = decodeURIComponent(url.pathname);
      const file = pathname === '/' ? resolve(ROOT, 'index.html')
        : pathname.startsWith('/images/') ? resolve(PUBLIC, `.${pathname}`)
          : resolve(ROOT, `.${pathname}`);
      // Serve only browser assets, never configuration or server files.
      if (file !== resolve(ROOT, 'index.html') && !file.startsWith(SOURCE + sep) && !file.startsWith(PUBLIC + sep)) {
        return json(res, 404, { error: 'Not found.' });
      }
      if (!MIME[extname(file)]) return json(res, 404, { error: 'Not found.' });
      try {
        const content = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)], 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : content);
      } catch { json(res, 404, { error: 'Not found.' }); }
    } catch (error) {
      if (!res.destroyed) json(res, error.status || 400, { error: error.status ? error.message : 'Invalid request.' });
    }
  });
}
