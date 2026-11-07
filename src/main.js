import { createMap } from './services/map.js';
import { getRoute } from './services/routing.js';
import { searchAddresses } from './services/geocoding.js';
import { createSpeechService } from './services/speech.js';
import { formatDistance, formatDuration } from './utils/directions.js';
import { setupTabs } from './ui/tabs.js';
import { createVoicePicker } from './ui/voices.js';

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" aria-label="Mommy Maps home"><span class="brand-mark">m</span>mommy maps<span class="brand-dot">.</span></a>
    <nav class="view-tabs" role="tablist" aria-label="App views">
      <button id="journey-tab" type="button" role="tab" aria-selected="true" aria-controls="journey-panel" data-tab="journey">Your journey</button>
      <button id="voices-tab" type="button" role="tab" aria-selected="false" aria-controls="voices-panel" data-tab="voices" tabindex="-1">Voice library</button>
    </nav>
    <span class="prototype"><span></span> EARLY EXPLORER</span>
  </header>
  <main id="journey-panel" class="workspace" role="tabpanel" aria-labelledby="journey-tab">
    <aside class="sidebar">
      <div class="intro"><p class="eyebrow">MAKE YOURSELF COMFORTABLE</p><h1>Let’s take the<br><em>soft way home.</em></h1><p>Your route, a reassuring voice, and a little less rush.</p></div>
      <form id="route-form" class="card route-form">
        <div class="section-title"><h2>Where are we going?</h2><span class="small-pill">Driving</span></div>
        <label for="start">Starting address <span>A</span></label>
        <div class="input-row"><input id="start" name="start" value="Finding your current location…" placeholder="Street address, place, or city" autocomplete="street-address" required /><button type="button" class="address-search" data-search="start">Search</button></div>
        <div id="start-results" class="address-results" aria-live="polite"></div>
        <label for="end">Your destination <span>B</span></label>
        <div class="input-row"><input id="end" name="end" value="" placeholder="Street address, place, or city" autocomplete="street-address" required /><button type="button" class="address-search" data-search="end">Search</button></div>
        <div id="end-results" class="address-results" aria-live="polite"></div>
        <div class="route-options"><button type="button" id="swap" class="text-button">⇅ Swap</button></div>
        <button type="submit" class="primary" id="plan">Show my route on the map <span>↗</span></button>
        <p class="hint">Suggestions appear as you type. Choose one for each address, then find your route.</p>
      </form>
      <section class="voice-section" aria-labelledby="voice-heading">
        <div class="section-title"><h2 id="voice-heading">A voice for your journey</h2><button id="browse-voices" class="text-button" type="button">Browse all ↗</button></div>
        <label class="voice-select-label" for="voice-select">Your navigation voice</label>
        <div class="voice-select-wrap"><select id="voice-select" aria-describedby="voice-summary" disabled><option>Loading your guides…</option></select></div>
        <p id="voice-summary" class="voice-summary">A little company for the road.</p>
        <div class="voice-actions"><button id="sample" type="button" class="secondary" disabled>▷ Hear a little hello</button><button id="stop" type="button" class="text-button">Stop audio</button></div>
        <label for="volume" class="volume-label">Listening volume <input id="volume" type="range" min="0" max="1" step="0.05" value="0.7" /></label>
        <p id="voice-status" class="hint" role="status">Choose the voice you’d like beside you.</p>
      </section>
      <p class="sidebar-footer">Made for the journey, not just the destination. ♡</p>
    </aside>
    <section class="map-panel" aria-label="Map and route preview">
      <div id="map" aria-label="Interactive route map"></div>
      <div class="map-label"><span class="location-dot"></span><div><strong>Start exploring the University of Utah</strong><span>Search two addresses to plan your route.</span></div></div>
      <div id="map-status" class="map-status" role="status">Your next little journey starts here.</div>
      <section id="journey" class="journey" hidden aria-labelledby="journey-heading">
        <div class="section-title"><div><p class="eyebrow">YOUR JOURNEY</p><h2 id="journey-heading"></h2></div><span class="small-pill">Route preview</span></div>
        <p class="hint">Step through the route and hear each direction.</p>
        <div class="current-step"><span class="turn-icon">↱</span><div><span id="step-count" class="tiny"></span><p id="instruction"></p></div></div>
        <div class="step-actions"><button type="button" id="previous" class="secondary" aria-label="Previous direction">←</button><button type="button" id="speak" class="primary">▷ Hear this turn</button><button type="button" id="next" class="secondary" aria-label="Next direction">→</button></div>
        <div id="simulation-tools" hidden><div class="simulation-controls"><button type="button" id="simulate" class="secondary">▷ Simulate route</button><label for="simulation-speed">Pace <select id="simulation-speed"><option value="14000">Relaxed</option><option value="9000" selected>Normal</option><option value="5000">Quick</option></select></label></div>
        <p id="simulation-status" class="hint" role="status">Simulation moves through each route instruction with voice guidance.</p></div>
        <details><summary>All directions</summary><ol id="steps"></ol></details>
      </section>
      <span class="map-note">SLOW DOWN. YOU’RE ON YOUR WAY.</span>
    </section>
  </main>
  <section id="voices-panel" class="voice-library" role="tabpanel" aria-labelledby="voices-tab" hidden>
    <div class="library-heading"><div><p class="eyebrow">A LITTLE COMPANY FOR THE ROAD</p><h1>Find your kind <em>of calm.</em></h1><p>Meet your guides. A different voice, the same gentle way home.</p></div><button id="back-to-route" type="button" class="secondary">Back to my route ↗</button></div>
    <div class="library-section-heading"><h2>Good company comes in a few voices.</h2><p id="library-selection">Choose a little company for the road.</p></div>
    <div id="voice-gallery" class="voice-gallery"><p class="library-empty">Getting your guides ready…</p></div>
    <div class="library-player"><span class="player-symbol" aria-hidden="true">♫</span><div class="library-player-copy"><strong>A little hello, before you go.</strong><p id="library-voice-status" role="status">Preview a voice to find your favorite.</p></div><label for="library-volume" class="volume-label">Volume <input id="library-volume" type="range" min="0" max="1" step="0.05" value="0.7" /></label><button id="library-stop" type="button" class="secondary">Stop preview</button></div>
    <div class="library-note"><p>AI-generated voices, made for a softer journey. Voice previews need a configured Fish Audio connection.</p><button id="retry-voices" type="button" class="text-button" hidden>Retry loading voices ↻</button></div>
    <details class="dev-tts">
      <summary>Developer: test TTS</summary>
      <label for="tts-test-text">Test text</label>
      <textarea id="tts-test-text" maxlength="600">Testing one, two, three. This is a calm navigation voice check.</textarea>
      <button id="tts-test" type="button" class="secondary">Generate with selected voice</button>
      <p class="hint">Uses the selected voice and the same server endpoint as route guidance.</p>
    </details>
    <p class="library-footer">A little guidance. A lot of comfort. <span aria-hidden="true">♡</span></p>
  </section>`;

const $ = (selector) => document.querySelector(selector);
const status = (message) => { $('#map-status').textContent = message; };
const voiceStatus = (message) => {
  $('#voice-status').textContent = message;
  $('#library-voice-status').textContent = message;
};
const audio = new Audio();
audio.preload = 'none';
audio.volume = 0.7;
const speech = createSpeechService(audio, voiceStatus);
let voices = [];
let selectedVoice;
const selectedPlaces = { start: null, end: null };
let route = null;
let stepIndex = 0;
let request;
let map;
let simulationTimer;
let simulationRunning = false;
const suggestionTimers = {};
const suggestionRequests = {};

async function loadRuntime() {
  try {
    const response = await fetch('/api/runtime');
    if (!response.ok) return;
    const runtime = await response.json();
    $('#simulation-tools').hidden = !runtime.simulator;
  } catch { /* Simulator stays hidden outside the development command. */ }
}
loadRuntime();

const activateTab = setupTabs((name) => {
  if (name === 'voices' && simulationRunning) stopSimulation('Simulation paused while you browse voices.');
  if (name === 'journey') requestAnimationFrame(() => map?.resize());
});
$('#browse-voices').addEventListener('click', () => activateTab('voices', { focus: true }));
$('#back-to-route').addEventListener('click', () => activateTab('journey', { focus: true }));
const voicePicker = createVoicePicker({
  select: $('#voice-select'), summary: $('#voice-summary'), gallery: $('#voice-gallery'),
  selection: $('#library-selection'), onSelect: selectVoice,
  onPreview: (voice) => speech.speak(voice.sample, voice.id),
});
function selectVoice(id) {
  const voice = voices.find((item) => item.id === id);
  if (!voice) return;
  selectedVoice = id;
  speech.stop();
  voicePicker.setSelected(id);
  $('#sample').disabled = !voice.configured;
  voiceStatus(voice.configured ? voice.name + ' is here for you.' : 'This voice needs a Fish Audio connection before it can play.');
  if (route) showStep();
}

function stopSimulation(message) {
  clearTimeout(simulationTimer);
  simulationTimer = undefined;
  simulationRunning = false;
  map?.clearSimulationPoint();
  speech.stop();
  $('#simulate').textContent = '▷ Simulate route';
  if (message) $('#simulation-status').textContent = message;
}

function scheduleSimulationStep() {
  const delay = Number($('#simulation-speed').value);
  simulationTimer = setTimeout(() => {
    if (!simulationRunning || !route) return;
    if (stepIndex >= route.steps.length - 1) return stopSimulation('Simulation complete. You’ve arrived.');
    stepIndex += 1;
    playSimulationStep();
    scheduleSimulationStep();
  }, delay);
}

function playSimulationStep() {
  const step = route.steps[stepIndex];
  showStep();
  if (step.maneuver.location) {
    const [lng, lat] = step.maneuver.location;
    map?.setSimulationPoint({ lat, lng });
  }
  const voice = voices.find((item) => item.id === selectedVoice);
  if (voice?.configured) speech.speak(step.instruction, selectedVoice);
  $('#simulation-status').textContent = `Simulating direction ${stepIndex + 1} of ${route.steps.length}.`;
}

function invalidateRoute() {
  stopSimulation();
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

function useCurrentLocation() {
  const startAtRequest = $('#start').value;
  if (!navigator.geolocation) {
    $('#start').value = '';
    return status('Current location is unavailable. Search for a starting address.');
  }
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    if ($('#start').value !== startAtRequest) return;
    const place = { lat: coords.latitude, lng: coords.longitude, label: 'Your current location' };
    selectedPlaces.start = place;
    $('#start').value = place.label;
    map?.setPoint('start', place);
    map?.focus(place);
    status('Starting from your current location. Search for a destination to begin.');
  }, () => {
    if ($('#start').value !== startAtRequest) return;
    $('#start').value = '';
    status('Location permission was not granted. Search for a starting address.');
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}
useCurrentLocation();

function clearResults(kind) { $(`#${kind}-results`).replaceChildren(); }

