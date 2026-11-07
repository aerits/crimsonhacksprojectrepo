import { createMap } from './services/map.js';
import { getRoute } from './services/routing.js';
import { searchAddresses } from './services/geocoding.js';
import { createSpeechService } from './services/speech.js';
import { createAmbientTrivia } from './services/trivia.js';
import { formatDistance, formatDuration } from './utils/directions.js';
import { addressSearchOrigin } from './utils/location.js';
import { setupTabs } from './ui/tabs.js';
import { createVoicePicker, voicePortrait } from './ui/voices.js';
import { createPhraseSettings } from './ui/phrases.js';
import { sunGlare } from './utils/sun.js';
import { loadSavedPlaces, removePlace, saveSavedPlaces, upsertPlace } from './utils/saved-places.js';
import { createReminder } from './utils/reminders.js';
import { nationalParkPromptFor } from './data/national-park-prompts.js';
import { utahStateParks, utahTrails } from './data/utah-outdoors.js';
import { mapCategories } from './data/map-categories.js';

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" aria-label="Mommy Maps home"><span class="brand-mark"><img id="header-voice-portrait" src="/images/guide-luna.png" alt="Selected navigation voice" /></span><span id="brand-name">mommy maps</span><span class="brand-dot">.</span></a>
    <div class="map-actions" aria-label="Map options"><button id="open-voices" type="button" class="map-action voice-map-action" aria-label="Open voice library"><img src="/images/voice-guide.svg" alt="" aria-hidden="true" /></button><button id="open-settings" type="button" class="map-action" aria-label="Open settings">⚙</button></div>
    <nav class="view-tabs" role="tablist" aria-label="App views">
      <button id="journey-tab" type="button" role="tab" aria-selected="true" aria-controls="journey-panel" data-tab="journey">Your journey</button>
      <button id="voices-tab" type="button" role="tab" aria-selected="false" aria-controls="voices-panel" data-tab="voices" tabindex="-1">Voice library</button>
      <button id="settings-tab" type="button" role="tab" aria-selected="false" aria-controls="settings-panel" data-tab="settings" tabindex="-1">Settings</button>
    </nav>
    <span class="prototype"><span></span> EARLY EXPLORER</span>
  </header>
  <main id="journey-panel" class="workspace" role="tabpanel" aria-labelledby="journey-tab">
    <aside class="sidebar">
      <div class="intro"><h1>Where do you<br>want to go?</h1><p class="intro-guide" aria-live="polite" aria-atomic="true">Let <span id="intro-voice-name">your chosen voice</span> guide you.</p></div>
      <form id="route-form" class="card route-form">
        <div class="section-title"><h2>Where are we going?</h2><span class="small-pill">Driving</span></div>
        <label for="start">Starting address <span>A</span></label>
        <div class="input-row"><input id="start" name="start" value="Finding your current location…" placeholder="Street address, place, or city" autocomplete="off" aria-controls="start-results" required /><button id="locate" type="button" class="location-search" aria-label="Use my GPS location" title="Use my GPS location">⌖</button><button type="button" class="address-search" data-search="start">Search</button></div>
        <div id="start-results" class="address-results" aria-live="polite"></div>
        <label for="end">Your destination <span>B</span></label>
        <div class="input-row"><input id="end" name="end" value="" placeholder="Street address, place, or city" autocomplete="off" aria-controls="end-results" required /><button id="clear-end" type="button" class="clear-address" aria-label="Clear destination" title="Clear destination" hidden>×</button><button type="button" class="address-search" data-search="end">Search</button></div>
        <div id="end-results" class="address-results" aria-live="polite"></div>
        <div class="quick-destinations" aria-label="Saved destinations"><button id="go-home" type="button" class="secondary">Home</button><button id="go-work" type="button" class="secondary">Work</button><button id="go-favorite" type="button" class="secondary">Favorite</button></div>
        <div class="route-options"><button type="button" id="swap" class="text-button">⇆ Swap</button></div>
        <fieldset id="map-category-filter" class="map-category-filter"><legend>Map place legend</legend><span class="map-category-title" aria-hidden="true">Map legend</span>${mapCategories.map(({ id, label, color }) => `<label style="--map-category-color: ${color}"><input type="checkbox" value="${id}" checked />${label}</label>`).join('')}</fieldset>
        <button type="submit" class="primary" id="plan">Show my route on the map <span>↗</span></button>
        <p class="hint">Suggestions appear as you type. Choose one for each address, then find your route.</p>
      </form>
      <button id="edit-route" type="button" class="edit-route" aria-label="Edit route" hidden>⌕ <span>Edit route</span></button>
      <section id="voice-section" class="voice-section" aria-labelledby="voice-heading">
        <div class="section-title"><h2 id="voice-heading">A voice for your journey</h2><button id="browse-voices" class="text-button" type="button">Browse all ↗</button></div>
        <label class="voice-select-label" for="voice-select">Your navigation voice</label>
        <div class="voice-select-wrap"><select id="voice-select" aria-describedby="voice-summary" disabled><option>Loading your guides…</option></select></div>
        <p id="selected-voice-name" class="selected-voice-name" aria-live="polite" aria-atomic="true">Loading your guide…</p>
        <p id="voice-summary" class="voice-summary">A little company for the road.</p>
        <div class="voice-actions"><button id="sample" type="button" class="secondary" disabled>▷ Hear a little hello</button><button id="stop" type="button" class="text-button">Stop audio</button></div>
        <label for="volume" class="volume-label">Listening volume <input id="volume" type="range" min="0" max="1" step="0.05" value="0.7" /></label>
        <p id="voice-status" class="hint" role="status">Choose the voice you’d like beside you.</p>
      </section>
      <section id="settings" class="settings card" aria-labelledby="settings-heading">
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
            <label><input type="radio" name="theme" value="pink" /><span>Pink</span></label>
            <label><input type="radio" name="theme" value="verity" /><span>Verity</span></label>
            <label><input type="radio" name="theme" value="dark" /><span>Dark</span></label>
          </div>
        </fieldset>
      </section>
      <section id="journey-settings" class="settings card" aria-labelledby="journey-settings-heading">
        <div class="section-title"><h2 id="journey-settings-heading">Journey extras</h2><span class="tiny">YOUR RHYTHM</span></div>
        <label class="affirmation-label" for="affirmation-style">After-turn encouragement
          <select id="affirmation-style">
            <option value="neutral">Neutral</option>
            <option value="girl">Girl</option>
            <option value="boy">Boy</option>
            <option value="enby">Enby</option>
          </select>
        </label>
        <details class="phrase-settings">
          <summary>Journey encouragements <span id="phrase-count" class="tiny"></span></summary>
          <p id="phrase-help" class="hint">Your encouragements join the built-in collection after spoken directions. Save up to 20 phrases in this browser.</p>
          <form id="phrase-form">
            <label for="custom-phrase">Your encouragement</label>
            <textarea id="custom-phrase" rows="3" maxlength="160" required placeholder="You’ve got this, one turn at a time." aria-describedby="phrase-help phrase-characters phrase-status"></textarea>
            <div class="phrase-editor-footer"><span id="phrase-characters" class="tiny"></span><div><button id="save-phrase" type="submit" class="secondary">Add phrase</button><button id="cancel-phrase" type="button" class="text-button" hidden>Cancel</button></div></div>
          </form>
          <p id="phrase-status" class="hint" role="status"></p>
          <p id="phrases-empty" class="hint">No personal encouragements yet. Built-in encouragements will keep you company.</p>
          <ul id="custom-phrases" class="custom-phrases" aria-label="Personal journey encouragements"></ul>
        </details>
        <details class="phrase-settings">
          <summary>Arrival encouragements <span id="arrival-phrase-count" class="tiny"></span></summary>
          <p id="arrival-phrase-help" class="hint">These are only spoken after the arrival direction. Save up to 20 phrases in this browser.</p>
          <form id="arrival-phrase-form">
            <label for="arrival-custom-phrase">Your arrival encouragement</label>
            <textarea id="arrival-custom-phrase" rows="3" maxlength="160" required placeholder="You made it. I’m proud of you." aria-describedby="arrival-phrase-help arrival-phrase-characters arrival-phrase-status"></textarea>
            <div class="phrase-editor-footer"><span id="arrival-phrase-characters" class="tiny"></span><div><button id="save-arrival-phrase" type="submit" class="secondary">Add phrase</button><button id="cancel-arrival-phrase" type="button" class="text-button" hidden>Cancel</button></div></div>
          </form>
          <p id="arrival-phrase-status" class="hint" role="status"></p>
          <p id="arrival-phrases-empty" class="hint">No personal arrival encouragements yet.</p>
          <ul id="arrival-custom-phrases" class="custom-phrases" aria-label="Personal arrival encouragements"></ul>
        </details>
        <fieldset class="trivia-group">
          <legend>Roadside trivia</legend>
          <p class="hint">On a quiet, steady stretch, we’ll share a note about the place around you no more than once every 18 minutes.</p>
          <label class="switch-row trivia-toggle" for="mute-trivia"><span>Mute trivia</span><input id="mute-trivia" type="checkbox" role="switch" /><span class="switch-control" aria-hidden="true"></span></label>
          <p id="ambient-note" class="hint" role="status">Start ambient guidance when you’re ready to drive.</p>
        </fieldset>
        <fieldset class="trivia-group"><legend>Explore Utah</legend><label for="utah-parks" class="hint">Utah State Parks</label><select id="utah-parks"><option value="">Choose a park to explore</option></select><label for="utah-trails" class="hint">Trail ideas</label><select id="utah-trails"><option value="">Choose a trail idea</option></select><p id="outdoor-note" class="hint">Choose an outdoor spot, then use its official page to plan before setting a route.</p></fieldset>
        <fieldset class="trivia-group"><legend>Hydration & posture</legend><label class="switch-row" for="wellness"><span>Gentle check-ins</span><input id="wellness" type="checkbox" role="switch" /><span class="switch-control" aria-hidden="true"></span></label><label class="affirmation-label" for="wellness-interval">Every <select id="wellness-interval"><option value="30">30 minutes</option><option value="45" selected>45 minutes</option><option value="60">60 minutes</option></select></label><p id="wellness-note" class="hint" role="status">Optional check-ins are off.</p></fieldset>
      </section>
      <section id="saved-places-settings" class="settings card" aria-labelledby="saved-places-heading">
        <div class="section-title"><h2 id="saved-places-heading">Saved places</h2><span class="tiny">READY TO GO</span></div>
        <p class="hint">Search for an address to save it for one-tap directions later.</p>
        <div class="saved-place-editors">
            <form class="saved-place-editor" data-place-name="Home"><label for="home-place-search">Home address</label><div class="input-row"><input id="home-place-search" type="search" autocomplete="street-address" placeholder="Search for your home address" /><button type="submit" class="address-search">Search</button></div><div id="home-place-results" class="address-results" aria-live="polite"></div></form>
            <form class="saved-place-editor" data-place-name="Work"><label for="work-place-search">Work address</label><div class="input-row"><input id="work-place-search" type="search" autocomplete="street-address" placeholder="Search for your work address" /><button type="submit" class="address-search">Search</button></div><div id="work-place-results" class="address-results" aria-live="polite"></div></form>
            <form class="saved-place-editor" data-place-name="Favorite"><label for="favorite-place-search">Favorite address</label><div class="input-row"><input id="favorite-place-search" type="search" autocomplete="street-address" placeholder="Search for a favorite place" /><button type="submit" class="address-search">Search</button></div><div id="favorite-place-results" class="address-results" aria-live="polite"></div></form>
        </div>
        <ul id="saved-places" class="custom-phrases" aria-label="Saved places"></ul>
      </section>
      <p class="sidebar-footer">Made for the journey, not just the destination. ♡</p>
    </aside>
    <section class="map-panel" aria-label="Map and route preview">
      <div id="map" aria-label="Interactive route map"></div>
      <div class="map-label"><span class="location-dot"></span><div><strong>Start exploring the University of Utah</strong><span>Search two addresses to plan your route.</span></div></div>
      <div id="map-status" class="map-status" role="status">Your next little journey starts here.</div>
      <section id="journey" class="journey" hidden aria-labelledby="journey-heading">
        <div class="section-title"><div><p class="eyebrow">YOUR JOURNEY</p><h2 id="journey-heading"></h2><p id="journey-eta" class="journey-eta" aria-live="polite"></p></div><span class="small-pill">Route preview</span></div>
        <p class="hint">Step through the route and hear each direction.</p>
        <p id="glare-note" class="hint" role="status" hidden>☀ Sun glare may be likely for this turn — sunglasses on.</p><p id="conditions-note" class="hint" role="status" hidden></p>
        <div class="current-step"><span class="turn-icon">↱</span><div><span id="step-count" class="tiny"></span><p id="instruction"></p></div></div>
        <div class="step-actions"><button type="button" id="previous" class="secondary" aria-label="Previous direction">←</button><button type="button" id="speak" class="primary">▷ Hear this turn</button><button type="button" id="next" class="secondary" aria-label="Next direction">→</button></div>
        <div id="simulation-tools" hidden><div class="simulation-controls"><button type="button" id="simulate" class="secondary">▷ Simulate route</button><label for="simulation-speed">Simulation speed <select id="simulation-speed"><option value="120">120 mph</option><option value="300" selected>300 mph</option><option value="600">600 mph</option><option value="relative-30">Route-relative (30×)</option></select></label></div>
        <p id="simulation-status" class="hint" role="status">Simulation moves through each route instruction with voice guidance.</p></div>
        <div class="journey-actions"><button type="button" id="start-navigation" class="ambient-guidance" disabled>Start Navigation</button><button type="button" id="cancel-route" class="secondary">Cancel route</button></div>
        <details><summary>All directions</summary><ol id="steps"></ol></details>
      </section>
      <span class="map-note">SLOW DOWN. YOU’RE ON YOUR WAY.</span>
    </section>
  </main>
  <section id="voices-panel" class="voice-library" role="tabpanel" aria-labelledby="voices-tab" hidden>
    <div class="library-heading"><div><p class="eyebrow">A LITTLE COMPANY FOR THE ROAD</p><h1>Find your kind <em>of calm.</em></h1><p>Meet your guides. A different voice, the same gentle way home.</p></div><button id="back-to-route" type="button" class="primary settings-return">← Back to my route</button></div>
    <div class="library-section-heading"><h2>Good company comes in a few voices.</h2><p id="library-selection">Choose a little company for the road.</p></div>
    <div id="voice-gallery" class="voice-gallery"><p class="library-empty">Getting your guides ready…</p></div>
    <div class="library-player"><span class="player-symbol" aria-hidden="true">♫</span><div class="library-player-copy"><strong>A little hello, before you go.</strong><p id="library-voice-status" role="status">Preview a voice to find your favorite.</p></div><label for="library-volume" class="volume-label">Volume <input id="library-volume" type="range" min="0" max="1" step="0.05" value="0.7" /></label><button id="library-preview" type="button" class="primary">▷ Preview selected voice</button><button id="library-stop" type="button" class="secondary">Stop preview</button></div>
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

