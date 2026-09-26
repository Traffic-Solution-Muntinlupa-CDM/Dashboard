export const SUMO_BRIDGE_URL = 'http://127.0.0.1:8765/api/v1/simulation/latest';

export async function loadSimulationSnapshot(signal) {
  const response = await fetch(SUMO_BRIDGE_URL, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`SUMO bridge returned ${response.status}`);
  const payload = await response.json();
  if (!payload?.available || payload.kind !== 'sumo-decision-log') {
    throw new Error(payload?.message || 'SUMO bridge has no available decision log');
  }
  return payload;
}

export function countFor(snapshot, name, fallback) {
  return snapshot?.approaches?.find((approach) => approach.name === name)?.observedVehicles ?? fallback;
}
