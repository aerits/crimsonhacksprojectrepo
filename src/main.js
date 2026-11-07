import { createMap } from './services/map.js';
import { getRoute } from './services/routing.js';
import { geocodeAddress } from './services/geocoding.js';
import { createSpeechService } from './services/speech.js';
import { formatDistance, formatDuration } from './utils/directions.js';

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" aria-label="Mommy Maps home"><span class="brand-mark">m</span>mommy maps<span class="brand-dot">.</span></a>
    <span class="tagline">A little guidance. A lot of comfort.</span>
    <span class="prototype"><span></span> EARLY EXPLORER</span>
  </header>
  <main class="workspace">
    <aside class="sidebar">
      <div class="intro"><p class="eyebrow">MAKE YOURSELF COMFORTABLE</p><h1>Let’s take the<br><em>soft way home.</em></h1><p>Your route, a reassuring voice, and a little less rush.</p></div>
      <form id="route-form" class="card route-form">
        <div class="section-title"><h2>Where are we going?</h2><span class="small-pill">Driving</span></div>
        <label for="start">Starting address <span>A</span></label>
        <div class="input-row"><input id="start" name="start" value="Bryant-Denny Stadium, Tuscaloosa, AL" placeholder="Street address, place, or city" autocomplete="street-address" required /></div>
        <label for="end">Your destination <span>B</span></label>
        <div class="input-row"><input id="end" name="end" value="Tuscaloosa Amphitheater, Tuscaloosa, AL" placeholder="Street address, place, or city" autocomplete="street-address" required /></div>
        <div class="route-options"><button type="button" id="swap" class="text-button">⇅ Swap</button></div>
        <button type="submit" class="primary" id="plan">Show my route on the map <span>↗</span></button>
        <p class="hint">Enter two addresses, places, or cities, then search for a route.</p>
      </form>
      <section class="voice-section" aria-labelledby="voice-heading">
        <div class="section-title"><h2 id="voice-heading">A voice for your journey</h2><span class="tiny">MOMMY ASMR</span></div>
        <div id="voices" class="voices"><p class="hint">Loading your guides…</p></div>
        <div class="voice-actions"><button id="sample" type="button" class="secondary" disabled>▷ Hear a little hello</button><button id="stop" type="button" class="text-button">Stop audio</button></div>
        <label for="volume" class="volume-label">Listening volume <input id="volume" type="range" min="0" max="1" step="0.05" value="0.7" /></label>
        <p id="voice-status" class="hint" role="status">Choose the voice you’d like beside you.</p>
        <details class="dev-tts">
          <summary>Developer: test TTS</summary>
          <label for="tts-test-text">Test text</label>
          <textarea id="tts-test-text" maxlength="600">Testing one, two, three. This is a calm navigation voice check.</textarea>
          <button id="tts-test" type="button" class="secondary">Generate with selected voice</button>
          <p class="hint">Uses the selected voice and the same server endpoint as route guidance.</p>
        </details>
      </section>
      <p class="sidebar-footer">Made for the journey, not just the destination. ♡</p>
    </aside>
    <section class="map-panel" aria-label="Map and route preview">
      <div id="map" aria-label="Interactive route map"></div>
      <div class="map-label"><span class="location-dot"></span><div><strong>A little adventure in Tuscaloosa</strong><span>Search two addresses to plan your route.</span></div></div>
      <div id="map-status" class="map-status" role="status">Your next little journey starts here.</div>
      <section id="journey" class="journey" hidden aria-labelledby="journey-heading">
        <div class="section-title"><div><p class="eyebrow">YOUR JOURNEY</p><h2 id="journey-heading"></h2></div><span class="small-pill">Route preview</span></div>
        <p class="hint">Step through the route and hear each direction.</p>
        <div class="current-step"><span class="turn-icon">↱</span><div><span id="step-count" class="tiny"></span><p id="instruction"></p></div></div>
        <div class="step-actions"><button type="button" id="previous" class="secondary" aria-label="Previous direction">←</button><button type="button" id="speak" class="primary">▷ Hear this turn</button><button type="button" id="next" class="secondary" aria-label="Next direction">→</button></div>
        <details><summary>All directions</summary><ol id="steps"></ol></details>
      </section>
      <span class="map-note">SLOW DOWN. YOU’RE ON YOUR WAY.</span>
    </section>
  </main>`;

const $ = (selector) => document.querySelector(selector);
const status = (message) => { $('#map-status').textContent = message; };
const voiceStatus = (message) => { $('#voice-status').textContent = message; };
const audio = new Audio();
audio.preload = 'none';
audio.volume = 0.7;
const speech = createSpeechService(audio, voiceStatus);
let voices = [];
let selectedVoice = 'velvet';
let route = null;
let stepIndex = 0;
let request;
let map;

function invalidateRoute() {
  request?.abort();
  request = null;
  route = null;
  speech.stop();
  map?.clearRoute();
  $('#journey').hidden = true;
  $('#plan').disabled = false;
  $('#plan').innerHTML = 'Show my route on the map <span>↗</span>';
}

function showStep() {
  const step = route.steps[stepIndex];
  $('#step-count').textContent = `DIRECTION ${stepIndex + 1} OF ${route.steps.length} · ${formatDistance(step.distance)}`;
  $('#instruction').textContent = step.instruction;
  $('#previous').disabled = stepIndex === 0;
  $('#next').disabled = stepIndex === route.steps.length - 1;
  $('#speak').disabled = !voices.find((voice) => voice.id === selectedVoice)?.configured;
  if (step.maneuver.location) {
    const [lng, lat] = step.maneuver.location;
    map?.focus({ lat, lng });
  }
}

try {
  map = createMap($('#map'));
} catch (error) { status(error.message); }

for (const kind of ['start', 'end']) $(`#${kind}`).addEventListener('input', () => {
  invalidateRoute();
  status('Your addresses changed. Search for a new route when you’re ready.');
});