document.querySelector('#app').insertAdjacentHTML('beforeend', `
  <section id="settings-panel" class="settings-page" role="tabpanel" aria-labelledby="settings-tab" hidden>
    <div class="settings-page-heading"><div><p class="eyebrow">YOUR WAY</p><h1>Set up your <em>journey.</em></h1><p>Keep your route, voice, and comfort settings in one calm place.</p></div><button id="settings-back-to-route" type="button" class="primary settings-return">← Back to my route</button></div>
    <div id="settings-content"></div>
  </section>`);

const $ = (selector) => document.querySelector(selector);
const formatArrivalTime = (durationSeconds) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(Date.now() + durationSeconds * 1000));
const destinationName = (label) => label === 'Your GPS location' || label.startsWith('Current location')
  ? 'your current location'
  : label.split(',')[0] || 'your destination';
const status = (message) => { $('#map-status').textContent = message; };
const voiceStatus = (message) => {
  $('#voice-status').textContent = message;
  $('#library-voice-status').textContent = message;
};
const audio = new Audio();
audio.preload = 'none';
audio.volume = 0.7;
const speech = createSpeechService(audio, voiceStatus);
const phraseSettings = createPhraseSettings();
const arrivalPhraseSettings = createPhraseSettings({
  form: '#arrival-phrase-form', input: '#arrival-custom-phrase', list: '#arrival-custom-phrases',
  empty: '#arrival-phrases-empty', count: '#arrival-phrase-count', characters: '#arrival-phrase-characters',
  submit: '#save-arrival-phrase', cancel: '#cancel-arrival-phrase', status: '#arrival-phrase-status',
  storageKey: 'mommy-maps-arrival-phrases',
});
$('#settings-content').append($('#voice-section'), $('#settings'), $('#journey-settings'), $('#saved-places-settings'));
const affirmationStyles = new Set(['neutral', 'girl', 'boy', 'enby']);
let voices = [];
let selectedVoice;
const VOICE_STORAGE_KEY = 'mommy-maps-selected-voice';
const selectedPlaces = { start: null, end: null };
let currentLocation = null;
let route = null;
let stepIndex = 0;
let request;
let map;
let simulationTimer;
let simulationRunning = false;
let locationRequestId = 0;
let locatingCurrentPosition = false;
let currentLocationTarget = 'start';
let drivingLocationWatch;
const suggestionTimers = {};
const suggestionRequests = {};
const savedPlaceSearchRequests = {};
let navigationActive = false;
let triviaMuted = false;
let locationWatcher;
let lastPosition;
const ambientTrivia = createAmbientTrivia();
let savedPlaces = loadSavedPlaces();
const wellnessReminder = createReminder();

