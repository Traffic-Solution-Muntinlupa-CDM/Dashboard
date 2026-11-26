// Shared vocabulary between the Raspberry Pi controller and this dashboard.
//
// Deployed/pipeline/loop.py emits decision records keyed by *edge* id
// (northbound_entrance, cityhall_exit, ...) and names phases with lowercase
// movement names (northbound, cityhall, ...). The dashboard works in display
// names. This module is the single place that translation happens, so no view
// has to guess at a key.

export const APPROACHES = [
  { name: 'Northbound', edge: 'northbound_entrance', phaseName: 'northbound', color: '#075a9c' },
  { name: 'Southbound', edge: 'southbound_entrance', phaseName: 'southbound', color: '#2879ad' },
  { name: 'Brudger', edge: 'brudger_exit', phaseName: 'brudger', color: '#4f8fba' },
  { name: 'Estanislao', edge: 'estanislao_exit', phaseName: 'estanislao', color: '#749fc6' },
  { name: 'City Hall', edge: 'cityhall_exit', phaseName: 'cityhall', color: '#345f87' },
];

// Phase index -> display name, matching config/default.yaml `phase_index`.
export const MOVEMENT_PHASES = ['Southbound', 'Brudger', 'Northbound', 'Estanislao', 'City Hall'];
export const PHASES = [...MOVEMENT_PHASES, 'Pedestrian'];
export const PEDESTRIAN_PHASE = 'Pedestrian';

const PHASE_ALIASES = {
  southbound: 'Southbound',
  brudger: 'Brudger',
  northbound: 'Northbound',
  estanislao: 'Estanislao',
  cityhall: 'City Hall',
  pedestrian: 'Pedestrian',
  ped: 'Pedestrian',
};

const APPROACH_BY_NAME = new Map(APPROACHES.map((approach) => [approach.name, approach]));
const APPROACH_BY_EDGE = new Map(APPROACHES.map((approach) => [approach.edge, approach]));

/** Normalize any controller phase spelling to a dashboard display name. */
export function toDisplayPhase(raw) {
  if (raw == null) return null;
  const key = String(raw).toLowerCase().replace(/[\s_-]/g, '');
  return PHASE_ALIASES[key] ?? null;
}

export function displayPhaseForIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < PHASES.length ? PHASES[index] : null;
}

// Movement slug used by the controller's camera routes (/snapshot/<slug>.jpg).
const SLUG_BY_PHASE = {
  Southbound: 'southbound',
  Brudger: 'brudger',
  Northbound: 'northbound',
  Estanislao: 'estanislao',
  'City Hall': 'cityhall',
  Pedestrian: 'pedestrian',
};

export function movementSlug(displayPhase) {
  return SLUG_BY_PHASE[displayPhase] ?? null;
}

export function approachForEdge(edge) {
  return APPROACH_BY_EDGE.get(edge) ?? null;
}

export function approachByName(name) {
  return APPROACH_BY_NAME.get(name) ?? null;
}

/**
 * Queue classification derived from the entering-edge vehicle count.
 * `queue_estimator`/`/current.queues` is a vehicle count, not a queue length,
 * so the label has to be derived rather than read.
 */
export function queueBand(count) {
  if (!Number.isFinite(count)) return 'Unknown';
  if (count >= 15) return 'Heavy';
  if (count >= 6) return 'Moderate';
  return 'Light';
}

export function queueTone(label) {
  if (label === 'Heavy') return 'offline';
  if (label === 'Moderate') return 'warning';
  if (label === 'Light') return 'ok';
  return 'neutral';
}

/** Human-readable override source for the decision log. */
export function describeSource(source, overrideReason) {
  switch (source) {
    case 'policy':
      return 'Policy timing head';
    case 'guard':
      return `Starvation guard${overrideReason ? ` · ${overrideReason}` : ''}`;
    case 'ped_quota':
      return 'Pedestrian service quota';
    case 'deadline':
      return 'Hard service deadline';
    case 'safety_override':
      return `Safety override${overrideReason ? ` · ${overrideReason}` : ''}`;
    default:
      return source || 'Unknown source';
  }
}

export function formatSeconds(value, fallback = '—') {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)} s` : fallback;
}

/**
 * Which aspect the lamps are showing right now, derived from the decision
 * record. The record carries the green duration and the yellow; the signals
 * layer runs green -> yellow -> clearance and then waits for the next record,
 * which is emitted at duration + yellow. `issuedAt` is only set when the
 * controller's timestamps are wall clock (not a sim clock).
 */
export function phaseAspect(decision, nowMs, allRedSeconds = 0) {
  if (!decision || decision.issuedAt == null || decision.greenSeconds == null) {
    return { aspect: null, remaining: null, total: null };
  }
  const green = Number(decision.greenSeconds);
  const yellow = Number(decision.yellowSeconds ?? 0);
  const allRed = Math.max(0, Number(allRedSeconds) || 0);
  const elapsed = Math.max(0, nowMs / 1000 - decision.issuedAt);

  if (elapsed < green) {
    return { aspect: 'green', remaining: green - elapsed, total: green };
  }
  if (elapsed < green + yellow) {
    return { aspect: 'yellow', remaining: green + yellow - elapsed, total: yellow };
  }
  if (elapsed < green + yellow + allRed) {
    return { aspect: 'clearance', remaining: green + yellow + allRed - elapsed, total: allRed };
  }
  return { aspect: 'waiting', remaining: 0, total: 0 };
}

export const ASPECT_LABELS = {
  green: 'Green',
  yellow: 'Yellow',
  clearance: 'Clearance',
  waiting: 'Waiting',
};
