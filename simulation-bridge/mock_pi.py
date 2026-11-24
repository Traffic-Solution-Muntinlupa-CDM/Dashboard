"""Mock Raspberry Pi controller for dashboard development.

Speaks the same REST contract as deployed/pipeline/rest.py so the dashboard can
be built and demonstrated without the prototype:

    GET  /health   {"status":"ok", ...}            always 200 while running
    GET  /current  latest decision record          404 until the first decision
    GET  /live     ~1 Hz sampled state             200 after the first tick
    GET  /config   the runtime config              404 when not mounted
    PUT  /config   validate + atomically replace   200 / 400 / 404

Differences from the real server, all deliberate:

* /health carries ``"simulated": true`` and a service name. The dashboard reads
  that flag and labels the source "Controller simulator" instead of "Field
  controller", so a demo can never be mistaken for live telemetry.
* CORS headers are sent. The real server does not need them because the browser
  uses the Vite proxy, but the mock should still work when fetched directly.
* Phase timing is a simple round-robin with a starvation override, not the PPO
  policy. The record *shape* is the contract; the decisions are filler.

Usage:
    py simulation-bridge/mock_pi.py                 # http://127.0.0.1:8080
    py simulation-bridge/mock_pi.py --speed 4       # four times faster
"""

from __future__ import annotations

import argparse
import json
import random
import tempfile
import threading
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Phase order matches config/default.yaml `phase_index`.
PHASE_NAMES = ["southbound", "brudger", "northbound", "estanislao", "cityhall", "pedestrian"]
PEDESTRIAN_PHASE = 5
EDGES = [
    "northbound_entrance",
    "southbound_entrance",
    "cityhall_exit",
    "brudger_exit",
    "estanislao_exit",
]
EDGE_FOR_PHASE = {
    0: "southbound_entrance",
    1: "brudger_exit",
    2: "northbound_entrance",
    3: "estanislao_exit",
    4: "cityhall_exit",
}

FRAMES_DIR = Path(__file__).resolve().parent / "frames"

# The two demo heads have cameras; the other three movements answer 404, which
# is what the deployed controller will do until those cameras exist. The panel's
# "no camera" state is therefore exercised by the mock, not simulated away.
CAMERAS = [
    {
        "movement": "southbound",
        "camera_id": "cam-sb",
        "device": "Simulated USB camera",
        "width": 960,
        "height": 540,
    },
    {
        "movement": "northbound",
        "camera_id": "cam-nb",
        "device": "Simulated head camera",
        "width": 960,
        "height": 540,
    },
]

# Seeded from deployed/data/deploy_config.json (the shipped locked defaults).
DEFAULT_CONFIG = {
    "version": 1,
    "dispatch": {
        "mode": "bl_starv",
        "beta": 0.1,
        "ped_merit_base": 28.0,
        "ped_merit_beta": 0.1,
        "ch_threshold": None,
        "serve_empty": False,
    },
    "green": {
        "gamma": 1.6,
        "n_buckets": 11,
        "band_seconds": {"_default": [10, 60]},
        "ped_duration": 30,
    },
    "backstops": {
        "guard_seconds": {"_default": 350},
        "deadline_seconds": {"_default": 450},
        "ped_quota_seconds": 120,
    },
    "timing": {"yellow_seconds": 10, "amber_redclearance": None},
    "detection": {"ped_source": "button", "weather_source": "obs"},
}


class InvalidConfigError(Exception):
    """Mirrors deploy_config.InvalidConfigError's message style."""


def _number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _require_number(raw, path, *, allow_none=False):
    if path not in raw:
        return
    value = raw[path]
    if value is None and allow_none:
        return
    if not _number(value):
        raise InvalidConfigError(f"{path}: expected a number")


def _require_seconds(value, path):
    if not _number(value) or value < 0:
        raise InvalidConfigError(f"{path}: expected a non-negative number of seconds")


def _resolve(container):
    if isinstance(container, dict):
        return container.get("_default")
    return container


