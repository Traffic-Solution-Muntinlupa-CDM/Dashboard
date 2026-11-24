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
| `GET /config` | runtime config for the Maintenance page |
| `PUT /config` | validated, atomic replacement of `deploy_config.json` |

`/current` only changes on a phase change (every 36–80 s); the dashboard polls
it every 3 s and takes counts from `/live` so the numbers move between decisions.

## Data honesty rules

These are load-bearing; please keep them when changing the UI.

- The source banner on every page names what is on screen: **Field controller**,
  **Controller simulator**, **Recorded simulation**, or **Example data**.
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

Two controls have no backing on the deployed controller and are shown read-only:

- **All-red clearance** comes from `hardware.yaml` in the signals container.
- **Emergency override** has no command path at all.

`PUT /config` returns `404` when the controller was started without the cv
overlay, because only `config/cv.yaml` sets `runtime_config_path` and only
`docker-compose.cv.yml` mounts `./data` read-write. The page reports that state
instead of pretending Save worked.

## Layout

```
src/controllerContract.js  edge/phase names, queue bands, source descriptions
src/piBridge.js            REST client, timeouts, normalization
src/configApi.js           GET/merge/PUT, field diff, validation errors
src/dataSource.js          field controller -> SUMO bridge -> example data
src/App.jsx                views
simulation-bridge/
  mock_pi.py               REST-contract mock controller (no hardware)
  dashboard_bridge.py      read-only SUMO decision-log bridge
```