function populateOutdoorLists() {
  const fill = (selector, items) => $(selector).append(...items.map((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    return option;
  }));
  fill('#utah-parks', utahStateParks);
  fill('#utah-trails', utahTrails);
  for (const selector of ['#utah-parks', '#utah-trails']) $(selector).addEventListener('change', (event) => {
    if (!event.target.value) return;
    const link = document.createElement('a');
    link.href = 'https://stateparks.utah.gov/';
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Open official Utah State Parks site';
    $('#outdoor-note').replaceChildren(`Selected: ${event.target.value}. `, link);
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector(`input[name="theme"][value="${theme}"]`).checked = true;
  map?.setRouteTheme(theme);
  try { localStorage.setItem('mommy-maps-theme', theme); } catch { /* Theme still applies for this visit. */ }
}

try {
  const savedTheme = localStorage.getItem('mommy-maps-theme');
  if (savedTheme === 'light' || savedTheme === 'pink' || savedTheme === 'verity' || savedTheme === 'dark') setTheme(savedTheme);
} catch { /* Storage may be unavailable in privacy-focused browsers. */ }

try {
  const savedAffirmation = localStorage.getItem('mommy-maps-affirmation');
  if (affirmationStyles.has(savedAffirmation)) $('#affirmation-style').value = savedAffirmation;
} catch { /* The default neutral setting works without local storage. */ }

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
  $('.topbar').classList.toggle('map-mode', name === 'journey');
  $('#journey-panel').classList.toggle('compact-journey', name === 'journey');
  if (name === 'voices' && simulationRunning) stopSimulation('Simulation paused while you browse voices.');
  if (name === 'journey') requestAnimationFrame(() => map?.resize());
});
$('#browse-voices').addEventListener('click', () => activateTab('voices', { focus: true }));
$('#open-voices').addEventListener('click', () => activateTab('voices', { focus: true }));
$('#open-settings').addEventListener('click', () => activateTab('settings', { focus: true }));
$('#back-to-route').addEventListener('click', () => activateTab('journey', { focus: true }));
$('#settings-back-to-route').addEventListener('click', () => activateTab('journey', { focus: true }));
const voicePicker = createVoicePicker({
  select: $('#voice-select'), summary: $('#voice-summary'), gallery: $('#voice-gallery'),
  selection: $('#library-selection'), onSelect: selectVoice,
  onPreview: previewVoice,
});
function previewVoice(voice) {
  if (!voice?.configured) return voiceStatus('Choose a voice that is ready to play first.');
  speech.speak(voice.sample, voice.id);
}
function selectVoice(id) {
  const voice = voices.find((item) => item.id === id);
  if (!voice) return;
  selectedVoice = id;
  try { localStorage.setItem(VOICE_STORAGE_KEY, id); } catch { /* The current selection still works for this visit. */ }
  $('#intro-voice-name').textContent = voice.name?.trim() || 'your chosen voice';
  const portrait = voicePortrait(voice, voices.indexOf(voice));
  $('#header-voice-portrait').src = portrait.src;
  $('#header-voice-portrait').alt = portrait.alt;
  const isVerity = voice.id === 'verity';
  $('#brand-name').textContent = isVerity ? 'VERITY maps' : 'mommy maps';
  $('.brand').setAttribute('aria-label', isVerity ? 'Verity Maps home' : 'Mommy Maps home');
  document.title = isVerity ? 'Verity Maps' : 'Mommy Maps';
  $('#selected-voice-name').textContent = voice.name?.trim() || 'Your selected guide';
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

function stopDrivingFollow() {
  if (drivingLocationWatch !== undefined) navigator.geolocation?.clearWatch(drivingLocationWatch);
  drivingLocationWatch = undefined;
  map?.clearLiveLocation();
}

function startDrivingFollow() {
  stopDrivingFollow();
  if (!navigator.geolocation) return;
  drivingLocationWatch = navigator.geolocation.watchPosition(({ coords }) => {
    const point = currentLocationPlace(coords);
    currentLocation = point;
    map?.setLiveLocation(point);
    if (!simulationRunning) map?.follow(point, 17);
  }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
}

function simulationDuration(step) {
  const speed = $('#simulation-speed').value;
  if (speed === 'relative-30') return Math.max(600, (step.duration || 0) * 1000 / 30);
  const mph = Number(speed);
  const metersPerMillisecond = mph * 1609.344 / 3_600_000;
  return Math.max(600, (step.distance || 0) / metersPerMillisecond);
}

function simulationSpeedLabel() {
  return $('#simulation-speed').value === 'relative-30' ? 'route-relative 30× speed' : $('#simulation-speed').value + ' mph';
}

function playSimulationStep() {
  const step = route.steps[stepIndex];
  showStep({ focus: false });
  let duration = simulationDuration(step);
  if (step.geometry?.coordinates?.length > 1) {
    duration = map?.animateSimulationPath(step.geometry.coordinates, { mph: Number($('#simulation-speed').value), duration }) ?? duration;
  } else if (step.maneuver.location) {
    const [lng, lat] = step.maneuver.location;
    map?.setSimulationPoint({ lat, lng });
  }
  const voice = voices.find((item) => item.id === selectedVoice);
  const speechDone = voice?.configured
    ? speech.speak(spokenInstructionForStep(step), selectedVoice, { ...speechOptionsForStep(step), waitForPlayback: true })
    : Promise.resolve();
  $('#simulation-status').textContent = `Simulating direction ${stepIndex + 1} of ${route.steps.length} at ${simulationSpeedLabel()}.`;
  return { duration, speechDone };
}

async function runSimulationStep() {
  if (!simulationRunning || !route) return;
  const { duration, speechDone } = playSimulationStep();
  await Promise.all([speechDone, new Promise((resolve) => { simulationTimer = setTimeout(resolve, duration); })]);
  if (!simulationRunning || !route) return;
  if (stepIndex >= route.steps.length - 1) return stopSimulation('Simulation complete. You’ve arrived.');
  stepIndex += 1;
  runSimulationStep();
}

function speechOptionsForStep(step) {
  if (step.maneuver?.type === 'arrive') {
    return { arrivalPhrase: true, customArrivalPhrases: arrivalPhraseSettings.getPhrases() };
  }
  return { afterTurnPhrase: true, customAfterTurnPhrases: phraseSettings.getPhrases(), affirmation: $('#affirmation-style').value };
}

function spokenInstructionForStep(step) {
  if (step.maneuver?.type !== 'arrive') return step.instruction;
  return nationalParkPromptFor(selectedPlaces.end)?.arrival || step.instruction;
}

function invalidateRoute() {
  stopSimulation();
  stopDrivingFollow();
  request?.abort();
  request = null;
  route = null;
  speech.stop();
  map?.clearRoute();
  $('#journey').hidden = true;
  $('#plan').disabled = false;
  $('#plan').innerHTML = 'Show my route on the map <span>↗</span>';
  stopNavigation();
  $('#start-navigation').disabled = true;
  $('#conditions-note').hidden = true;
  $('#glare-note').hidden = true;
}

function stopNavigation() {
  navigationActive = false;
  stopDrivingFollow();
  if (locationWatcher !== undefined) navigator.geolocation?.clearWatch(locationWatcher);
  locationWatcher = undefined;
  ambientTrivia.reset();
  $('#start-navigation').textContent = 'Start Navigation';
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

async function loadConditions(start, end, plannedRoute) {
  const note = $('#conditions-note');
  note.hidden = true;
  try {
    const [conditionsResponse, airResponse] = await Promise.all([
      fetch('/api/conditions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geometry: plannedRoute.geometry, destinationId: destinationName(end.label).replace(/\s+/g, '') }) }),
      fetch('/api/air-quality', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ start, end }) }),
    ]);
    const conditions = conditionsResponse.ok ? await conditionsResponse.json() : null;
    const air = airResponse.ok ? await airResponse.json() : null;
    const messages = [];
    if (conditions?.configured && conditions.alerts?.length) messages.push(`${conditions.alerts.length} UDOT update${conditions.alerts.length === 1 ? '' : 's'} nearby: ${conditions.alerts[0].description}`);
    const reading = air?.destination || air?.start;
    if (air?.configured && reading) messages.push(`Air quality: AQI ${reading.aqi} (${reading.category}).`);
    if (messages.length) { note.textContent = messages.join(' '); note.hidden = false; }
  } catch { /* Conditions are optional and must never interrupt routing. */ }
}

function showStep({ focus = true } = {}) {
  const step = route.steps[stepIndex];
  $('#step-count').textContent = `DIRECTION ${stepIndex + 1} OF ${route.steps.length} · ${formatDistance(step.distance)}`;
  $('#instruction').textContent = step.instruction;
  $('#previous').disabled = stepIndex === 0;
  $('#next').disabled = stepIndex === route.steps.length - 1;
  $('#speak').disabled = !voices.find((voice) => voice.id === selectedVoice)?.configured;
  $('#glare-note').hidden = !step.glare;
  if (focus && step.maneuver.location) {
    const [lng, lat] = step.maneuver.location;
    map?.focus({ lat, lng });
  }
}

function renderSavedPlaces() {
  const list = $('#saved-places');
  list.replaceChildren(...savedPlaces.map((place) => {
    const item = document.createElement('li');
    item.className = 'saved-place-item';
    const use = document.createElement('button'); use.type = 'button'; use.className = 'text-button saved-place-use'; use.textContent = `Use ${place.name}: ${place.label}`;
    use.addEventListener('click', () => selectPlace('end', place));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-button saved-place-remove'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove saved ${place.name}`);
    remove.addEventListener('click', () => { savedPlaces = removePlace(savedPlaces, place.id); saveSavedPlaces(savedPlaces); renderSavedPlaces(); });
    item.append(use, remove); return item;
  }));
  if (!savedPlaces.length) { const item = document.createElement('li'); item.textContent = 'No saved places yet.'; list.append(item); }
  for (const [id, name] of [['go-home', 'Home'], ['go-work', 'Work'], ['go-favorite', 'Favorite']]) {
    const place = savedPlaces.find((item) => item.id === name.toLowerCase());
    const button = $('#' + id);
    button.classList.toggle('is-unset', !place);
    button.textContent = place ? name : `Set ${name}`;
    button.title = place ? `Set destination to ${place.label}` : `Save the selected destination as ${name}.`;
  }
}
function savePlace(name, place) {
  savedPlaces = upsertPlace(savedPlaces, { ...place, id: name.toLowerCase(), name });
  saveSavedPlaces(savedPlaces);
  renderSavedPlaces();
  status(`${name} saved for your next trip.`);
}

function renderSavedPlaceResults(name, results, origin) {
  const id = name.toLowerCase();
  const target = $('#' + id + '-place-results');
  const note = document.createElement('p');
  note.className = 'address-results-note';
  note.id = id + '-place-results-note';
  note.textContent = origin ? `Nearest matches · Straight-line distance from ${origin.label}.` : 'Choose the address you’d like to save.';
  const list = document.createElement('ul');
  list.className = 'address-result-list';
  for (const place of results) {
    const item = document.createElement('li');
    const choose = document.createElement('button');
    choose.type = 'button';
    choose.setAttribute('aria-describedby', note.id);
    const label = document.createElement('span');
    label.className = 'address-result-label';
    label.textContent = place.label;
    choose.append(label);
    if (origin && Number.isFinite(place.distanceMeters)) {
      const distance = document.createElement('span');
      distance.className = 'address-result-distance';
      distance.textContent = formatDistance(place.distanceMeters) + ' away';
      choose.append(distance);
    }
    choose.addEventListener('click', () => {
      savePlace(name, place);
      $('#' + id + '-place-search').value = place.label;
      target.replaceChildren();
    });
    item.append(choose);
    list.append(item);
  }
  target.replaceChildren(note, list);
}

async function searchSavedPlace(name) {
  const id = name.toLowerCase();
  const input = $('#' + id + '-place-search');
  const query = input.value.trim();
  if (!query) return status(`Enter a ${name.toLowerCase()} address first.`);
  savedPlaceSearchRequests[id]?.abort();
  const controller = new AbortController();
  savedPlaceSearchRequests[id] = controller;
  const button = document.querySelector(`[data-place-name="${name}"] button[type="submit"]`);
  button.disabled = true;
  status(`Searching for your ${name.toLowerCase()} address…`);
  try {
    const origin = addressSearchOrigin('start', null, currentLocation);
    const { results } = await searchAddresses(query, { origin, signal: controller.signal });
    if (controller.signal.aborted || savedPlaceSearchRequests[id] !== controller || input.value.trim() !== query) return;
    renderSavedPlaceResults(name, results, origin);
    status(`Choose the ${name.toLowerCase()} address that looks right.`);
  } catch (error) {
    if (!controller.signal.aborted && savedPlaceSearchRequests[id] === controller) status(error.message);
  } finally {
    if (savedPlaceSearchRequests[id] === controller) {
      savedPlaceSearchRequests[id] = null;
      button.disabled = false;
    }
  }
}

for (const form of document.querySelectorAll('.saved-place-editor')) form.addEventListener('submit', (event) => {
  event.preventDefault();
  searchSavedPlace(form.dataset.placeName);
});
for (const [id, name] of [['go-home', 'Home'], ['go-work', 'Work'], ['go-favorite', 'Favorite']]) $('#' + id).addEventListener('click', () => {
  const place = savedPlaces.find((item) => item.id === name.toLowerCase());
  if (!place) {
    const destination = selectedPlaces.end;
    if (!destination) return status(`Choose a destination from the search results, then tap Set ${name}.`);
    return savePlace(name, destination);
  }
  selectPlace('end', place);
  status(`${name} is set as your destination.`);
});
renderSavedPlaces();

try {
  map = createMap($('#map'));
  map.addLandmarkMarkers(selectMapDestination);
} catch (error) { status(error.message); }

function locationErrorMessage(error) {
  if (error?.code === 1) return 'GPS permission is off. Allow location access in your browser, then use the location button to try again.';
  if (error?.code === 2) return 'GPS could not find a position right now. Check your connection and try the location button again.';
  if (error?.code === 3) return 'GPS took too long to respond. Try the location button again or enter a starting address.';
  return 'Your location is unavailable. Enter a starting address or try the location button again.';
}

function currentLocationPlace(coords) {
  const lat = coords.latitude;
  const lng = coords.longitude;
  return { lat, lng, label: `Current location · ${lat.toFixed(5)}, ${lng.toFixed(5)}`, isCurrentLocation: true };
}

function useCurrentLocation({ userInitiated = false } = {}) {
  const input = $('#start');
  const locate = $('#locate');
  const requestId = ++locationRequestId;
  locatingCurrentPosition = true;
  currentLocationTarget = 'start';
  resetAddressSearch('start');
  invalidateRoute();
  selectedPlaces.start = null;
  if (!navigator.geolocation) {
    locatingCurrentPosition = false;
    if (input.value.startsWith('Finding your')) input.value = '';
    return status('GPS is not available in this browser. Enter a starting address instead.');
  }
  if (window.isSecureContext === false) {
    locatingCurrentPosition = false;
    if (input.value.startsWith('Finding your')) input.value = '';
    return status('GPS requires HTTPS (or localhost). Open this app securely, then try again.');
  }
  input.value = 'Finding your GPS location…';
  locate.disabled = true;
  status(userInitiated ? 'Checking your GPS location…' : 'Finding your GPS location…');
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    if (requestId !== locationRequestId) return;
    locate.disabled = false;
    locatingCurrentPosition = false;
    if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
      input.value = '';
      return status('GPS returned an invalid position. Try again or enter a starting address.');
    }
    const place = currentLocationPlace(coords);
    const target = currentLocationTarget;
    currentLocation = place;
    selectedPlaces[target] = place;
    $('#' + target).value = place.label;
    if (target === 'end') updateClearDestination();
    map?.setPoint(target, place);
    map?.setLiveLocation(place);
    map?.focus(place);
    status(target === 'start'
      ? 'Starting from your GPS location. Search for a destination to begin.'
      : 'Your current location is set as the destination.');
    refreshSuggestions(target === 'start' ? ['end'] : ['start']);
  }, (error) => {
    if (requestId !== locationRequestId) return;
    locate.disabled = false;
    locatingCurrentPosition = false;
    $('#' + currentLocationTarget).value = '';
    if (currentLocationTarget === 'end') updateClearDestination();
    status(locationErrorMessage(error));
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
}
$('#locate').addEventListener('click', () => useCurrentLocation({ userInitiated: true }));
useCurrentLocation();