def validate(raw):
    """Structural validation of the fields the dashboard can edit."""
    if not isinstance(raw, dict):
        raise InvalidConfigError("config root: expected an object")

    version = raw.get("version")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise InvalidConfigError("version: expected a positive integer")

    dispatch = raw.get("dispatch")
    if not isinstance(dispatch, dict):
        raise InvalidConfigError("dispatch: expected an object")
    if dispatch.get("mode") not in ("bl", "bl_starv"):
        raise InvalidConfigError("dispatch.mode: expected 'bl' or 'bl_starv'")
    for key in ("beta", "ped_merit_base", "ped_merit_beta"):
        _require_number(dispatch, key)
    _require_number(dispatch, "ch_threshold", allow_none=True)
    if "serve_empty" in dispatch and not isinstance(dispatch["serve_empty"], bool):
        raise InvalidConfigError("dispatch.serve_empty: expected true or false")

    green = raw.get("green")
    if not isinstance(green, dict):
        raise InvalidConfigError("green: expected an object")
    _require_number(green, "gamma")
    if "n_buckets" in green and not isinstance(green["n_buckets"], int):
        raise InvalidConfigError("green.n_buckets: expected an integer")
    bands = green.get("band_seconds")
    if not isinstance(bands, dict):
        raise InvalidConfigError("green.band_seconds: expected an object")
    if "_default" not in bands:
        raise InvalidConfigError("green.band_seconds._default: expected [min, max]")
    for movement, band in bands.items():
        if not isinstance(band, list) or len(band) != 2:
            raise InvalidConfigError(
                f"green.band_seconds.{movement}: expected [min_seconds, max_seconds]"
            )
        low, high = band
        _require_seconds(low, f"green.band_seconds.{movement}[0]")
        _require_seconds(high, f"green.band_seconds.{movement}[1]")
        if high < low:
            raise InvalidConfigError(
                f"green.band_seconds.{movement}: max must be >= min"
            )
    _require_seconds(green.get("ped_duration"), "green.ped_duration")

    timing = raw.get("timing")
    if not isinstance(timing, dict):
        raise InvalidConfigError("timing: expected an object")
    _require_seconds(timing.get("yellow_seconds"), "timing.yellow_seconds")

    backstops = raw.get("backstops")
    if not isinstance(backstops, dict):
        raise InvalidConfigError("backstops: expected an object")
    for key in ("guard_seconds", "deadline_seconds"):
        resolved = _resolve(backstops.get(key))
        if resolved is None:
            raise InvalidConfigError(f"backstops.{key}: expected seconds")
        _require_seconds(resolved, f"backstops.{key}")
    _require_seconds(backstops.get("ped_quota_seconds"), "backstops.ped_quota_seconds")

    return raw


def iso_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def atomic_write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


