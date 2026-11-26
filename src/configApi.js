// Runtime-config read/write for the Pi controller.
//
// deployed/pipeline/runtime_config.py validates a COMPLETE config object, and
// PUT /config atomically replaces the file. So a write is always
// read -> merge known fields -> send the whole object back. Nothing here builds
// a config from scratch; anything the form does not own is preserved exactly.
import { piRequest } from './piBridge';

const DEFAULT_BAND = '_default';

export class ConfigError extends Error {
  constructor(message, { status, field } = {}) {
    super(message);
    this.name = 'ConfigError';
    this.status = status;
    this.field = field;
  }
}

export const PRESETS = [
  {
    id: 'balanced',
    label: 'Balanced daytime',
    values: { minGreen: 10, maxGreen: 60, yellow: 10, pedDuration: 30 },
  },
  {
    id: 'peak',
    label: 'Weekday peak',
    values: { minGreen: 15, maxGreen: 60, yellow: 10, pedDuration: 30 },
  },
  {
    id: 'night',
    label: 'Night operation',
    values: { minGreen: 10, maxGreen: 45, yellow: 10, pedDuration: 20 },
  },
];

export const DISPATCH_MODES = [
  { value: 'bl_starv', label: 'Starvation-aware (bl_starv)' },
  { value: 'bl', label: 'Baseline (bl)' },
];

