# Dashboard

Operations dashboard for the ANDAR intersection, wired to the deployed Raspberry
Pi controller over its REST interface.

## Run it

```powershell
npm install
npm run mock:pi      # terminal 1 — mock controller on http://127.0.0.1:8080
npm run dev          # terminal 2 — dashboard on http://localhost:5173
```

`npm run mock:pi` is only needed while the prototype is unavailable. It speaks
the same contract as `deployed/pipeline/rest.py` and flags itself as simulated,
so the UI shows **Controller simulator**, never **Field controller**.

To point at the real Pi:

```powershell
Copy-Item .env.example .env.local
# edit VITE_PI_URL=http://<pi-address>:8080
```

Then reload `npm run dev`. `npm run preview` (the production build) uses the
same proxy.

## How the link works

```
browser ──/pi/*──> Vite proxy ──> http://<pi>:8080
```

The Pi's REST server is stdlib-only and sends **no CORS headers**. Proxying
through Vite keeps the browser same-origin, so reads *and* `PUT /config` work
without touching the deployed Python. Set `VITE_PI_DIRECT=true` only when the
page is served from an origin that already reaches the Pi (for example the build
hosted on the Pi itself).

| Route | Used for |
| --- | --- |
| `GET /health` | link status; `simulated: true` marks the mock |
| `GET /current` | latest decision: phase, duration, source, queues, waits |
| `GET /live` | ~1 Hz sample: counts, waits, kappa, pedestrian button |
| `GET /cameras` | camera inventory (`movement`, `camera_id`, `device`) |
| `GET /snapshot/<movement>.jpg` | slow still for one movement |
| `GET /signals` | signal heads + the timing envelope |
| `GET/POST/DELETE /override` | operator program: read, start, cancel |
| `GET /config` | runtime config for the Maintenance page |
| `PUT /config` | validated, atomic replacement of `deploy_config.json` |

`/current` only changes on a phase change (every 36–80 s); the dashboard polls
it every 3 s and takes counts from `/live` so the numbers move between decisions.

## Camera stills

Overview shows a still for the active movement instead of the schematic. It
fetches `/snapshot/<movement>.jpg` when the phase changes and refreshes every
15 s while that phase stays green — a slow still, not a video feed.

- `X-Captured-At` is stamped by the controller, not the camera. The panel shows
  the age and switches to **Stale still** past 60 s.
- `404` = no camera is configured for that movement, so the schematic stands in
  with an explicit label.
- `503` = a camera is configured but is not sending frames.
- The browser never talks to a camera directly: credentials, capture backends
  and any camera node stay on the controller.

