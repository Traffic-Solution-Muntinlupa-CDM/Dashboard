# Local SUMO bridge

`dashboard_bridge.py` serves existing SUMO decision-log rows to the browser dashboard over localhost. It is read-only: it never starts SUMO or accepts a controller command.

```powershell
py simulation-bridge\dashboard_bridge.py --log-dir ..\andar-reference-Final\v6\logs\decisions --port 8765
```

The GitHub Pages dashboard uses it only when **Local SUMO simulation** is selected. It polls `GET /api/v1/simulation/latest`, exposes example data when the local bridge is unreachable, and labels returned values as recorded simulator output rather than field-controller confirmation or live camera telemetry.
