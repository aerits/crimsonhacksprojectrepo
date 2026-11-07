# Mommy Maps

A JavaScript maps app with comforting mommy ASMR navigation voices. This first scaffold searches addresses, plans driving routes, and lets you preview each direction with server-generated Fish Audio speech.

## Run

Requires Node.js 22.9 or newer. There are no npm dependencies to install.

```sh
cp config.local.example.json config.local.json
# Add your Fish Audio API key to config.local.json.
npm run dev
```

Open http://127.0.0.1:3000. The map starts at the University of Utah. Search for a starting address and destination, select a result for each, then use the arrows and **Hear this turn** to preview the route. Audio plays directly from the voice controls.

Use **Simulate route** in the route preview to automatically advance through each turn, focus the map on the current maneuver, and play the selected voice’s route guidance. A pink marker shows the simulated location. Choose a relaxed, normal, or quick pace. Each simulated direction sends a Fish Audio TTS request and may consume provider credit.

The map and routing work without Fish credentials. Voice cards show `SETUP` until configured. `npm start` runs without file watching. `npm test` runs the Node test suite.

## Developer TTS testing

Open **Developer: test TTS** below the voice controls, enter up to 600 characters, choose a configured voice, and select **Generate with selected voice**. It uses the production `/api/tts` endpoint, so each test is a Fish Audio request and may consume provider credit.

## Voices and server-side TTS

```text
Browser → POST /api/tts { text, voiceId }
Node server → Fish Audio /v1/tts with server-only API key + reference_id
Fish Audio → MP3 bytes → Node server → browser playback
```

`config.json` is the committed default configuration: host, port, Fish model, and six public voice IDs. Put the Fish API key in the ignored `config.local.json`; its nested values override `config.json` at startup. Each voice slot can use a different voice.

The default synthesis model is `s2.1-pro`; change `fish.model` in `config.json` if your account or voices need another compatible S2 model. The server adds soft delivery cues and a slower speaking speed. Actual voice quality depends on the reference voice and Fish model. Preview each voice before using it.

Add further voices in `server/voices.js`, referencing a new entry under `fish.voices` in the configuration. The client discovers them from `GET /api/voices`. API keys and provider IDs stay on the server. The app makes a paid provider request only when you press a speech button; the client plays the resulting audio directly. Text is sent to Fish Audio for synthesis.

## Address search

The **Search** buttons retrieve up to five matches for each entered address through the server’s `/api/geocode` endpoint, which uses Nominatim. Select the intended match before submitting a route. Searches are explicitly user-triggered (not autocomplete), cached for repeat queries, and paced to one provider request per second. Address text is sent to Nominatim; use a production geocoding provider before deploying at scale.

Requests are limited to 600 text characters, two concurrent synthesis jobs, a 60-second provider timeout, and 8 MB per audio response. Stopping audio or changing the route aborts the client request and asks the server to cancel its upstream request. Cancellation may happen after provider work has begun. Generated audio is held in memory for the response and not written to disk. There is no browser speech synthesis fallback.

## Structure

```text
index.html                 Browser entry; pinned Leaflet CDN assets
server/
  index.js                 Node HTTP server startup
  app.js                   Static app + voice API + Fish Audio integration
  voices.js                Voice registry and delivery settings
src/
  main.js                  Route planner, voice picker and preview controls
  style.css                Responsive app layout
  services/map.js          Leaflet map, points and route rendering
  services/routing.js      OSRM driving route adapter
  services/speech.js       Fetch generated audio, cancel and play
  utils/directions.js      Coordinates, maneuver text and formatting
tests/                     Routing and HTTP API tests with mocked Fish responses
```

## Prototype boundaries

This is a route planner and manual spoken route preview. It does not track driving progress, reroute automatically, provide traffic data, geocode addresses, or issue background navigation prompts. Current location only sets the starting point. Those features can build on the route and speech services.

Leaflet loads from a CDN, map tiles come from OpenStreetMap, addresses are searched with Nominatim, and routes come from the public OSRM demo service; internet access is required. Use production map, geocoding, and routing providers before deploying for sustained usage. Resolved coordinates are sent to OSRM when planning a route. The server binds to localhost by default. Add authentication and per-user rate limits before exposing the paid TTS endpoint publicly. This scaffold has no deployment configuration.

## References

- [Fish Audio text-to-speech API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Fish Audio delivery and emotion cues](https://docs.fish.audio/developer-guide/core-features/emotions)
- [OSRM HTTP API](https://project-osrm.org/docs/v26.6.1/http.html)
- [Leaflet quick start](https://leafletjs.com/examples/quick-start/)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