function numberOrBlank(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function defaultValue(container) {
  if (container && typeof container === 'object' && !Array.isArray(container)) {
    return container[DEFAULT_BAND];
  }
  return container;
}

function bandAt(config, index) {
  const band = config?.green?.band_seconds?.[DEFAULT_BAND];
  if (Array.isArray(band)) return numberOrBlank(band[index]);
  if (band !== undefined && band !== null) return numberOrBlank(band);
  return '';
}

/** Fill an editable form from a live runtime config (never mutates it). */
export function formFromConfig(config) {
  if (!config) return null;
  return {
    dispatchMode: config.dispatch?.mode ?? 'bl_starv',
    serveEmpty: Boolean(config.dispatch?.serve_empty),
    minGreen: bandAt(config, 0),
    maxGreen: bandAt(config, 1),
    yellow: numberOrBlank(config.timing?.yellow_seconds),
    pedDuration: numberOrBlank(config.green?.ped_duration),
    guardSeconds: numberOrBlank(defaultValue(config.backstops?.guard_seconds)),
    deadlineSeconds: numberOrBlank(defaultValue(config.backstops?.deadline_seconds)),
    pedQuota: numberOrBlank(config.backstops?.ped_quota_seconds),
  };
}

/**
 * Movements that carry an explicit override instead of the `_default` band.
 * Editing the default band does not change those, so the UI has to say so.
 */
export function configOverrides(config) {
  const names = new Set();
  for (const key of ['band_seconds']) {
    for (const movement of Object.keys(config?.green?.[key] ?? {})) {
      if (movement !== DEFAULT_BAND) names.add(movement);
    }
  }
  for (const key of ['guard_seconds', 'deadline_seconds']) {
    for (const movement of Object.keys(config?.backstops?.[key] ?? {})) {
      if (movement !== DEFAULT_BAND) names.add(movement);
    }
  }
  return [...names].sort();
}

function requireSeconds(value, label) {
  if (value === '' || value === null || value === undefined) {
    throw new ConfigError(`${label}: enter a value in seconds.`, { field: label });
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new ConfigError(`${label}: must be a non-negative number of seconds.`, { field: label });
  }
  return number;
}

function writeDefault(container, value) {
  if (container && typeof container === 'object' && !Array.isArray(container)) {
    container[DEFAULT_BAND] = value;
    return container;
  }
  return value;
}

const COMPARISONS = [
  ['Dispatch mode', (config) => config?.dispatch?.mode],
  ['Serve empty approaches', (config) => Boolean(config?.dispatch?.serve_empty)],
  ['Minimum green (s)', (config) => bandAt(config, 0)],
  ['Maximum green (s)', (config) => bandAt(config, 1)],
  ['Yellow interval (s)', (config) => config?.timing?.yellow_seconds],
  ['Pedestrian duration (s)', (config) => config?.green?.ped_duration],
  ['Guard threshold (s)', (config) => defaultValue(config?.backstops?.guard_seconds)],
  ['Deadline threshold (s)', (config) => defaultValue(config?.backstops?.deadline_seconds)],
  ['Pedestrian quota (s)', (config) => config?.backstops?.ped_quota_seconds],
];

/**
 * Build the full config to PUT plus a field-level change list.
 * Throws ConfigError (with a field label) before anything reaches the network.
 */
export function buildConfigUpdate(config, form) {
  if (!config) throw new ConfigError('Runtime config is not loaded from the controller.');
  if (!form) throw new ConfigError('No editable values are loaded.');

  const minGreen = requireSeconds(form.minGreen, 'Minimum green');
  const maxGreen = requireSeconds(form.maxGreen, 'Maximum green');
  if (maxGreen < minGreen) {
    throw new ConfigError('Maximum green must be greater than or equal to minimum green.', {
      field: 'Maximum green',
    });
  }
  const yellow = requireSeconds(form.yellow, 'Yellow interval');
  const pedDuration = requireSeconds(form.pedDuration, 'Pedestrian duration');
  const guardSeconds = requireSeconds(form.guardSeconds, 'Guard threshold');
  const deadlineSeconds = requireSeconds(form.deadlineSeconds, 'Deadline threshold');
  const pedQuota = requireSeconds(form.pedQuota, 'Pedestrian quota');

  if (guardSeconds > deadlineSeconds) {
    throw new ConfigError(
      'Guard threshold must not exceed the deadline threshold, or the deadline layer is shadowed.',
      { field: 'Guard threshold' },
    );
  }
  if (!['bl', 'bl_starv'].includes(form.dispatchMode)) {
    throw new ConfigError(`Dispatch mode: expected 'bl_starv' or 'bl'.`, { field: 'Dispatch mode' });
  }

  const next = JSON.parse(JSON.stringify(config));

  next.dispatch ??= {};
  next.dispatch.mode = form.dispatchMode;
  next.dispatch.serve_empty = Boolean(form.serveEmpty);

  next.green ??= {};
  next.green.band_seconds ??= {};
  next.green.band_seconds[DEFAULT_BAND] = [minGreen, maxGreen];
  next.green.ped_duration = pedDuration;

  next.timing ??= {};
  next.timing.yellow_seconds = yellow;

  next.backstops ??= {};
  next.backstops.guard_seconds = writeDefault(next.backstops.guard_seconds, guardSeconds);
  next.backstops.deadline_seconds = writeDefault(next.backstops.deadline_seconds, deadlineSeconds);
  next.backstops.ped_quota_seconds = pedQuota;

  const changes = COMPARISONS.map(([label, read]) => ({
    label,
    from: read(config),
    to: read(next),
  })).filter((change) => String(change.from) !== String(change.to));

  return { next, changes };
}

/** GET /config. A 404 means the controller was booted without the runtime JSON. */
export async function loadRuntimeConfig(signal) {
  const response = await piRequest('/config', { signal, timeoutMs: 5000 });

  if (response.status === 404) {
    return {
      mounted: false,
      config: null,
      message:
        response.payload?.error ||
        'The controller has no runtime config mounted, so editing is disabled.',
    };
  }
  if (!response.ok) {
    const message = response.payload?.error
      || (response.status >= 500 ? 'Controller unreachable.' : `Controller answered ${response.status}`);
    throw new ConfigError(message, { status: response.status });
  }
  return { mounted: true, config: response.payload, message: null };
}

function fieldFromMessage(message) {
  const match = /^invalid config:\s*([^:]+):\s*(.*)$/.exec(String(message));
  return match ? match[1].trim() : null;
}

/** PUT /config and translate the controller's 400 into a field-level error. */
export async function saveRuntimeConfig(config, signal) {
  const response = await piRequest('/config', {
    method: 'PUT',
    body: config,
    signal,
    timeoutMs: 8000,
  });

  if (!response.ok) {
    const message = response.payload?.error
      || (response.status >= 500 ? 'Controller unreachable.' : `Controller answered ${response.status}`);
    throw new ConfigError(message, { status: response.status, field: fieldFromMessage(message) });
  }
  return response.payload;
}