Only the **southbound** movement has camera hardware today (the Pi's USB webcam).
The northbound head is still being built, so its camera will arrive later; the
panel already handles a `404`/`503` for it without changes. The mock serves
placeholders for both demo movements and 404s for the other three, so the
"no camera" state is exercised rather than hidden.

Camera stills are **not** the source of the approach counts. `/live` counts and
a snapshot come from different paths, and the panel labels the device separately
from the decision source.

## Operator control

The dashboard opens on a sign-in gate. `VITE_OPERATOR_PASSWORD` (default
`andar-demo`) is checked **in the browser only** — it is a demo access gate, not
security. The controller's operator endpoints are deliberately unauthenticated;
the boundary is network access to `:8080`. See `deployed/pipeline/rest.py`.

**Control room** queues phases and runs them once or in rotation:

```
POST /override
{"steps":[{"phase":1,"seconds":30},{"phase":2,"seconds":20}],
 "mode":"once"}                       // or "loop" + max_duration_seconds
-> 202 {override_id, applied_steps, yellow, all_red, warnings[]}
```

- The current green is cut through its **yellow** (10 s here), then red, then the
  requested phase. A green never jumps straight to another green.
- `seconds` is accepted 5–120 and clamped by the signal heads to 15–60; the UI
  shows the applied values and any warnings (a phase with no head holds red).
- `once` returns to the policy when the list ends. `loop` rotates until the cap
  or **Return to policy**. Cancel truncates the current green into yellow → red,
  then hands back.
- `GET /override` carries `index`, `step_remaining`, `ends_at` and `cancelling`,
  so the banner and the Live state panel stay honest.

Both overriding and writing config require the password to be **re-entered** in
a confirmation dialog that lists exactly what will happen.

## Weather

The Overview badge and the Activity row read **Open-Meteo** directly, at
`VITE_WEATHER_LAT` / `VITE_WEATHER_LON` (defaults `14.4081`, `121.0415` — the
intersection).

That is deliberately the same provider and coordinate pair
`deployed/config/cv.yaml` configures for `OpenMeteoWeatherSource`, on the same
10-minute refresh window, and the WMO code is mapped to the controller's
`-1 clear / 0 cloudy / 1 rainy` scalar with the same table
(`cv/config.yaml` → `weather.py:_map_wmo`). No API key is involved.

It is read in the browser rather than from the Pi because `/live` does not carry
weather yet. When it does, prefer that value — `src/weatherBridge.js` is the one
place to change.

The Overview weather card shows the controller's own three buckets —
**Clear / Cloudy / Rainy** — so it cannot disagree with what the model saw, with
the temperature and wind speed underneath. The exact WMO condition ("Overcast",
"Light drizzle", "Thunderstorm, hail") lives in Activity & logs, because it is
finer-grained than the controller's vocabulary.

If the API is unreachable the badge reads **Weather unavailable** rather than
disappearing, so a missing forecast stays visible. Weather is independent of the
controller link: it keeps working while the Pi is away, and it is not a field
sensor reading.

## Data honesty rules

These are load-bearing; please keep them when changing the UI.

- The source banner on every page names what is on screen: **Field controller**,
  **Controller simulator**, **Recorded simulation**, or **Example data**.
- A camera still is never presented as live: the panel always shows the device,
  the capture age, and a stale warning. Frames the controller marks as simulated
  are labelled as such.
- Weather is the same Open-Meteo source and coordinates the controller uses, but
  it is a forecast API read independently — not a field sensor, and not proof of
  the value the controller had cached.
- `waits{}` is *seconds an edge has gone unserved*, not average vehicle delay —
  it is labelled "Unserved".
- `queues{}` is a vehicle count; the queue label is derived from count bands.
- Volume/wait/queue/throughput trend charts have no live source. They are always
  badged **Sample series**.

## Configuration writes

The Maintenance page edits the live runtime config:

| Control | Field in `deploy_config.json` |
| --- | --- |
| Minimum / maximum green | `green.band_seconds._default` |
| Pedestrian duration | `green.ped_duration` |
| Yellow interval | `timing.yellow_seconds` |
| Guard / deadline / pedestrian quota | `backstops.*` |
| Dispatch mode | `dispatch.mode` |
| Serve empty approaches | `dispatch.serve_empty` |

Writes always re-read the controller, merge only these fields, then `PUT` the
whole object — `validate()` requires a complete config, and this keeps fields
the form does not own intact. Every write needs an explicit confirmation showing
the field-level diff.

One control has no backing in the runtime JSON: **all-red clearance** comes from
`hardware.yaml` in the signals container. Operator override now has a real
command path — see *Operator control* above.

`PUT /config` returns `404` when the controller was started without the cv
overlay, because only `config/cv.yaml` sets `runtime_config_path` and only
`docker-compose.cv.yml` mounts `./data` read-write. The page reports that state
instead of pretending Save worked.

## Layout

```
src/controllerContract.js  edge/phase names, queue bands, source descriptions
src/piBridge.js            REST client, timeouts, normalization
src/cameraBridge.js        camera inventory + still fetches
src/configApi.js           GET/merge/PUT, field diff, validation errors
src/operatorApi.js         /signals and /override client
src/operatorSession.js     demo password gate (browser-only)
src/LoginPage.jsx          sign-in gate
src/ConfirmDialog.jsx      password reconfirmation for destructive actions
src/OperatorPage.jsx       Control room (program builder + live state)
src/dataSource.js          field controller -> SUMO bridge -> example data
src/App.jsx                views, login gate, override banner
src/CameraPanel.jsx        Overview still with schematic fallback
simulation-bridge/
  mock_pi.py               REST-contract mock controller (no hardware)
  make_placeholder_frames.py  regenerates the mock's labelled test cards
  frames/                  the placeholder stills themselves
  dashboard_bridge.py      read-only SUMO decision-log bridge
```
