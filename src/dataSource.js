// Data-source chain: field controller -> local SUMO log bridge -> example data.
//
// Every source is normalized to the same snapshot shape, and `sourceKind` is
// carried through so the UI can say exactly what it is showing. The fallthrough
// exists so the dashboard stays usable in a classroom, but a fallback is never
// presented as field telemetry.
import { loadPiSnapshot } from './piBridge';
import { loadSimulationSnapshot } from './simulationBridge';

export const SOURCE_LABELS = {
  'field-controller': {
    short: 'Field controller',
    detail: 'Live Raspberry Pi controller over its REST interface.',
    tone: 'ok',
  },
  'controller-simulator': {
    short: 'Controller simulator',
    detail: 'Mock controller contract — not the deployed Raspberry Pi.',
    tone: 'simulated',
  },
  'sumo-replay': {
    short: 'Recorded simulation',
    detail: 'Last row of a local SUMO decision log, served by the read-only bridge.',
    tone: 'simulated',
  },
  example: {
    short: 'No controller',
    detail: 'No live source is reachable; values are unavailable.',
    tone: 'warning',
  },
};

export function sourceMeta(kind) {
  return SOURCE_LABELS[kind] ?? SOURCE_LABELS.example;
}

// Only a real cancellation aborts the chain. A TimeoutError from one source is
// a failure of that source and should fall through to the next one.
function isAbort(error) {
  return error?.name === 'AbortError';
}

const SUMO_RETRY_MS = 60_000;
let sumoRetryAfter = 0;

export async function loadDashboardSnapshot(signal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  let controllerFailure;

  try {
    const snapshot = await loadPiSnapshot(signal);
    if (snapshot.connection.status !== 'unreachable') return snapshot;
    controllerFailure = snapshot.message;
  } catch (error) {
    if (isAbort(error)) throw error;
    controllerFailure = error.message;
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // The SUMO replay bridge is a convenience fallback, not the deployed source.
  // Back it off for a minute after a miss so a dashboard left open on a machine
  // without it does not log a failed connection every poll.
  if (Date.now() >= sumoRetryAfter) {
    try {
      const simulation = await loadSimulationSnapshot(signal);
      sumoRetryAfter = 0;
      return { ...simulation, sourceKind: 'sumo-replay' };
    } catch (error) {
      if (isAbort(error)) throw error;
      sumoRetryAfter = Date.now() + SUMO_RETRY_MS;
    }
  }

  return {
    schemaVersion: '2.0',
    kind: 'dashboard',
    available: false,
    sourceKind: 'example',
    generatedAt: new Date().toISOString(),
    message: controllerFailure
      ? `Controller unavailable (${controllerFailure}); no local simulation log found either.`
      : 'No live source is reachable.',
    connection: {
      status: 'unreachable',
      controller: false,
      runtimeConfig: false,
      simulated: false,
      message: controllerFailure,
    },
    approaches: [],
  };
}
