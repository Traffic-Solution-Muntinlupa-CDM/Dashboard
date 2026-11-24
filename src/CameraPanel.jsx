import { useEffect, useRef, useState } from 'react';
import Badge from './Badge';
import MiniIntersection from './MiniIntersection';
import { movementSlug } from './controllerContract';
import { CAMERA_REFRESH_MS, FRAME_STALE_MS, loadCameraFrame } from './cameraBridge';

const STATE_COPY = {
  loading: 'Reading still from the controller…',
  absent: 'No camera for this movement',
  unavailable: 'Camera configured, but not sending frames',
  error: 'Camera request failed',
};

function formatAge(seconds) {
  if (seconds == null) return 'age unknown';
  if (seconds < 60) return `${seconds} s old`;
  return `${Math.round(seconds / 60)} min old`;
}

/**
 * Overview camera area: the still for the active movement, falling back to the
 * schematic when there is no frame.
 *
 * Deliberately not a live video feed. A slow still is enough for the demo and
 * keeps the Pi (and any camera node behind it) cheap. The capture timestamp
 * comes from the controller, so a frozen or stale image is visible as such
 * instead of quietly passing for live footage.
 */
export default function CameraPanel({ phase, sourceLabel, cameras, camerasKnown }) {
  const slug = movementSlug(phase);
  const camera = cameras.find((entry) => entry.movement === slug) ?? null;
  // When the controller publishes its camera inventory, a movement that is not
  // in it is answered locally instead of with a request that can only 404.
  const skipFetch = Boolean(camerasKnown) && !camera;
  const [frame, setFrame] = useState({ status: 'loading' });
  const [now, setNow] = useState(() => Date.now());
  const urlRef = useRef(null);

  useEffect(() => {
    if (!slug || skipFetch) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    const release = () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };

    const load = async () => {
      try {
        const next = await loadCameraFrame(slug, controller.signal);
        if (cancelled) return;
        if (next.status === 'frame') {
          const url = URL.createObjectURL(next.blob);
          release();
          urlRef.current = url;
          setFrame({ ...next, url });
          setNow(Date.now());
        } else {
          release();
          setFrame(next);
        }
      } catch (error) {
        if (cancelled || error?.name === 'AbortError') return;
        release();
        setFrame({ status: 'error', message: error.message });
      }
    };

    load();
    const id = setInterval(load, CAMERA_REFRESH_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
      release();
    };
  }, [slug, skipFetch]);

  useEffect(() => {
    if (skipFetch || !slug || frame.status !== 'frame') return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [slug, skipFetch, frame.status]);

  const status = !slug || skipFetch ? 'absent' : frame.status;
  const ageSeconds = status === 'frame' && frame.capturedAt
    ? Math.max(0, Math.round((now - frame.capturedAt) / 1000))
    : null;
  const stale = ageSeconds != null && ageSeconds * 1000 > FRAME_STALE_MS;
  const device = camera?.device ?? frame.source ?? null;

  if (status === 'frame') {
    return (
      <div className="camera-panel">
        <figure className="camera-frame">
          <img src={frame.url} alt={`${phase} camera still`} />
          <div className="camera-overlay">
            <span className="camera-movement">{phase}</span>
            <Badge tone={stale ? 'warning' : 'ok'}>{stale ? 'Stale still' : 'Still frame'}</Badge>
          </div>
          <div className="camera-overlay bottom">
            <span>{device ?? 'Camera'}</span>
            <span>{formatAge(ageSeconds)}</span>
          </div>
        </figure>
      </div>
    );
  }

  return (
    <div className="camera-panel">
      <div className="camera-fallback">
        <MiniIntersection phase={phase} caption={sourceLabel} />
        <p className="camera-state">
          <b>{STATE_COPY[status] ?? STATE_COPY.error}</b>
          {status === 'absent' && ' — showing the schematic instead.'}
          {status === 'unavailable' && ' — the schematic stands in until a frame arrives.'}
          {status === 'error' && ` — ${frame.message ?? 'request failed'}.`}
        </p>
      </div>
    </div>
  );
}
