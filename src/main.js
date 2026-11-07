import { createMap } from './services/map.js';
import { getRoute } from './services/routing.js';
import { createSpeechService } from './services/speech.js';
import { createAmbientTrivia } from './services/trivia.js';
import { parseCoordinates, formatDistance, formatDuration } from './utils/directions.js';

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" aria-label="Softly home"><span class="brand-mark">s</span>softly<span class="brand-dot">.</span></a>
    <span class="tagline">A little guidance. A lot of comfort.</span>
    <span class="prototype"><span></span> EARLY EXPLORER</span>
  </header>
  <main class="workspace">
    <aside class="sidebar">
      <div class="intro"><p class="eyebrow">MAKE YOURSELF COMFORTABLE</p><h1>Let’s take the<br><em>soft way home.</em></h1><p>Your route, a reassuring voice, and a little less rush.</p></div>
      <form id="route-form" class="card route-form">
        <div class="section-title"><h2>Where are we going?</h2><span class="small-pill">Driving</span></div>
        <label for="start">Starting point <span>A</span></label>
        <div class="input-row"><input id="start" name="start" value="33.2140, -87.5391" placeholder="Latitude, longitude" required /><button type="button" data-pick="start" class="pick" aria-label="Pick starting point on map">⌖</button></div>
        <label for="end">Your destination <span>B</span></label>
        <div class="input-row"><input id="end" name="end" value="33.1940, -87.5624" placeholder="Latitude, longitude" required /><button type="button" data-pick="end" class="pick" aria-label="Pick destination on map">⌖</button></div>
        <div class="route-options"><button type="button" id="locate" class="text-button">⌖ Use my location</button><button type="button" id="swap" class="text-button">⇅ Swap</button></div>
        <button type="submit" class="primary" id="plan">Find my soft route <span>↗</span></button>
        <p class="hint">Enter coordinates or use ⌖ to pick on the map.</p>
      </form>
      <section class="voice-section" aria-labelledby="voice-heading">
        <div class="section-title"><h2 id="voice-heading">A voice for your journey</h2><span class="tiny">MOMMY ASMR</span></div>
        <div id="voices" class="voices"><p class="hint">Loading your guides…</p></div>
        <div class="voice-actions"><button id="sample" type="button" class="secondary" disabled>▷ Hear a little hello</button><button id="stop" type="button" class="text-button">Stop audio</button></div>
        <label for="volume" class="volume-label">Listening volume <input id="volume" type="range" min="0" max="1" step="0.05" value="0.7" /></label>
        <audio id="audio" controls preload="none" aria-label="Generated navigation audio"></audio>
        <p id="voice-status" class="hint" role="status">Choose the voice you’d like beside you.</p>
      </section>
      <section class="settings card" aria-labelledby="settings-heading">
        <div class="section-title"><h2 id="settings-heading">User settings</h2><span class="tiny">YOUR WAY</span></div>
        <fieldset class="preference-group">
          <legend>Navigation preferences</legend>
          <p class="hint">We’ll use these when finding your next route.</p>
          <label class="switch-row" for="avoid-tolls"><span>Avoid Tolls</span><input id="avoid-tolls" type="checkbox" role="switch" data-avoid="toll" /><span class="switch-control" aria-hidden="true"></span></label>
          <label class="switch-row" for="avoid-highways"><span>Avoid Highways/Freeways</span><input id="avoid-highways" type="checkbox" role="switch" data-avoid="motorway" /><span class="switch-control" aria-hidden="true"></span></label>
          <label class="switch-row" for="avoid-ferries"><span>Avoid Ferries</span><input id="avoid-ferries" type="checkbox" role="switch" data-avoid="ferry" /><span class="switch-control" aria-hidden="true"></span></label>
        </fieldset>
        <fieldset class="theme-group">
          <legend>Theme</legend>
          <div class="theme-options" role="radiogroup" aria-label="Theme">
            <label><input type="radio" name="theme" value="light" checked /><span>Light</span></label>
            <label><input type="radio" name="theme" value="dark" /><span>Dark</span></label>
          </div>
        </fieldset>
        <fieldset class="trivia-group">
          <legend>Roadside trivia</legend>
          <p class="hint">On a quiet, steady stretch, we’ll share a note about the place around you no more than once every 18 minutes.</p>
          <div class="trivia-actions"><button id="skip-trivia" type="button" class="text-button">Skip next note</button><button id="mute-trivia" type="button" class="text-button" aria-pressed="false">Mute trivia</button></div>
          <p id="ambient-note" class="hint" role="status">Start ambient guidance when you’re ready to drive.</p>
        </fieldset>
      </section>
      <p class="sidebar-footer">Made for the journey, not just the destination. ♡</p>
    </aside>
    <section class="map-panel" aria-label="Map and route preview">
      <div id="map" aria-label="Interactive route map"></div>
      <div class="map-label"><span class="location-dot"></span><div><strong>A little adventure in Tuscaloosa</strong><span>Try the sample points, or choose your own.</span></div></div>
      <div id="map-status" class="map-status" role="status">Your next little journey starts here.</div>
      <section id="journey" class="journey" hidden aria-labelledby="journey-heading">
        <div class="section-title"><div><p class="eyebrow">YOUR JOURNEY</p><h2 id="journey-heading"></h2></div><span class="small-pill">Route preview</span></div>
        <p class="hint">Step through the route and hear each direction.</p>
        <div class="current-step"><span class="turn-icon">↱</span><div><span id="step-count" class="tiny"></span><p id="instruction"></p></div></div>
        <div class="step-actions"><button type="button" id="previous" class="secondary" aria-label="Previous direction">←</button><button type="button" id="speak" class="primary">▷ Hear this turn</button><button type="button" id="next" class="secondary" aria-label="Next direction">→</button></div>
        <button type="button" id="start-guidance" class="ambient-guidance" disabled>Start ambient guidance</button>
        <details><summary>All directions</summary><ol id="steps"></ol></details>
      </section>
      <span class="map-note">SLOW DOWN. YOU’RE ON YOUR WAY.</span>
    </section>
  </main>`;

const $ = (selector) => document.querySelector(selector);
const status = (message) => { $('#map-status').textContent = message; };
const voiceStatus = (message) => { $('#voice-status').textContent = message; };
const audio = $('#audio');
audio.volume = 0.7;
const speech = createSpeechService(audio, voiceStatus);
let voices = [];
let selectedVoice = 'velvet';
let pickTarget = null;
let route = null;
let stepIndex = 0;
let request;
let map;
let navigationActive = false;
let triviaMuted = false;
let locationWatcher;
let lastPosition;
const ambientTrivia = createAmbientTrivia();

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector(`input[name="theme"][value="${theme}"]`).checked = true;
  try { localStorage.setItem('softly-theme', theme); } catch { /* Theme still applies for this visit. */ }
}

try {
  const savedTheme = localStorage.getItem('softly-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
} catch { /* Storage may be unavailable in privacy-focused browsers. */ }

function invalidateRoute() {
  request?.abort();
  request = null;
  route = null;
  speech.stop();
  map?.clearRoute();
  $('#journey').hidden = true;
  $('#plan').disabled = false;
  $('#plan').innerHTML = 'Find my soft route <span>↗</span>';
  stopAmbientGuidance();
}

function stopAmbientGuidance() {
  navigationActive = false;
  if (locationWatcher !== undefined) navigator.geolocation?.clearWatch(locationWatcher);
  locationWatcher = undefined;
  ambientTrivia.reset();
  $('#start-guidance').textContent = 'Start ambient guidance';
}

function considerAmbientTrivia(position) {
  if (!route || !navigationActive) return;
  const point = { lat: position.coords.latitude, lng: position.coords.longitude };
  const fact = ambientTrivia.consider({ point, speedMps: position.coords.speed, steps: route.steps, navigating: navigationActive, muted: triviaMuted });
  if (!fact) return;
  $('#ambient-note').textContent = `Roadside note: ${fact.text}`;
  status(`A little note about ${fact.name} is ready.`);
  if (voices.find((voice) => voice.id === selectedVoice)?.configured) speech.speak(fact.text, selectedVoice);
}

function updatePoint(kind, point) {
  $(`#${kind}`).value = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
  map?.setPoint(kind, point);
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
  map = createMap($('#map'), (point) => {
    if (!pickTarget) return status('Choose a ⌖ button beside a field, then tap the map.');
    invalidateRoute();
    updatePoint(pickTarget, point);
    pickTarget = null;
    document.querySelectorAll('[data-pick]').forEach((button) => button.classList.remove('active'));
    status('Point selected. Ready when you are.');
  });
  for (const kind of ['start', 'end']) map.setPoint(kind, parseCoordinates($(`#${kind}`).value));
} catch (error) { status(error.message); }

