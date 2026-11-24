// Camera stills from the controller.
//
// Contract, implemented by the Pi and replicated by simulation-bridge/mock_pi.py:
//
//   GET /cameras
//     -> [{ movement, camera_id, device, width, height }]
//
//   GET /snapshot/<movement>.jpg
//     -> 200 image/jpeg
//            X-Captured-At:   <epoch seconds, stamped by the controller>
//            X-Camera-Source: pi-usb | esp32 | simulated
//     -> 404 no camera is configured for that movement
//     -> 503 a camera is configured but has no frame right now
//
// The browser never talks to a camera directly. Credentials, capture backends
// and any ESP32 node stay on the controller, so adding a camera changes nothing
// in this file or in the panel.
import { piFetch } from './piBridge';

export const CAMERA_REFRESH_MS = 15000;
export const CAMERA_LIST_REFRESH_MS = 30000;
export const FRAME_STALE_MS = 60000;

const FRAME_TIMEOUT_MS = 5000;

function epochMillis(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  // Seconds (Pi) or milliseconds (anything JS-shaped) — normalize to ms.
  return value > 1e12 ? value : value * 1000;
}

/**
 * The controller's camera inventory. Optional: a controller that does not
 * implement /cameras still serves stills, so this never blocks the panel.
 */
export async function loadCameras(signal) {
  try {
    const response = await piFetch('/cameras', {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return { available: false, cameras: [] };

    const payload = await response.json();
    const cameras = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.cameras)
        ? payload.cameras
        : [];
    return { available: true, cameras: cameras.filter((camera) => camera?.movement) };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return { available: false, cameras: [] };
  }
}

/**
 * One still for a movement slug (`southbound`, `northbound`, ...).
 * A missing camera is an expected answer, not an exception.
 */
export async function loadCameraFrame(movement, signal) {
  let response;
  try {
    response = await piFetch(`/snapshot/${encodeURIComponent(movement)}.jpg`, {
      signal,
      headers: { Accept: 'image/jpeg' },
      timeoutMs: FRAME_TIMEOUT_MS,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return {
      status: 'error',
      message: error?.name === 'TimeoutError' ? 'Camera timed out' : 'Camera endpoint unreachable',
    };
  }

  if (response.status === 404) return { status: 'absent' };
  if (response.status === 503) return { status: 'unavailable' };
  if (!response.ok) return { status: 'error', message: `Controller answered ${response.status}` };

  const blob = await response.blob();
  if (!blob.size) return { status: 'unavailable' };

  return {
    status: 'frame',
    blob,
    capturedAt: epochMillis(response.headers.get('X-Captured-At')) ?? Date.now(),
    source: response.headers.get('X-Camera-Source'),
  };
}