function resetAddressSearch(kind) {
  clearTimeout(suggestionTimers[kind]);
  suggestionRequests[kind]?.abort();
  suggestionRequests[kind] = null;
  document.querySelector('[data-search="' + kind + '"]').disabled = false;
  $('#' + kind + '-results').replaceChildren();
}

function renderAddressResults(kind, results, origin, message) {
  const note = document.createElement('p');
  note.className = 'address-results-note';
  note.id = kind + '-results-note';
  note.textContent = origin
    ? 'Nearest matches · Straight-line distance from ' + origin.label + '.'
    : kind === 'end' ? 'Choose a starting address to see nearby matches and distances.'
      : 'Allow location access to see nearby starting addresses and distances.';
  const list = document.createElement('ul');
  list.className = 'address-result-list';
  for (const place of results) {
    const item = document.createElement('li');
    const choose = document.createElement('button');
    choose.type = 'button';
    choose.setAttribute('aria-describedby', note.id);
    const label = document.createElement('span');
    label.className = 'address-result-label';
    label.textContent = place.label;
    choose.append(label);
    if (origin && Number.isFinite(place.distanceMeters)) {
      const distance = document.createElement('span');
      distance.className = 'address-result-distance';
      distance.textContent = formatDistance(place.distanceMeters) + ' away';
      choose.append(distance);
    }
    choose.addEventListener('click', () => selectPlace(kind, place));
    item.append(choose);
    list.append(item);
  }
  $('#' + kind + '-results').replaceChildren(note, list);
  if (message) status(message);
}

