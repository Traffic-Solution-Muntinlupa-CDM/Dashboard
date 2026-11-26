// Client for the deployed Raspberry Pi controller's REST surface.
//
// The Pi runs a deliberately thin stdlib server (deployed/pipeline/rest.py):
//   GET /health   {"status":"ok"}
//   GET /current  latest decision record (404 until the first decision)
//   GET /live     ~1 Hz sensor sample (counts/waits/kappa/button)
//   GET /config   the live runtime config, or 404 when none is mounted
//
// It sends no CORS headers, so the browser talks to the Vite dev/preview proxy
// under /pi (see vite.config.js). That keeps the page same-origin and lets PUT
// /config through unchanged. Set VITE_PI_DIRECT=true only when the origin
// already reaches the Pi directly (e.g. the build is served from the Pi).
import { APPROACHES, displayPhaseForIndex, toDisplayPhase } from './controllerContract';

const DIRECT = import.meta.env.VITE_PI_DIRECT === 'true';

export const PI_URL = (import.meta.env.VITE_PI_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
export const PI_BASE = DIRECT ? PI_URL : '/pi';
export const POLL_INTERVAL_MS = 3000;

const REQUEST_TIMEOUT_MS = 2500;

function requestSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}

/**
 * Raw request against the controller. Returns the Response untouched so binary
 * endpoints (camera stills) can read headers and a blob.
 */
export async function piFetch(path, { signal, method = 'GET', body, headers: extraHeaders, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const headers = { ...extraHeaders };
  if (body !== undefined && headers['Content-Type'] === undefined) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${PI_BASE}${path}`, {
    method,
    signal: requestSignal(signal, timeoutMs),
    cache: 'no-store',
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/**
 * One JSON request against the controller. Never throws on an HTTP error
 * status -- the status is part of the answer (404 on /current and /config are
 * meaningful).
 */
export async function piRequest(path, { signal, method = 'GET', body, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const response = await piFetch(path, {
    signal,
    method,
    body,
    timeoutMs,
    headers: { Accept: 'application/json' },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { ok: response.ok, status: response.status, payload };
}

function settled(result) {
  return result.status === 'fulfilled' ? result.value : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Fetch and normalize one snapshot of controller state.
 *
 * Returns a stable shape for the UI, including a `connection.status` of
 * `live` | `awaiting-decision` | `unreachable`. It resolves (rather than throws)
 * when the controller is unreachable so callers can fall back to another
 * source without losing the reason.
 */
export async function loadPiSnapshot(signal) {
  const generatedAt = new Date().toISOString();

  // Probe /health first and stop there when it fails: while the controller is
  // away, hammering /current, /live and /config every poll only floods the
  // console and the network with guaranteed 502s.
  let healthResult;
  try {
    healthResult = await piRequest('/health', { signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    healthResult = null;
  }

  if (!healthResult?.ok) {
    const reason =
      healthResult?.status != null
        ? `Controller REST answered ${healthResult.status}`
        : 'Controller REST is unreachable';
    return {
      schemaVersion: '2.0',
      kind: 'pi-controller',
      available: false,
      sourceKind: 'field-controller',
      generatedAt,
      message: reason,
      connection: {
        status: 'unreachable',
        controller: false,
        runtimeConfig: false,
        simulated: false,
        message: reason,
      },
      approaches: [],
    };
  }

  const results = await Promise.allSettled([
    piRequest('/current', { signal }),
    piRequest('/live', { signal }),
    piRequest('/config', { signal }),
  ]);

  const [currentResult, liveResult, configResult] = results.map(settled);

  const simulated = Boolean(healthResult.payload?.simulated);
  const record = currentResult?.ok ? currentResult.payload : null;
  const liveState = liveResult?.ok ? liveResult.payload : null;

  return {
    schemaVersion: '2.0',
    kind: 'pi-controller',
    available: true,
    sourceKind: simulated ? 'controller-simulator' : 'field-controller',
    generatedAt,
    message: record ? null : 'Controller reachable, waiting for its first decision.',
    connection: {
      status: record ? 'live' : 'awaiting-decision',
      controller: true,
      runtimeConfig: Boolean(configResult?.ok),
      simulated,
      service: healthResult.payload?.service ?? null,
      message: healthResult.payload?.message ?? null,
    },
    controllerDecision: normalizeDecision(record),
    pedestrian: normalizePedestrian(record, liveState),
    approaches: normalizeApproaches(record, liveState),
  };
}

function normalizeDecision(record) {
  if (!record) return null;

  const phase = toDisplayPhase(record.phase_name) || displayPhaseForIndex(record.phase);
  const issuedAt = numberOrNull(record.ts);
  // `ts` is a sim clock under `source: sim` and a unix stamp on the Pi. Only
  // compute wall-clock age when it can actually be a unix stamp, otherwise the
  // countdown would be nonsense.
  const wallClock = issuedAt !== null && issuedAt > 1_000_000_000;
  const elapsedSeconds = wallClock ? Math.max(0, Date.now() / 1000 - issuedAt) : null;
  const greenSeconds = numberOrNull(record.duration);
  const remainingSeconds =
    elapsedSeconds !== null && greenSeconds !== null ? Math.max(0, greenSeconds - elapsedSeconds) : null;

  return {
    phase,
    phaseIndex: numberOrNull(record.phase),
    phaseNameRaw: record.phase_name ?? null,
    greenSeconds,
    yellowSeconds: numberOrNull(record.yellow),
    source: record.source ?? null,
    overrideReason: record.override_reason ?? null,
    elapsedSeconds,
    remainingSeconds,
    phaseProbabilities: Array.isArray(record.phase_probs) ? record.phase_probs : null,
    issuedAt: wallClock ? issuedAt : null,
    semantics: 'Controller decision record; not a camera or field acknowledgement.',
  };
}

function normalizePedestrian(record, liveState) {
  const pressedRaw = liveState?.button_pressed ?? record?.pressed ?? 0;
  const pressed = Number(pressedRaw) > 0 || pressedRaw === true;
  return {
    requestPresent: pressed,
    pressAgeSeconds: numberOrNull(liveState?.press_age ?? record?.press_age),
    pressedAt: numberOrNull(liveState?.pressed_at),
  };
}

function normalizeApproaches(record, liveState) {
  // `/live` carries the freshest sample; `/current.queues`/`waits` are the last
  // decision's values and stay useful before the first live sample arrives.
  const counts = liveState?.counts ?? record?.queues ?? {};
  const waits = liveState?.waits ?? record?.waits ?? {};
  const kappa = liveState?.kappa ?? {};

  return APPROACHES.map((approach) => ({
    name: approach.name,
    observedVehicles: numberOrNull(counts[approach.edge]),
    waitSeconds: numberOrNull(waits[approach.edge]),
    kappaSeconds: numberOrNull(kappa[approach.edge]),
    source: liveState ? 'live sensor sample' : 'last decision record',
  }));
}