document.querySelectorAll('[data-pick]').forEach((button) => button.addEventListener('click', () => {
  pickTarget = button.dataset.pick;
  document.querySelectorAll('[data-pick]').forEach((item) => item.classList.toggle('active', item === button));
  status(`Tap the map to choose your ${pickTarget === 'start' ? 'starting point' : 'destination'}.`);
}));

for (const kind of ['start', 'end']) $(`#${kind}`).addEventListener('input', () => {
  invalidateRoute();
  try { map?.setPoint(kind, parseCoordinates($(`#${kind}`).value)); } catch { /* Wait for complete coordinates. */ }
  status('Your points changed. Find a new route when you’re ready.');
});

$('#swap').addEventListener('click', () => {
  invalidateRoute();
  const start = $('#start').value;
  $('#start').value = $('#end').value;
  $('#end').value = start;
  try { for (const kind of ['start', 'end']) map?.setPoint(kind, parseCoordinates($(`#${kind}`).value)); }
  catch (error) { return status(error.message); }
  status('Swapped. Let’s find the way back.');
});

$('#locate').addEventListener('click', () => {
  if (!navigator.geolocation) return status('Location isn’t available in this browser. Pick a point on the map.');
  const inputAtRequest = $('#start').value;
  $('#locate').disabled = true;
  status('Finding your starting point…');
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    $('#locate').disabled = false;
    if ($('#start').value !== inputAtRequest) return;
    invalidateRoute();
    const point = { lat: coords.latitude, lng: coords.longitude };
    updatePoint('start', point);
    map?.focus(point);
    status('Found you. Where shall we go?');
  }, () => { $('#locate').disabled = false; status('Couldn’t access your location. Enter coordinates or pick on the map.'); }, { timeout: 15000 });
});