function selectPlace(kind, place) {
  invalidateRoute();
  selectedPlaces[kind] = place;
  $('#' + kind).value = place.label;
  if (kind === 'end') updateClearDestination();
  resetAddressSearch(kind);
  map?.setPoint(kind, place);
  map?.focus(place);
  if (kind === 'start') refreshSuggestions(['end']);
  status((kind === 'start' ? 'Starting address' : 'Destination') + ' selected. Search the other address or find your route.');
}

function selectMapDestination(place) {
  selectPlace('end', place);
  if (selectedPlaces.start) {
    $('#route-form').requestSubmit();
  } else {
    $('#route-form').classList.remove('collapsed');
    $('#edit-route').hidden = true;
    status(`${place.name} is selected. Choose a starting address to plan your route.`);
  }
}

function selectedMapCategories() {
  return [...document.querySelectorAll('#map-category-filter input:checked')].map((input) => input.value);
}

$('#map-category-filter').addEventListener('change', () => {
  const categories = new Set(selectedMapCategories());
  map?.addLandmarkMarkers(selectMapDestination, categories);
  for (const kind of ['start', 'end']) if ($('#' + kind).value.trim()) scheduleSuggestions(kind);
});

async function searchAddress(kind, automatic = false) {
  const input = $('#' + kind);
  const query = input.value.trim();
  if (!query) throw new Error('Enter a ' + (kind === 'start' ? 'starting address' : 'destination') + ' first.');
  if (kind === 'start' && (locatingCurrentPosition || (selectedPlaces.start?.isCurrentLocation && query === selectedPlaces.start.label))) {
    resetAddressSearch('start');
    if (!automatic) status('Your GPS location is already set as the starting point. Search for a destination to continue.');
    return;
  }
  resetAddressSearch(kind);
  const controller = new AbortController();
  suggestionRequests[kind] = controller;
  const signal = request ? AbortSignal.any([controller.signal, request.signal]) : controller.signal;
  const origin = addressSearchOrigin(kind, selectedPlaces.start, currentLocation);
  const button = document.querySelector('[data-search="' + kind + '"]');
  button.disabled = true;
  if (!automatic) status('Searching for your ' + (kind === 'start' ? 'starting address' : 'destination') + '…');
  try {
    const { results } = await searchAddresses(query, { origin, categories: selectedMapCategories(), signal });
    if (signal.aborted || suggestionRequests[kind] !== controller || input.value.trim() !== query) return;
    renderAddressResults(kind, results, origin, automatic ? null
      : 'Choose the ' + (kind === 'start' ? 'starting address' : 'destination') + ' that looks right.');
  } catch (error) {
    if (signal.aborted || suggestionRequests[kind] !== controller) return;
    if (!automatic) throw error;
    const note = document.createElement('p');
    note.className = 'address-results-note';
    note.textContent = error.message;
    $('#' + kind + '-results').replaceChildren(note);
  } finally {
    if (suggestionRequests[kind] === controller) {
      suggestionRequests[kind] = null;
      button.disabled = false;
    }
  }
}

