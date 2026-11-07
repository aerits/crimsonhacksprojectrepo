# Mommy Maps

A JavaScript maps app with comforting mommy ASMR navigation voices. This first scaffold searches addresses, plans driving routes, and lets you preview each direction with server-generated Fish Audio speech.

## Run

Requires Node.js 22.9 or newer. There are no npm dependencies to install.

```sh
cp config.local.example.json config.local.json
# Add your Fish Audio API key to config.local.json.
npm run dev
```

Open http://127.0.0.1:3000. The app requests your browser location for the starting point and leaves the destination empty. Type any other starting address or a destination to see suggestions before using the Search buttons, then select a result and use the arrows and **Hear this turn** to preview the route. Audio plays directly from the voice controls.

Run `npm run dev:simulate` to expose **Simulate route** in the route preview. It automatically advances through each turn and plays the selected voice’s route guidance. A pink marker moves smoothly along each route segment to show the simulated location. Choose a relaxed, normal, or quick pace. Each simulated direction sends a Fish Audio TTS request and may consume provider credit. The controls stay hidden under `npm start` and `npm run dev`.

Choose your navigation voice from the dropdown on **Your journey**. Open **Voice library** to compare each voice’s mood and sample phrase, preview configured voices, or select a voice for the route. Selection and listening volume stay in sync across both tabs. Switching to the library pauses an active simulation; returning keeps your addresses and route. Tabs support the arrow, Home, and End keys.

The map and routing work without Fish credentials. Voices show **Setup needed** until configured. `npm start` runs without file watching. `npm test` runs the Node test suite.

## Developer TTS testing

Open **Developer: test TTS** at the bottom of **Voice library**, enter up to 600 characters, choose a configured voice, and select **Generate with selected voice**. It uses the production `/api/tts` endpoint, so each test is a Fish Audio request and may consume provider credit.

## Voices and server-side TTS

```text
Browser → POST /api/tts { text, voiceId }
Node server → Fish Audio /v1/tts with server-only API key + reference_id
Fish Audio → MP3 bytes → Node server → browser playback
```

`config.json` is the committed default configuration: host, port, Fish model, and six public voice IDs. The first Mommy voice is the highest-use nurturing/ASMR result in the public Fish Audio catalog at the time of configuration. Put the Fish API key in the ignored `config.local.json`; its nested values override `config.json` at startup. Each voice slot can use a different voice.

`voice-phrases.json` contains 24 built-in after-turn phrases. Open **User settings → After-turn phrases** to add, edit, or remove up to 20 personal phrases, each up to 160 characters. Changes save automatically in this browser; if storage is unavailable, they remain usable for the current visit. Blank phrases and duplicates are rejected.

Whenever navigation or the simulator speaks a direction, the server randomly selects one phrase from the built-in and personal collections and appends it after the instruction. Changes apply to the next spoken direction. Custom phrases are sent with that request, validated on the server, and never added to the shared preset list. Only the selected phrase is sent to Fish Audio with the direction. Voice previews and developer TTS tests use only their entered text.

The default synthesis model is `s2.1-pro`; change `fish.model` in `config.json` if your account or voices need another compatible S2 model. The server adds soft delivery cues and a slower speaking speed. Actual voice quality depends on the reference voice and Fish model. Preview each voice before using it.

Add further voices in `server/voices.js`, referencing a new entry under `fish.voices` in the configuration. The client discovers them from `GET /api/voices`. API keys and provider IDs stay on the server. The app makes a paid provider request only when you press a speech button; the client plays the resulting audio directly. Text is sent to Fish Audio for synthesis.

## Address search

Address suggestions appear after three characters through the server’s `/api/geocode` endpoint, which uses Photon’s search-as-you-type geocoder. The **Search** buttons are also available to repeat a lookup. Select the intended match before submitting a route.

When a location is known, the app asks Photon for nearby matches, sorts them by straight-line distance, and shows the closest five with a distance badge beside the full address. Destination searches use the selected starting point, falling back to browser location. Starting-address searches use browser location. The caption identifies the reference point; these distances are estimates, not driving distances. Changing the start refreshes open destination suggestions, and stale searches are canceled when you type, select, or swap addresses.

If location access is unavailable, address search still works without distance badges. Select a starting address to enable nearby destination results. Address text and the reference coordinates (when available) are sent to Photon. The server caches results separately for each query and reference point, retaining up to 200 searches. Use a production geocoding provider before deploying at scale.

Speech requests accept up to 600 instruction characters plus 20 custom phrases of up to 160 characters each, with a 32 KB request body limit. Synthesis is limited to two concurrent synthesis jobs, a 60-second provider timeout, and 8 MB per audio response. Stopping audio or changing the route aborts the client request and asks the server to cancel its upstream request. Cancellation may happen after provider work has begun. Generated audio is held in memory for the response and not written to disk. There is no browser speech synthesis fallback.

## Structure

```text
index.html                 Browser entry; pinned Leaflet CDN assets
server/
  index.js                 Node HTTP server startup
  app.js                   Static app + voice API + Fish Audio integration
  voices.js                Voice registry and delivery settings
src/
  main.js                  Route planner, voice picker and preview controls
  style.css                Responsive lavender-and-pink app layout
  ui/tabs.js               Keyboard-accessible journey / library tabs
  ui/voices.js             Synchronized voice dropdown and voice library
  ui/phrases.js            Custom after-turn phrase editor
  services/phrase-preferences.js  Browser-local phrase storage
  utils/phrases.js          Shared custom phrase limits and validation
  services/map.js          Leaflet map, points and route rendering
  services/routing.js      OSRM driving route adapter
  services/speech.js       Fetch generated audio, cancel and play
  utils/directions.js      Coordinates, maneuver text and formatting
  utils/location.js        Search reference points and straight-line distance
tests/                     Routing and HTTP API tests with mocked Fish responses
```

## Prototype boundaries

This is a route planner and manual spoken route preview. It does not track driving progress, reroute automatically, provide traffic data, or issue background navigation prompts. Current location sets the starting point and helps rank address suggestions. Those features can build on the route and speech services.

Leaflet loads from a CDN, map tiles come from OpenStreetMap, addresses are searched with Photon, and routes come from the public OSRM demo service; internet access is required. Use production map, geocoding, and routing providers before deploying for sustained usage. Resolved coordinates are sent to OSRM when planning a route. The server binds to localhost by default. Add authentication and per-user rate limits before exposing the paid TTS endpoint publicly. This scaffold has no deployment configuration.

## References

- [Fish Audio text-to-speech API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Fish Audio delivery and emotion cues](https://docs.fish.audio/developer-guide/core-features/emotions)
- [OSRM HTTP API](https://project-osrm.org/docs/v26.6.1/http.html)
- [Photon search API and location bias](https://github.com/komoot/photon/blob/master/docs/api-v1.md)
- [Leaflet quick start](https://leafletjs.com/examples/quick-start/)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
