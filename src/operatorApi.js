// Client for the controller's operator endpoints.
//
// Contract implemented by deployed/pipeline/rest.py:
//   GET    /signals   heads + the signal timing envelope
//   GET    /override  the active program, or {active:false}
//   POST   /override  {"steps":[{phase,seconds}], "mode":"once"|"loop",
//                      "max_duration_seconds"?, "reason"?}  -> 202
//   DELETE /override  cancel -> 202 {"status":"cancelling"}
import { piRequest } from './piBridge';

export class OperatorError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'OperatorError';
    this.status = status;
  }
}

function errorFrom(response) {
  return response.payload?.error || `Controller answered ${response.status}`;
}

export async function loadSignals(signal) {
  const response = await piRequest('/signals', { signal });
  if (response.status === 503) {
    return { available: false, message: errorFrom(response) };
  }
  if (!response.ok) {
    return { available: false, message: errorFrom(response) };
  }
  return {
    available: true,
    heads: Array.isArray(response.payload?.heads) ? response.payload.heads : [],
    timing: response.payload?.timing ?? {},
  };
}

export async function loadOverride(signal) {
  const response = await piRequest('/override', { signal });
  if (!response.ok) {
    return { available: false, active: false, message: errorFrom(response) };
  }
  return { available: true, ...(response.payload ?? {}) };
}

export async function startOverride(program, signal) {
  const response = await piRequest('/override', {
    method: 'POST',
    body: program,
    signal,
    timeoutMs: 6000,
  });
  if (!response.ok) throw new OperatorError(errorFrom(response), response.status);
  return response.payload ?? {};
}

export async function cancelOverride(signal) {
  const response = await piRequest('/override', {
    method: 'DELETE',
    signal,
    timeoutMs: 6000,
  });
  if (!response.ok) throw new OperatorError(errorFrom(response), response.status);
  return response.payload ?? {};
}