function scheduleSuggestions(kind) {
  resetAddressSearch(kind);
  if (kind === 'start' && (locatingCurrentPosition || selectedPlaces.start?.isCurrentLocation)) return;
  if ($('#' + kind).value.trim().length < 3) return;
  suggestionTimers[kind] = setTimeout(() => searchAddress(kind, true), 350);
}

function refreshSuggestions(kinds = ['start', 'end']) {
  for (const kind of kinds) {
    if (!selectedPlaces[kind] || suggestionRequests[kind] || $('#' + kind + '-results').childElementCount) {
      scheduleSuggestions(kind);
    }
  }
}

for (const kind of ['start', 'end']) $('#' + kind).addEventListener('input', () => {
  if (kind === 'start') {
    locationRequestId += 1;
    locatingCurrentPosition = false;
    $('#locate').disabled = false;
  }
  invalidateRoute();
  const changedOrigin = kind === 'start' && selectedPlaces.start !== null;
  selectedPlaces[kind] = null;
  if (kind === 'end') updateClearDestination();
  status('Your addresses changed. Search for a new route when you’re ready.');
  scheduleSuggestions(kind);
  if (changedOrigin) refreshSuggestions(['end']);
});

document.querySelectorAll('[data-search]').forEach((button) => button.addEventListener('click', async () => {
  try { await searchAddress(button.dataset.search); }
  catch (error) { if (error.name !== 'AbortError') status(error.message); }
}));