$('#swap').addEventListener('click', () => {
  invalidateRoute();
  const start = $('#start').value;
  $('#start').value = $('#end').value;
  $('#end').value = start;
  status('Swapped. Let’s find the way back.');
});

$('#route-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  invalidateRoute();
  const current = new AbortController();
  request = current;
  try {
    const startAddress = $('#start').value.trim();
    const endAddress = $('#end').value.trim();
    if (!startAddress || !endAddress) throw new Error('Enter both a starting address and destination.');
    $('#plan').disabled = true;
    $('#plan').textContent = 'Finding your addresses…';
    status('Finding your starting address…');
    const start = await geocodeAddress(startAddress, { signal: current.signal });
    if (request !== current) return;
    status('Finding your destination…');
    const end = await geocodeAddress(endAddress, { signal: current.signal });
    if (request !== current) return;
    map?.setPoint('start', start);
    map?.setPoint('end', end);
    status('Putting the turns together…');
    const result = await getRoute(start, end, { signal: AbortSignal.any([current.signal, AbortSignal.timeout(20000)]) });
    if (request !== current) return;
    if (!result.steps.length) throw new Error('No directions returned. Try different points.');
    route = result;
    stepIndex = 0;
    $('#journey-heading').textContent = `${formatDuration(route.duration)} · ${formatDistance(route.distance)}`;
    $('#steps').replaceChildren(...route.steps.map((step) => {
      const item = document.createElement('li');
      item.textContent = `${step.instruction} (${formatDistance(step.distance)})`;
      return item;
    }));
    $('#journey').hidden = false;
    showStep();
    map?.drawRoute(route.geometry);
    status('Your route is ready. Take it one turn at a time.');
  } catch (error) {
    if (request === current && error.name !== 'AbortError') status(error.name === 'TimeoutError' ? 'Routing took too long. Please try again.' : error.message);
  } finally {
    if (request === current) {
      $('#plan').disabled = false;
      $('#plan').innerHTML = 'Show my route on the map <span>↗</span>';
    }
  }
});

for (const [id, delta] of [['previous', -1], ['next', 1]]) $(`#${id}`).addEventListener('click', () => {
  if (!route) return;
  speech.stop();
  stepIndex = Math.max(0, Math.min(route.steps.length - 1, stepIndex + delta));
  showStep();
});
$('#speak').addEventListener('click', () => {
  if (route) speech.speak(`${route.steps[stepIndex].instruction} You’re doing lovely, sweetheart.`, selectedVoice);
});
$('#sample').addEventListener('click', () => {
  const voice = voices.find((item) => item.id === selectedVoice);
  if (voice?.configured) speech.speak(voice.sample, voice.id);
});
$('#tts-test').addEventListener('click', () => {
  const text = $('#tts-test-text').value.trim();
  const voice = voices.find((item) => item.id === selectedVoice);
  if (!text) return voiceStatus('Enter some text to test.');
  if (!voice?.configured) return voiceStatus('Choose a configured voice before testing.');
  speech.speak(text, voice.id);
});
$('#stop').addEventListener('click', () => { speech.stop(); voiceStatus('A little quiet. Play again whenever you like.'); });
$('#volume').addEventListener('input', (event) => { audio.volume = Number(event.target.value); });

async function loadVoices() {
  try {
    voices = await speech.voices();
    selectedVoice = voices.find((voice) => voice.configured)?.id || voices[0]?.id;
    $('#voices').replaceChildren(...voices.map((voice) => {
      const label = document.createElement('label');
      label.className = 'voice-card';
      const radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'voice'; radio.value = voice.id; radio.checked = voice.id === selectedVoice;
      const avatar = document.createElement('span');
      avatar.className = 'avatar'; avatar.style.background = voice.color; avatar.textContent = voice.initial;
      const copy = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = voice.name;
      const mood = document.createElement('small'); mood.textContent = voice.mood;
      copy.append(name, mood);
      const badge = document.createElement('span'); badge.className = 'voice-badge'; badge.textContent = voice.configured ? 'READY' : 'SETUP';
      label.append(radio, avatar, copy, badge);
      radio.addEventListener('change', () => {
        selectedVoice = voice.id;
        speech.stop();
        $('#sample').disabled = !voice.configured;
        voiceStatus(voice.configured ? `${voice.name} is here for you.` : 'Add this voice’s Fish Audio ID and API key in config.local.json, then restart the server.');
        if (route) showStep();
      });
      return label;
    }));
    const configured = voices.some((voice) => voice.configured);
    $('#sample').disabled = !configured;
    if (!configured) voiceStatus('Voice setup needed: add your Fish Audio API key and voice IDs to config.local.json, then restart.');
  } catch (error) { voiceStatus(error.message); }
}
loadVoices();
window.addEventListener('pagehide', () => { speech.stop(); request?.abort(); });
