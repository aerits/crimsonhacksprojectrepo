# Softly

A JavaScript maps app with comforting mommy ASMR navigation voices. This first scaffold plans driving routes and lets you preview each direction with server-generated Fish Audio speech.

## Run

Requires Node.js 22.9 or newer. There are no npm dependencies to install.

```sh
cp .env.example .env
# Add your Fish Audio API key and at least one Fish voice ID to .env.
npm run dev
```

Open http://127.0.0.1:3000. Use the sample Tuscaloosa coordinates, enter `latitude, longitude`, select points with the map picker, or use your current location. Find a route, then use the arrows and **Hear this turn** to preview it. The audio controls allow replay if the browser blocks automatic playback.

The map and routing work without Fish credentials. Voice cards show `SETUP` until configured. `npm start` runs without file watching. `npm test` runs the Node test suite.

## Voices and server-side TTS

```text
Browser → POST /api/tts { text, voiceId }
Node server → Fish Audio /v1/tts with server-only API key + reference_id
Fish Audio → MP3 bytes → Node server → browser audio element
```

In `.env`, set `FISH_API_KEY` and copy Fish Audio voice model IDs into `FISH_VOICE_VELVET`, `FISH_VOICE_HONEY`, and `FISH_VOICE_LUNA`. Each slot can use a different voice. These names are app personas; no specific Fish voice is bundled or selected on your behalf. The earlier voice-models.com RVC archive is not used by this Fish Audio integration.

The default synthesis model is `s2.1-pro`; override `FISH_MODEL` if your account or voices need another compatible S2 model. The server adds soft delivery cues and a slower speaking speed. Actual voice quality depends on the reference voice and Fish model. Preview each voice before using it.

Add further voices in `server/voices.js`, referencing a new server environment variable for each Fish voice ID. The client discovers them from `GET /api/voices`. API keys and provider IDs stay on the server. The app makes a paid provider request only when you press a speech button; audio can be replayed locally through the controls. Text is sent to Fish Audio for synthesis.

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

Leaflet loads from a CDN, map tiles come from OpenStreetMap, and routes come from the public OSRM demo service; internet access is required. Use production map and routing providers before deploying for sustained usage. Current coordinates are sent to OSRM when planning a route. The server binds to localhost by default. Add authentication and per-user rate limits before exposing the paid TTS endpoint publicly. This scaffold has no deployment configuration.

## References

- [Fish Audio text-to-speech API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Fish Audio delivery and emotion cues](https://docs.fish.audio/developer-guide/core-features/emotions)
- [OSRM HTTP API](https://project-osrm.org/docs/v26.6.1/http.html)
- [Leaflet quick start](https://leafletjs.com/examples/quick-start/)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