$('#swap').addEventListener('click', () => {
  invalidateRoute();
  const start = $('#start').value;
  const startWasCurrentLocation = selectedPlaces.start?.isCurrentLocation;
  const startWasLocating = locatingCurrentPosition;
  $('#start').value = $('#end').value;
  [selectedPlaces.start, selectedPlaces.end] = [selectedPlaces.end, selectedPlaces.start];
  if (startWasCurrentLocation && currentLocation) {
    selectedPlaces.end = currentLocation;
    $('#end').value = currentLocation.label;
  } else $('#end').value = start;
  if (startWasLocating) currentLocationTarget = 'end';
  updateClearDestination();
  resetAddressSearch('start');
  resetAddressSearch('end');
  refreshSuggestions();
  status('Swapped. Let’s find the way back.');
});

function updateClearDestination() {
  $('#clear-end').hidden = !$('#end').value.trim();
}

$('#clear-end').addEventListener('click', () => {
  invalidateRoute();
  selectedPlaces.end = null;
  $('#end').value = '';
  resetAddressSearch('end');
  updateClearDestination();
  $('#end').focus();
  status('Destination cleared. Choose where you’d like to go.');
});
updateClearDestination();

$('#edit-route').addEventListener('click', () => {
  $('#route-form').classList.remove('collapsed');
  $('#edit-route').hidden = true;
  $('#end').focus();
});

$('#cancel-route').addEventListener('click', () => {
  invalidateRoute();
  $('#route-form').classList.remove('collapsed');
  $('#edit-route').hidden = true;
  $('#end').focus();
  status("Route cancelled. Update your addresses whenever you're ready.");
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
    const avoid = [...document.querySelectorAll('[data-avoid]:checked')].map((input) => input.dataset.avoid);
    const result = await getRoute(start, end, { signal: AbortSignal.any([current.signal, AbortSignal.timeout(20000)]), avoid });
    if (request !== current) return;
    if (!result.steps.length) throw new Error('No directions returned. Try different points.');
    route = result;
    for (const step of route.steps) {
      const location = step.maneuver?.location;
      const next = step.geometry?.coordinates?.at(-1);
      if (location && next) step.glare = sunGlare({ lat: location[1], lng: location[0] }, { lat: next[1], lng: next[0] }, Date.now()).glare;
    }
    stepIndex = 0;
    const estimatedDuration = formatDuration(route.duration);
    const arrivalTime = formatArrivalTime(route.duration);
    $('#journey-heading').textContent = `${estimatedDuration} · ${formatDistance(route.distance)}`;
    $('#journey-eta').textContent = `Estimated arrival: ${arrivalTime}`;
    $('#steps').replaceChildren(...route.steps.map((step) => {
      const item = document.createElement('li');
      item.textContent = `${step.instruction} (${formatDistance(step.distance)})`;
      return item;
    }));
    $('#journey').hidden = false;
    $('#route-form').classList.add('collapsed');
    $('#edit-route').hidden = false;
    $('#start-navigation').disabled = false;
    showStep();
    map?.drawRoute(route.geometry, document.documentElement.dataset.theme);
    loadConditions(start, end, route);
    if (window.matchMedia('(max-width: 760px)').matches) {
      requestAnimationFrame(() => $('#journey').scrollIntoView({ behavior: 'smooth', block: 'end' }));
    }
    $('#ambient-note').textContent = 'Route preview ready. Start navigation when you’re ready to begin guidance.';
    status(`Your route preview is ready. ${estimatedDuration} to ${destinationName(end.label)}. Select Start Navigation when you’re ready.`);
  } catch (error) {
    if (request === current && error.name !== 'AbortError') status(error.name === 'TimeoutError' ? 'Routing took too long. Please try again.' : error.message);
  } finally {
    if (request === current) {
      $('#plan').disabled = false;
      $('#plan').innerHTML = 'Show my route on the map <span>↗</span>';
    }
  }
});