function renderAddressResults(kind, results, message) {
  const list = document.createElement('ul');
  list.className = 'address-result-list';
  for (const place of results) {
    const item = document.createElement('li');
    const choose = document.createElement('button');
    choose.type = 'button';
    choose.textContent = place.label;
    choose.addEventListener('click', () => selectPlace(kind, place));
    item.append(choose);
    list.append(item);
  }
  $(`#${kind}-results`).replaceChildren(list);
  if (message) status(message);
}

function selectPlace(kind, place) {
  selectedPlaces[kind] = place;
  $(`#${kind}`).value = place.label;
  clearResults(kind);
  map?.setPoint(kind, place);
  map?.focus(place);
  status(`${kind === 'start' ? 'Starting address' : 'Destination'} selected. Search the other address or find your route.`);
}

async function searchAddress(kind) {
  const query = $(`#${kind}`).value.trim();
  if (!query) throw new Error(`Enter a ${kind === 'start' ? 'starting address' : 'destination'} first.`);
  const button = document.querySelector(`[data-search="${kind}"]`);
  button.disabled = true;
  clearResults(kind);
  status(`Searching for your ${kind === 'start' ? 'starting address' : 'destination'}…`);
  try {
    const { results } = await searchAddresses(query, { signal: request?.signal });
    renderAddressResults(kind, results, `Choose the ${kind === 'start' ? 'starting address' : 'destination'} that looks right.`);
  } finally { button.disabled = false; }
}

