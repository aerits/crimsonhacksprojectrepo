# Mommy Maps

Mommy Maps is a local JavaScript driving-route prototype with address autocomplete, Leaflet maps, Fish Audio navigation voices, personal after-turn phrases, ambient roadside trivia, and a development-only route simulator.

It can plan and preview a route; it is not production navigation software.

## Run

Requires Node.js 22.9 or later and a modern browser. There are no npm dependencies.

```sh
cp config.local.example.json config.local.json
# Add fish.apiKey to config.local.json to enable generated voice playback.
npm run dev
```

Open <http://127.0.0.1:3000>.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Watch and run the local server. |
| `npm run dev:simulate` | Also expose the route simulator. |
| `npm start` | Run without watching or simulator controls. |
| `npm test` | Run all Node tests. |

`config.json` is the committed default configuration. `config.local.json` is Git-ignored and overrides it at startup. Keep Fish API keys only in the local file.

## Using the app

1. Allow browser location access, or enter a starting address.
2. Type a destination. Suggestions appear after three characters; choose a result before planning the route.
3. Optionally avoid tolls, highways/freeways, or ferries, then choose **Show my route on the map**.
4. Review turns with the arrow buttons or use **Hear this turn**.

Address results come from Photon. When an origin is known, results are ranked by straight-line distance; destination searches prioritize the selected start and start searches prioritize GPS. The five closest unique matches are shown. Distances are estimates, not driving distances.

Routes come from OSRM and are displayed with Leaflet/OpenStreetMap. During a planned route, GPS can update a live marker and smoothly follow it. On small screens, the directions panel becomes a compact bottom sheet so the map remains visible.

## Voices, phrases, and audio

The browser never receives the Fish Audio key:

```text
Browser → POST /api/tts → Node server → Fish Audio → MP3 → browser Audio playback
```

Seven voice personas are available: Velvet, Honey, Luna, Willow, Rose, Ember, and VERITY. Configure the API key and voice IDs under `fish` in the config files. VERITY uses the public Fish Audio reference configured in `config.json`; a local `fish.voices.verity` value can override it. Persona text, delivery cues, and speeds are in `server/voices.js`; the browser discovers safe metadata from `GET /api/voices`.

The app uses an in-memory `Audio` object, not a visible HTML player. Previews, route turns, ambient trivia, and Developer TTS testing can consume Fish Audio credit. The Voice library compares and previews configured voices; its selected voice and volume stay synchronized with the journey view.

`voice-phrases.json` contains shared route encouragement and affirmation presets. In **User settings → Journey encouragements**, users can add, edit, and remove up to 20 personal encouragements, each up to 160 characters. They are normalized, deduplicated, and stored in browser local storage when possible. Route and simulator speech sends the current personal list only with that request; the server validates it, selects one phrase from the built-in, selected affirmation, and personal pools, then appends it to the spoken instruction. Previews and Developer TTS use their supplied text unchanged.

Choose Neutral, Girl, Boy, or Enby under **After-turn encouragement**. The selected encouragement style and theme are stored locally when browser storage is available.

## Simulator and ambient trivia

Run `npm run dev:simulate` to show **Simulate route**. It advances route steps at relaxed, normal, or quick pace, animates a pink marker along route geometry, follows that marker, and speaks each instruction. It is hidden for `npm run dev` and `npm start`.

**Start ambient guidance** starts a high-accuracy location watch. On a sustained, roughly highway-speed stretch with a long distance before the next maneuver, it can speak a nearby regional fact. It waits five minutes before the first note and at least 18 minutes between notes. Use **Mute trivia** or **Skip next note** to control it. This is an experimental heuristic, not driving guidance.

## Themes and accessibility

Light, Pink, Verity, and Dark themes are available. Pink and Verity use decorative SVG assets documented in [ATTRIBUTIONS.md](ATTRIBUTIONS.md). Journey and Voice library are keyboard-accessible tabs; status updates, phrase editing, and controls include accessible labels and live regions.

## API and limits

| Endpoint | Purpose |
| --- | --- |
| `GET /api/voices` | Public voice metadata and configuration status. |
| `GET /api/runtime` | Whether the simulator is enabled. |
| `GET /api/geocode?q=…&lat=…&lng=…` | Photon-backed address suggestions. |
| `POST /api/tts` | Fish Audio speech for a configured voice. |

The server caches up to 200 geocoding lookups, rate-limits upstream geocoding to roughly one request per second, allows two concurrent TTS jobs, applies a 60-second TTS timeout, limits audio to 8 MB, and accepts JSON bodies up to 32 KB. Audio is held in memory for the response, not written to disk.

## Structure

```text
config.json / config.local.json       Runtime defaults and local overrides
voice-phrases.json                    Shared phrase and affirmation presets
ATTRIBUTIONS.md                       Decorative asset licensing notes
server/                               Config, HTTP API, Fish TTS, voice registry
src/main.js                           Route planner, GPS, settings, simulator, trivia
src/services/                         Map, routing, search, speech, trivia, storage
src/ui/                               Tabs, voice library, phrase editor
src/utils/                            Directions, location, phrase validation
public/images/                        Voice art and theme decorations
tests/                                Node tests for APIs and client services
```

## Prototype boundaries and privacy

Mommy Maps does not reroute, provide traffic, guarantee road legality or safety, work offline, or replace attention to the road. It requires internet access for Leaflet assets, OpenStreetMap tiles, Photon, OSRM, and Fish Audio when voice playback is used.

Address searches are sent to Photon, route coordinates to OSRM, and spoken text plus the selected Fish reference ID to Fish Audio. GPS remains in the browser except when used as a route endpoint or Photon location bias. Personal phrases remain browser-local except for applicable TTS requests. The server binds to localhost by default; add authentication, per-user limits, production providers, monitoring, and privacy controls before public deployment.

## References

- [Fish Audio text-to-speech API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [OSRM HTTP API](https://project-osrm.org/docs/v5.24.0/api/)
- [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md)
- [Leaflet quick start](https://leafletjs.com/examples/quick-start/)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