class MockController:
    """Tiny closed loop: drift sensor counts, decide, serve /current + /live."""

    def __init__(self, config_path: Path, seed: int = 7, speed: float = 1.0):
        self.config_path = config_path
        self.speed = max(0.1, float(speed))
        self.rng = random.Random(seed)
        self.lock = threading.Lock()

        self.config = json.loads(config_path.read_text(encoding="utf-8"))
        validate(self.config)

        self.started = time.time()
        self.phase = 0
        self.duration = self._bucket(self.config["green"]["band_seconds"]["_default"])
        self.yellow = float(self.config["timing"]["yellow_seconds"])
        self.next_decision = self.started + 2.0

        self.counts = {edge: self.rng.randint(0, 9) for edge in EDGES}
        self.waits = {edge: 0.0 for edge in EDGES}
        self.last_served = {edge: self.started for edge in EDGES}

        self.button_pressed = 0
        self.pressed_at = None
        self.live_ts = self.started
        self.latest = None

    # -- config helpers ------------------------------------------------------
    def _band(self):
        band = self.config["green"]["band_seconds"].get("_default", [10, 60])
        return float(band[0]), float(band[1])

    def _bucket(self, band):
        low, high = float(band[0]), float(band[1])
        gamma = float(self.config["green"].get("gamma", 1.6))
        count = max(2, int(self.config["green"].get("n_buckets", 11)))
        grid = [low + (high - low) * ((i / (count - 1)) ** gamma) for i in range(count)]
        return float(round(self.rng.choice(grid)))

    def _guard_threshold(self):
        raw = self.config["backstops"].get("guard_seconds")
        value = _resolve(raw)
        return float(value if value is not None else 350.0)

    def replace_config(self, raw):
        self.config = validate(raw)
        with self.lock:
            self.yellow = float(self.config["timing"]["yellow_seconds"])

    # -- the loop ------------------------------------------------------------
    def tick(self):
        now = time.time()
        with self.lock:
            elapsed = now - self.live_ts
            if elapsed >= 1.0 / self.speed:
                self._sample(now)
                self.live_ts = now
            if now >= self.next_decision:
                self._decide(now)

    def _sample(self, now):
        for edge in EDGES:
            if self.rng.random() < 0.45:
                delta = self.rng.choice([-2, -1, 0, 1, 2])
                self.counts[edge] = max(0, min(30, self.counts[edge] + delta))
            self.waits[edge] = max(0.0, now - self.last_served[edge])

        if self.pressed_at is None and self.rng.random() < 0.03:
            self.pressed_at = now
            self.button_pressed = 1

    def _decide(self, now):
        source = "policy"
        override_reason = None

        if self.phase != PEDESTRIAN_PHASE:
            starved = max(EDGES, key=lambda edge: self.waits[edge])
            if self.waits[starved] > self._guard_threshold():
                source = "guard"
                override_reason = starved
                self.phase = next(
                    (index for index, edge in EDGE_FOR_PHASE.items() if edge == starved),
                    self.phase,
                )

        if self.phase == PEDESTRIAN_PHASE:
            duration = float(self.config["green"].get("ped_duration", 30))
            self.button_pressed = 0
            self.pressed_at = None
        else:
            duration = self._bucket(self.config["green"]["band_seconds"]["_default"])
            edge = EDGE_FOR_PHASE.get(self.phase)
            if edge is not None:
                self.last_served[edge] = now

        # Record the wall-clock duration, so acceleration cannot make the
        # dashboard's countdown disagree with the record it is reading.
        served = duration / self.speed
        yellow = self.yellow / self.speed
        phase = self.phase
        probs = [0.0] * len(PHASE_NAMES)
        probs[phase] = 1.0
        if phase != PEDESTRIAN_PHASE:
            probs = [self.rng.random() for _ in PHASE_NAMES]
            total = sum(probs) or 1.0
            probs = [round(value / total, 4) for value in probs]

        record = {
            "ts": now,
            "sim_time": int(now - self.started),
            "phase": phase,
            "phase_name": PHASE_NAMES[phase],
            "duration": served,
            "yellow": yellow,
            "source": source,
            "override_reason": override_reason,
            "queues": dict(self.counts),
            "waits": {edge: round(self.waits[edge], 1) for edge in EDGES},
            "pressed": bool(self.button_pressed),
            "press_age": (
                round(now - self.pressed_at, 1) if self.pressed_at is not None else 0.0
            ),
            "phase_probs": probs,
        }
        self.latest = record

        # Advance the rotation. The real policy can re-serve a movement; a
        # round-robin keeps the mock visibly moving without pretending to be it.
        self.phase = (phase + 1) % len(PHASE_NAMES)

        self.next_decision = now + served + yellow

    # -- views ---------------------------------------------------------------
    def live_snapshot(self):
        now = time.time()
        with self.lock:
            phase = self.latest["phase"] if self.latest else self.phase
            return {
                "button_pressed": self.button_pressed,
                "press_age": (
                    round(now - self.pressed_at, 1) if self.pressed_at is not None else 0.0
                ),
                "pressed_at": self.pressed_at,
                "press_step": self.pressed_at,
                "ts": now,
                "updated_at": now,
                "phase_name": PHASE_NAMES[phase],
                "phase": phase,
                "source": self.latest["source"] if self.latest else None,
                "source_scope": "last_decision",
                "counts": dict(self.counts),
                "waits": {edge: round(self.waits[edge], 1) for edge in EDGES},
                "kappa": {edge: round(min(self.waits[edge], 23000.0), 1) for edge in EDGES},
            }