function scheduleSuggestions(kind) {
  clearTimeout(suggestionTimers[kind]);
  suggestionRequests[kind]?.abort();
  const query = $(`#${kind}`).value.trim();
  if (query.length < 3) return clearResults(kind);
  suggestionTimers[kind] = setTimeout(async () => {
    const controller = new AbortController();
    suggestionRequests[kind] = controller;
    try {
      const { results } = await searchAddresses(query, { signal: controller.signal });
      if ($(`#${kind}`).value.trim() === query && !controller.signal.aborted) renderAddressResults(kind, results);
    } catch (error) {
      if (error.name !== 'AbortError') clearResults(kind);
    }
  }, 350);
}

for (const kind of ['start', 'end']) $(`#${kind}`).addEventListener('input', () => {
  invalidateRoute();
  selectedPlaces[kind] = null;
  clearResults(kind);
  status('Your addresses changed. Search for a new route when you’re ready.');
  scheduleSuggestions(kind);
});

document.querySelectorAll('[data-search]').forEach((button) => button.addEventListener('click', async () => {
  try { await searchAddress(button.dataset.search); }
  catch (error) { if (error.name !== 'AbortError') status(error.message); }
}));

$('#swap').addEventListener('click', () => {
  invalidateRoute();
  const start = $('#start').value;
  $('#start').value = $('#end').value;
  $('#end').value = start;
  [selectedPlaces.start, selectedPlaces.end] = [selectedPlaces.end, selectedPlaces.start];
  clearResults('start');
  clearResults('end');
  status('Swapped. Let’s find the way back.');
});

