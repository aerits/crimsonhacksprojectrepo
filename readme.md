# Mommy Maps

Mommy Maps is a working, local map-first driving-route prototype with address autocomplete, Leaflet/OpenStreetMap, optional Fish Audio voice guidance, Utah outdoor discovery, and route simulation. It is designed to plan and preview real routes in a modern browser.

## Run locally

Requires Node.js 22.9+ and a modern browser. The project has no npm dependencies.

```sh
cp config.local.example.json config.local.json
# Add fish.apiKey in config.local.json to enable generated voice playback.
npm run dev
```

Open <http://127.0.0.1:3000>.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Watch and run the local server. |
| `npm run dev:simulate` | Run with route simulator controls enabled. |
| `npm start` | Run without file watching or simulator controls. |
| `npm test` | Run the Node test suite. |

`config.json` is committed and contains safe defaults. `config.local.json` is ignored and overrides it at startup. Keep API keys in the local file only.

## What it does

- Uses GPS as the preferred start point when permission is granted; a typed start address also works.
- Shows address suggestions while typing, ranked around the GPS/start location. Utah landmarks are prioritized for matching landmark searches, then results are ordered by distance and name.
- Plans driving routes through OSRM and displays them on a Leaflet/OpenStreetMap map.
- Supports swapping and clearing endpoints, avoiding tolls/highways/ferries, route cancellation, live-location following, route-turn previews, and optional ambient guidance.
- Includes a Parks, Trails, and Landmarks legend/filter. Utah state parks and trail ideas live in Settings; choosing one opens its official planning page before a route is set.
- Uses themed route lines for Light, Pink, Verity, and Dark themes. Selecting VERITY changes the visible and browser title to **verity maps.**

To plan a route, choose one autocomplete suggestion for the start and destination, then select **Show my route on the map**. The route card shows the current direction, route summary, estimated arrival, optional route conditions, and all directions. On smaller screens it becomes a compact map sheet.

## Voices and phrases

Voice playback is optional. The browser never receives the Fish API key:

```text
Browser → POST /api/tts → Node server → Fish Audio → MP3 → browser Audio playback
```

The voice library offers Velvet, Honey, Luna, Willow, Rose, Ember, and VERITY. Configure the Fish key and reference IDs under `fish` in configuration files. Voice metadata is exposed safely through `GET /api/voices`; provider IDs and keys are not.

The app uses one in-memory `Audio` object rather than a visible audio element. A selected voice is saved locally when browser storage is available. Voice previews, route directions, ambient trivia, and Developer TTS tests can consume Fish Audio credit.

`voice-phrases.json` holds shared after-turn, arrival, and affirmation phrases. Settings lets users manage up to 20 local custom journey phrases and 20 arrival phrases (160 characters each). Neutral, Girl, Boy, and Enby affirmation styles are available. Personal phrases stay in local storage except when sent with the applicable TTS request.

## Simulator and driving helpers

`npm run dev:simulate` enables **Simulate route** controls. The simulator animates a marker along route geometry at a selected MPH or route-relative pace and waits for each simulated instruction’s audio before advancing. Normal `dev` and `start` keep those optional controls hidden.

**Start Navigation** starts high-accuracy location following and can enable ambient Utah trivia on sustained clear, highway-speed stretches. It waits five minutes before the first note and at least 18 minutes between notes. Mute or skip trivia from Settings.

## HTTP API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/voices` | Public voice metadata and configuration status. |
| `GET /api/runtime` | Whether simulator controls are enabled. |
| `GET /api/geocode?q=…&lat=…&lng=…&categories=…` | Photon-backed nearby address and Utah-landmark suggestions. |
| `POST /api/tts` | Fish Audio speech for a configured voice. |
| `POST /api/conditions` | Optional UDOT route-condition lookup. |
| `POST /api/air-quality` | Optional AirNow route air-quality lookup. |

Geocoding caches up to 200 lookups and limits provider traffic to roughly one request per second. The server permits two concurrent TTS jobs, limits TTS requests to 60 seconds and 8 MB of audio, and accepts JSON bodies up to 32 KB.

## Project layout

```text
config.json / config.local.json       Default configuration and local overrides
voice-phrases.json                    Shared voice phrases and affirmations
ATTRIBUTIONS.md                       Decorative asset licensing notes
server/                               HTTP API, configuration, Fish TTS, voice registry
src/data/                             Utah landmarks, outdoor suggestions, category metadata
src/services/                         Map, routing, geocoding, speech, trivia, local storage
src/ui/                               Tabs, voice library, phrase editor
src/utils/                            Directions, locations, phrase validation
public/images/                        Voice art and theme decorations
tests/                                Node tests
```

## Use and privacy

Mommy Maps needs internet access for map tiles, Photon, OSRM, and Fish Audio when voice playback is enabled. Route information and conditions are provider-backed estimates, so follow posted signs, current road conditions, and safe-driving practices.

Address searches go to Photon; route coordinates go to OSRM; and spoken text plus the selected Fish reference ID go to Fish Audio. GPS stays in the browser except when used as a route endpoint, provider search bias, or optional route-condition lookup. Deployments should add the appropriate authentication, rate limits, monitoring, and privacy controls for their audience.

## References

- [Fish Audio text-to-speech API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [OSRM HTTP API](https://project-osrm.org/docs/v5.24.0/api/)
- [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md)
- [Leaflet quick start](https://leafletjs.com/examples/quick-start/)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