$('#route-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  invalidateRoute();
  const current = new AbortController();
  request = current;
  try {
    const start = parseCoordinates($('#start').value);
    const end = parseCoordinates($('#end').value);
    $('#plan').disabled = true;
    $('#plan').textContent = 'Finding your way…';
    status('Putting the turns together…');
    const avoid = [...document.querySelectorAll('[data-avoid]:checked')].map((input) => input.dataset.avoid);
    const result = await getRoute(start, end, { signal: AbortSignal.any([current.signal, AbortSignal.timeout(20000)]), avoid });
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
    $('#start-guidance').disabled = false;
    showStep();
    map?.drawRoute(route.geometry);
    status('Your route is ready. Take it one turn at a time.');
  } catch (error) {
    if (request === current && error.name !== 'AbortError') status(error.name === 'TimeoutError' ? 'Routing took too long. Please try again.' : error.message);
  } finally {
    if (request === current) {
      $('#plan').disabled = false;
      $('#plan').innerHTML = 'Find my soft route <span>↗</span>';
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
$('#stop').addEventListener('click', () => { speech.stop(); voiceStatus('A little quiet. Play again whenever you like.'); });
$('#volume').addEventListener('input', (event) => { audio.volume = Number(event.target.value); });
$('#start-guidance').addEventListener('click', () => {
  if (navigationActive) { stopAmbientGuidance(); $('#ambient-note').textContent = 'Ambient guidance paused.'; return; }
  if (!navigator.geolocation) return status('Live guidance needs location access in this browser.');
  navigationActive = true;
  $('#start-guidance').textContent = 'Pause ambient guidance';
  $('#ambient-note').textContent = 'Watching for a calm stretch of road. Trivia begins after five minutes above 45 mph with no maneuver within five miles.';
  locationWatcher = navigator.geolocation.watchPosition((position) => { lastPosition = position; considerAmbientTrivia(position); }, () => {
    stopAmbientGuidance();
    $('#ambient-note').textContent = 'We couldn’t read your live location, so ambient guidance is paused.';
  }, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 });
});
setInterval(() => { if (lastPosition) considerAmbientTrivia(lastPosition); }, 60_000);
$('#skip-trivia').addEventListener('click', () => { speech.stop(); ambientTrivia.skip(); $('#ambient-note').textContent = 'Skipped. We’ll wait before sharing another note.'; });
$('#mute-trivia').addEventListener('click', () => {
  triviaMuted = !triviaMuted;
  $('#mute-trivia').textContent = triviaMuted ? 'Unmute trivia' : 'Mute trivia';
  $('#mute-trivia').setAttribute('aria-pressed', String(triviaMuted));
  if (triviaMuted) speech.stop();
  $('#ambient-note').textContent = triviaMuted ? 'Roadside trivia is muted.' : 'Roadside trivia is ready when you start ambient guidance.';
});
document.querySelectorAll('[data-avoid]').forEach((input) => input.addEventListener('change', () => {
  if (route) status('Navigation preferences changed. Find a new route to apply them.');
}));
document.querySelectorAll('input[name="theme"]').forEach((input) => input.addEventListener('change', () => {
  if (input.checked) setTheme(input.value);
}));

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
        voiceStatus(voice.configured ? `${voice.name} is here for you.` : 'Add this voice’s Fish Audio ID and the API key in .env, then restart the server.');
        if (route) showStep();
      });
      return label;
    }));
    const configured = voices.some((voice) => voice.configured);
    $('#sample').disabled = !configured;
    if (!configured) voiceStatus('Voice setup needed: add your Fish Audio API key and voice IDs to .env, then restart.');
  } catch (error) { voiceStatus(error.message); }
}
loadVoices();
window.addEventListener('pagehide', () => { speech.stop(); request?.abort(); stopAmbientGuidance(); });
