# Panelist feedback traceability

| Panelist recommendation | Frontend improvement | Page or component | Current limitation |
| --- | --- | --- | --- |
| Improve the UI. | Neutral operator workspace, consistent cards, status badges, type hierarchy, responsive navigation, and visible focus treatment. | Shared shell and `src/index.css` | Frontend research prototype. |
| Improve the dashboard UI and UX. | Reorganized information into Overview, Traffic analytics, Signal operations, Maintenance, and Activity & logs. | `src/App.jsx` navigation and pages | Live pages use the controller when reachable and clearly labelled example data otherwise. |
| Make traffic conditions clearer. | Compact condition band, observed count, unserved time, queue status, phase remaining, approach summary, and attention list. | Overview | Counts are entering-edge sensor values; historical trends remain sample data. |
| Present historical performance more clearly. | Volume, waiting-time, queue, throughput, approach distribution, and peak-period charts. | Traffic analytics | Trend series are clearly badged sample data; there is no historical endpoint on the controller yet. |
| Make signal operations understandable. | Active movement, schematic intersection, sequence, duration, decision layer, and recent decisions. | Signal operations | Phase, duration, and source come from `GET /current`; lamp-level acknowledgement is still unavailable. |
| Provide emergency maintenance configuration. | Timing guardrails, dispatch mode, presets, field-level diff, and component status. | Maintenance | Timing values write to the live `deploy_config.json` via `PUT /config`. All-red clearance (hardware.yaml) and emergency override have no backing on the controller and are shown read-only. |
| Show operational record and health. | Typed activity rows for decisions, pedestrian requests, runtime configuration, and the active data source. | Activity & logs | Rows are derived from the current session; there is no persisted server-side audit log. |

## Data boundary

The dashboard has exactly one write path: `PUT /config` from the Maintenance
page, always preceded by a confirmation showing the field-level diff. Everything
else is a `GET` (`/health`, `/current`, `/live`, `/config`).

The source banner names the active source on every page — **Field controller**,
**Controller simulator**, **Recorded simulation**, or **Example data** — and the
interface falls back to the example dataset only when no source is reachable,
keeping that fallback visible. `simulation-bridge/mock_pi.py` reports
`simulated: true` on `/health`, so a mock demo is never labelled as field
telemetry.

Historical trend charts have no live source and are badged **Sample series**.
`waits{}` is unserved time rather than average vehicle delay and is labelled
"Unserved".