def _build_handler(controller: MockController):
    class Handler(BaseHTTPRequestHandler):
        server_version = "ANDARMockController/1.0"

        def end_headers(self):  # noqa: N802 (stdlib casing)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def do_OPTIONS(self):  # noqa: N802
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):  # noqa: N802
            if self.path == "/health":
                self._json(
                    HTTPStatus.OK,
                    {
                        "status": "ok",
                        "service": "ANDAR mock controller (contract replica)",
                        "simulated": True,
                        "message": "Mock controller — the deployed Raspberry Pi is not connected.",
                        "now": iso_now(),
                    },
                )
            elif self.path == "/current":
                latest = controller.latest
                if latest is None:
                    self._json(HTTPStatus.NOT_FOUND, {"error": "no decision yet"})
                else:
                    self._json(HTTPStatus.OK, latest)
            elif self.path == "/live":
                self._json(HTTPStatus.OK, controller.live_snapshot())
            elif self.path == "/config":
                self._json(HTTPStatus.OK, controller.config)
            elif self.path == "/cameras":
                self._json(HTTPStatus.OK, CAMERAS)
            elif self.path.startswith("/snapshot/"):
                self._snapshot()
            else:
                self._json(
                    HTTPStatus.NOT_FOUND,
                    {
                        "error": "not found",
                        "paths": ["/health", "/current", "/live", "/config", "/cameras",
                                  "/snapshot/<movement>.jpg"],
                    },
                )

        def _snapshot(self):
            movement = self.path[len("/snapshot/"):]
            if movement.endswith(".jpg"):
                movement = movement[:-4]

            entry = next((cam for cam in CAMERAS if cam["movement"] == movement), None)
            if entry is None:
                self._json(
                    HTTPStatus.NOT_FOUND,
                    {"error": f"no camera configured for movement {movement!r}"},
                )
                return

            path = FRAMES_DIR / f"{movement}.jpg"
            try:
                data = path.read_bytes()
            except OSError:
                self._json(
                    HTTPStatus.SERVICE_UNAVAILABLE,
                    {"error": f"camera {entry['camera_id']} has no frame"},
                )
                return

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("X-Captured-At", f"{time.time():.3f}")
            self.send_header("X-Camera-Source", "simulated")
            self.end_headers()
            self.wfile.write(data)

        def do_PUT(self):  # noqa: N802
            if self.path != "/config":
                self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                return
            length = int(self.headers.get("Content-Length", "0") or 0)
            body = self.rfile.read(length).decode("utf-8") if length else ""
            try:
                raw = json.loads(body)
            except Exception:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "body must be valid JSON"})
                return
            try:
                validate(raw)
            except InvalidConfigError as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": f"invalid config: {exc}"})
                return
            try:
                atomic_write(controller.config_path, raw)
                controller.replace_config(raw)
            except OSError as exc:
                self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"write failed: {exc}"})
                return
            self._json(
                HTTPStatus.OK,
                {"status": "applied", "path": str(controller.config_path), "simulated": True},
            )

        def _json(self, status, payload):
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, fmt, *args):  # keep the demo console readable
            return

    return Handler


def _config_path(explicit):
    if explicit:
        return Path(explicit).expanduser().resolve()
    base = Path(tempfile.gettempdir()) / "andar-mock-controller"
    path = base / "deploy_config.json"
    if not path.exists():
        atomic_write(path, DEFAULT_CONFIG)
    return path


def main():
    parser = argparse.ArgumentParser(description="Mock ANDAR controller REST surface")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8080, type=int)
    parser.add_argument("--speed", default=1.0, type=float, help="simulation speed multiplier")
    parser.add_argument("--seed", default=7, type=int)
    parser.add_argument("--config", type=Path, default=None, help="deploy_config.json to serve")
    args = parser.parse_args()

    config_path = _config_path(args.config)
    controller = MockController(config_path, seed=args.seed, speed=args.speed)

    def loop():
        while True:
            controller.tick()
            time.sleep(0.1)

    threading.Thread(target=loop, daemon=True, name="mock-controller").start()

    server = ThreadingHTTPServer((args.host, args.port), _build_handler(controller))
    print(f"ANDAR mock controller on http://{args.host}:{args.port}")
    print(f"  runtime config: {config_path}")
    print("  routes: /health /current /live GET|PUT /config /cameras /snapshot/<movement>.jpg")
    print("  source flag: simulated=true (the dashboard labels this 'Controller simulator')")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
