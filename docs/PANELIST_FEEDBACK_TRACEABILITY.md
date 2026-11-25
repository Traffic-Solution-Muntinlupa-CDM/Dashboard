# Panelist feedback traceability

| Panelist recommendation | Frontend improvement | Page or component | Current limitation |
| --- | --- | --- | --- |
| Improve the UI. | Neutral operator workspace, consistent cards, status badges, type hierarchy, responsive navigation, and visible focus treatment. | Shared shell and `src/index.css` | Frontend research prototype. |
| Improve the dashboard UI and UX. | Reorganized information into Overview, Traffic analytics, Signal operations, Maintenance, and Activity & logs. | `src/App.jsx` navigation and pages | Live pages use the controller when reachable and clearly labelled example data otherwise. |
| Make traffic conditions clearer. | Compact condition band, observed count, unserved time, queue status, phase remaining, intersection weather, approach summary, and attention list. | Overview | Counts are entering-edge sensor values; historical trends remain sample data. Weather comes from Open-Meteo at the intersection coordinates, the same provider the controller configures. |
| Present historical performance more clearly. | Volume, waiting-time, queue, throughput, approach distribution, and peak-period charts. | Traffic analytics | Trend series are clearly badged sample data; there is no historical endpoint on the controller yet. |
| Make signal operations understandable. | Active movement, schematic intersection, camera still for the active movement, sequence, duration, decision layer, and recent decisions. | Overview and Signal operations | Phase, duration, and source come from `GET /current`; the Overview still comes from `GET /snapshot/<movement>.jpg`. Lamp-level acknowledgement is still unavailable. |
| Provide emergency maintenance configuration. | Sign-in gate, Control room program builder (queue phases once or rotate them, pedestrian included), live step state, immediate return to policy, and a password reconfirmation before any override or config write. | Control room, Maintenance | The password is checked in the browser only; the controller's operator endpoints are unauthenticated. Phases without a configured head hold red. |
| Show operational record and health. | Typed activity rows for decisions, pedestrian requests, runtime configuration, and the active data source. | Activity & logs | Rows are derived from the current session; there is no persisted server-side audit log. |

## Data boundary

The dashboard has exactly one write path: `PUT /config` from the Maintenance
page, always preceded by a confirmation showing the field-level diff. Everything
else is a `GET` (`/health`, `/current`, `/live`, `/cameras`, `/snapshot/*`,
`/config`).

The source banner names the active source on every page — **Field controller**,
**Controller simulator**, **Recorded simulation**, or **Example data** — and the
interface falls back to the example dataset only when no source is reachable,
keeping that fallback visible. `simulation-bridge/mock_pi.py` reports
`simulated: true` on `/health`, so a mock demo is never labelled as field
telemetry.

Camera stills are slow stills, not video: the panel always shows the device and
the controller-stamped capture age, marks a frame **stale** past 60 s, and falls
back to the schematic when a movement has no camera (`404`) or its camera is not
sending frames (`503`).

Historical trend charts have no live source and are badged **Sample series**.
`waits{}` is unserved time rather than average vehicle delay and is labelled
"Unserved".

Weather is read from the public Open-Meteo API in the browser, at the same
coordinates and with the same WMO→scalar mapping the controller uses. It is a
forecast source, not a field sensor, and it is labelled that way.