$('#route-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  invalidateRoute();
  const current = new AbortController();
  request = current;
  try {
    if (!selectedPlaces.start) {
      await searchAddress('start');
      throw new Error('Choose a starting address from the search results.');
    }
    if (!selectedPlaces.end) {
      await searchAddress('end');
      throw new Error('Choose a destination from the search results.');
    }
    $('#plan').disabled = true;
    $('#plan').textContent = 'Finding your route…';
    const start = selectedPlaces.start;
    const end = selectedPlaces.end;
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
  stopSimulation();
  speech.stop();
  stepIndex = Math.max(0, Math.min(route.steps.length - 1, stepIndex + delta));
  showStep();
});
$('#simulate').addEventListener('click', () => {
  if (!route) return;
  if (simulationRunning) return stopSimulation('Simulation paused.');
  if (stepIndex >= route.steps.length - 1) {
    stepIndex = 0;
  }
  simulationRunning = true;
  $('#simulate').textContent = 'Ⅱ Pause simulation';
  playSimulationStep();
  scheduleSimulationStep();
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
for (const id of ['volume', 'library-volume']) $('#'+id).addEventListener('input', (event) => {
  audio.volume = Number(event.target.value);
  $('#volume').value = event.target.value;
  $('#library-volume').value = event.target.value;
});
$('#library-stop').addEventListener('click', () => { speech.stop(); voiceStatus('A little quiet. Play again whenever you like.'); });
$('#retry-voices').addEventListener('click', loadVoices);

async function loadVoices() {
  $('#retry-voices').disabled = true;
  try {
    voices = await speech.voices();
    selectedVoice = voices.find((voice) => voice.id === selectedVoice)?.id || voices.find((voice) => voice.configured)?.id || voices[0]?.id;
    voicePicker.render(voices, selectedVoice);
    $('#retry-voices').hidden = voices.length > 0;
    $('#sample').disabled = !voices.find((voice) => voice.id === selectedVoice)?.configured;
    if (selectedVoice) selectVoice(selectedVoice);
    else voiceStatus('No voices are available yet. Open the voice library to retry.');
  } catch (error) {
    voicePicker.showError(error.message);
    $('#sample').disabled = true;
    $('#retry-voices').hidden = false;
    voiceStatus(error.message);
  } finally { $('#retry-voices').disabled = false; }
}
loadVoices();
window.addEventListener('pagehide', () => { stopSimulation(); speech.stop(); request?.abort(); });