$('#simulate').addEventListener('click', () => {
  if (!route) return;
  if (simulationRunning) return stopSimulation('Simulation paused.');
  if (stepIndex >= route.steps.length - 1) {
    stepIndex = 0;
  }
  simulationRunning = true;
  $('#simulate').textContent = 'Ⅱ Pause simulation';
  runSimulationStep();
});
for (const [id, delta] of [['previous', -1], ['next', 1]]) $(`#${id}`).addEventListener('click', () => {
  if (!route) return;
  stopSimulation();
  speech.stop();
  stepIndex = Math.max(0, Math.min(route.steps.length - 1, stepIndex + delta));
  showStep();
});
$('#speak').addEventListener('click', () => {
  if (route) {
    const step = route.steps[stepIndex];
    speech.speak(spokenInstructionForStep(step), selectedVoice, speechOptionsForStep(step));
  }
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
$('#library-preview').addEventListener('click', () => previewVoice(voices.find((item) => item.id === selectedVoice)));
$('#retry-voices').addEventListener('click', loadVoices);
$('#start-navigation').addEventListener('click', () => {
  if (!route) return;
  if (navigationActive) {
    stopNavigation();
    speech.stop();
    $('#ambient-note').textContent = 'Navigation paused. Your route preview is still on the map.';
    status('Navigation paused. Select Start Navigation when you’re ready to continue.');
    return;
  }
  navigationActive = true;
  $('#start-navigation').textContent = 'Stop Navigation';
  startDrivingFollow();
  $('#ambient-note').textContent = 'Watching for a calm stretch of road. Trivia begins after five minutes above 45 mph with no maneuver within five miles.';
  locationWatcher = navigator.geolocation?.watchPosition((position) => { lastPosition = position; considerAmbientTrivia(position); }, () => {
    stopNavigation();
    $('#ambient-note').textContent = 'We couldn’t read your live location, so ambient guidance is paused.';
  }, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 });
  const voice = voices.find((item) => item.id === selectedVoice);
  const end = selectedPlaces.end;
  if (voice?.configured && end) {
    const parkPrompt = nationalParkPromptFor(end);
    const startMessage = parkPrompt?.start
      || `Navigation started. Your route to ${destinationName(end.label)} will take about ${formatDuration(route.duration)}. You should arrive around ${formatArrivalTime(route.duration)}. Let's get going.`;
    speech.speak(startMessage, selectedVoice);
  }
  status('Navigation started. Follow the route when you’re ready.');
});
setInterval(() => { if (lastPosition) considerAmbientTrivia(lastPosition); }, 60_000);
setInterval(() => {
  const enabled = $('#wellness').checked;
  const minutes = Number($('#wellness-interval').value);
  if (!wellnessReminder.due(minutes, enabled)) return;
  const message = 'Quick check-in: relax your shoulders, take a sip of water, and keep your eyes on the road.';
  $('#wellness-note').textContent = message;
  if (voices.find((voice) => voice.id === selectedVoice)?.configured) speech.speak(message, selectedVoice);
}, 60_000);
$('#wellness').addEventListener('change', () => {
  wellnessReminder.reset();
  $('#wellness-note').textContent = $('#wellness').checked ? 'Gentle check-ins will start while this page is open.' : 'Optional check-ins are off.';
});
$('#mute-trivia').addEventListener('change', () => {
  triviaMuted = $('#mute-trivia').checked;
  if (triviaMuted) speech.stop();
  $('#ambient-note').textContent = triviaMuted ? 'Roadside trivia is muted.' : 'Roadside trivia is ready when you start ambient guidance.';
});
document.querySelectorAll('[data-avoid]').forEach((input) => input.addEventListener('change', () => {
  if (route) status('Navigation preferences changed. Find a new route to apply them.');
}));
$('#affirmation-style').addEventListener('change', () => {
  try { localStorage.setItem('mommy-maps-affirmation', $('#affirmation-style').value); } catch { /* The choice remains active for this visit. */ }
  status('After-turn encouragement updated.');
});
document.querySelectorAll('input[name="theme"]').forEach((input) => input.addEventListener('change', () => {
  if (input.checked) setTheme(input.value);
}));

async function loadVoices() {
  $('#retry-voices').disabled = true;
  $('#intro-voice-name').textContent = 'your chosen voice';
  try {
    voices = await speech.voices();
    let savedVoice;
    try { savedVoice = localStorage.getItem(VOICE_STORAGE_KEY); } catch { /* A configured voice remains a safe fallback. */ }
    selectedVoice = voices.find((voice) => voice.id === savedVoice)?.id
      || voices.find((voice) => voice.id === selectedVoice)?.id
      || voices.find((voice) => voice.configured)?.id
      || voices[0]?.id;
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
populateOutdoorLists();
window.addEventListener('pagehide', () => {
  stopSimulation();
  stopDrivingFollow();
  speech.stop();
  request?.abort();
  resetAddressSearch('start');
  resetAddressSearch('end');
  stopNavigation();
});
