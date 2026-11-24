# Local bridges

Two small Python servers for working on the dashboard without the intersection.

## `mock_pi.py` — mock controller

Replicates the REST contract of `deployed/pipeline/rest.py`:

```powershell
npm run mock:pi          # or: python simulation-bridge\mock_pi.py --speed 2
```

Serves `http://127.0.0.1:8080` with `GET /health`, `GET /current`, `GET /live`,
`GET /config`, `PUT /config`, plus the camera routes:

```
GET /cameras                    -> [{ movement, camera_id, device, ... }]
GET /snapshot/<movement>.jpg    -> 200 image/jpeg (X-Captured-At, X-Camera-Source)
                                   404 no camera for that movement
```

The mock reports cameras for the two demo heads (`southbound`, `northbound`)
and 404s the other three movements, which is exactly what the deployed
controller will do until those cameras exist. The stills in `frames/` are
labelled test cards, never footage; regenerate them with
`python simulation-bridge/make_placeholder_frames.py`.

It runs a round-robin phase rotation with a starvation override and drifting
sensor counts, so the dashboard has something moving to render.

`/health` returns `"simulated": true`; the dashboard reads that and labels the
source **Controller simulator**, so a demo can never be mistaken for field
telemetry. The served runtime config is a copy seeded from the deployed locked
defaults, written to your temp directory (the path is printed on startup). Use
`--config` to point at a specific `deploy_config.json`.

## `dashboard_bridge.py` — SUMO decision-log replay

Read-only bridge over completed SUMO decision CSVs. It never starts SUMO and
never accepts a controller command.

```powershell
python simulation-bridge\dashboard_bridge.py --log-dir ..\andar-reference-Final\v6\logs\decisions --port 8765
```

The dashboard uses it only as a fallback when the controller is unreachable, and
labels it **Recorded simulation**.
