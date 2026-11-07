import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { getVoices, publicVoices } from './voices.js';
import { getAirQuality, getRouteConditions } from './conditions.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function bodyOf(req, maxBytes = 4096) {
  let body = '';
  req.setEncoding('utf8');
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) {
      req.resume();
      throw Object.assign(new Error('Request too large.'), { status: 413 });
    }
  }
  try { return JSON.parse(body); }
  catch { throw Object.assign(new Error('Expected a JSON request.'), { status: 400 }); }
}

export function createApp({ env = process.env, fetcher = fetch } = {}) {
  const voices = getVoices(env);
  let active = 0;
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/voices') {
        return json(res, 200, publicVoices(voices, env.FISH_API_KEY));
      }
      if (req.method === 'POST' && url.pathname === '/api/tts') {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Use application/json.' });
        const body = await bodyOf(req);
        if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 600) {
          return json(res, 400, { error: 'Text must contain between 1 and 600 characters.' });
        }
        const voice = voices.find((item) => item.id === body.voiceId);
        if (!voice) return json(res, 400, { error: 'Choose a valid voice.' });
        if (!env.FISH_API_KEY || !voice.referenceId) {
          return json(res, 503, { error: 'This voice needs a Fish Audio API key and voice ID configured in the server .env file.' });
        }
        if (active >= 2) return json(res, 429, { error: 'The voice server is busy. Try again shortly.' });
        active += 1;
        const controller = new AbortController();
        const abort = () => { if (!res.writableEnded) controller.abort(); };
        res.on('close', abort);
        try {
          const upstream = await fetcher('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.FISH_API_KEY}`, 'Content-Type': 'application/json', model: env.FISH_MODEL || 's2.1-pro' },
            body: JSON.stringify({ text: `${voice.cue} ${body.text.trim()}`, reference_id: voice.referenceId,
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
      if (req.method === 'POST' && url.pathname === '/api/conditions') {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Use application/json.' });
        const body = await bodyOf(req, 512 * 1024);
        try { return json(res, 200, await getRouteConditions({ geometry: body?.geometry, destinationId: body?.destinationId, apiKey: env.UDOT_API_KEY, fetcher })); }
        catch { return json(res, 502, { error: 'UDOT conditions are unavailable right now.' }); }
      }
      if (req.method === 'POST' && url.pathname === '/api/air-quality') {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Use application/json.' });
        const body = await bodyOf(req);
        if (!body?.start || !body?.end || !Number.isFinite(body.start.lat) || !Number.isFinite(body.start.lng) || !Number.isFinite(body.end.lat) || !Number.isFinite(body.end.lng)) return json(res, 400, { error: 'Start and destination coordinates are required.' });
        try { return json(res, 200, await getAirQuality({ start: body.start, end: body.end, apiKey: env.AIRNOW_API_KEY, fetcher, baseUrl: env.AIRNOW_API_URL || undefined })); }
        catch { return json(res, 502, { error: 'AirNow is unavailable right now.' }); }
      }
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'API endpoint not found.' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
      const pathname = decodeURIComponent(url.pathname);
      const file = pathname === '/' ? resolve(ROOT, 'index.html') : resolve(ROOT, `.${pathname}`);
      // Serve only the app entry and browser source, never .env or server files.
      if (file !== resolve(ROOT, 'index.html') && !file.startsWith(resolve(ROOT, 'src') + sep)) {
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
