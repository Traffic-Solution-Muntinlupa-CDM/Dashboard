# Panelist feedback traceability

| Panelist recommendation | Frontend improvement | Page or component | Current limitation |
| --- | --- | --- | --- |
| Improve the UI. | Neutral operator workspace, consistent cards, status badges, type hierarchy, responsive navigation, and visible focus treatment. | Shared shell and `src/index.css` | Frontend research prototype. |
| Improve the dashboard UI and UX. | Reorganized information into Overview, Traffic analytics, Signal operations, Maintenance, and Activity & logs. | `src/App.jsx` navigation and pages | Example data is default. |
| Make traffic conditions clearer. | Compact condition band, observed count, waiting time, queue status, utilization, approach summary, and attention list. | Overview | Counts and queue labels are illustrative, not MTMB field data. |
| Present historical performance more clearly. | Volume, waiting-time, queue, throughput, approach distribution, and peak-period charts. | Traffic analytics | Charts contain clearly labeled example data. |
| Make signal operations understandable. | Active movement, schematic intersection, sequence, duration, transition context, and decision records. | Signal operations | No signal controller or physical acknowledgement is connected. |
| Provide emergency maintenance configuration. | Timing-profile and interval previews, operating-mode preview, emergency-override concept, logging options, and component status. | Maintenance | Frontend demonstration only; Save preview sends no request and applies no configuration. |
| Show operational record and health. | Typed activity rows for simulated, proposed, system, warning, and unavailable events. | Activity & logs | No field camera, sensor, authentication, or controller service is connected. |

## Data boundary

The optional **Local SUMO simulation** selector retains the existing read-only `GET` integration. It never adds `POST`, `PUT`, or `DELETE` calls. When unavailable, the interface returns to the consistent example dataset and makes that fallback visible.
