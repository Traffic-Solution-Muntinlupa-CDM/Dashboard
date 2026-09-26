"""Read-only local bridge from existing SUMO decision logs to a dashboard.

This module deliberately exposes historical simulator observations only.  It
does not start SUMO, load a PPO checkpoint, or accept signal-control commands.
Run it beside a completed or actively-writing SUMO evaluation:

    py v6/dashboard_bridge.py --port 8765

The browser can then poll http://127.0.0.1:8765/api/v1/simulation/latest.
"""

from __future__ import annotations

import argparse
import csv
import json
import mimetypes
from datetime import UTC, datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent
LOG_DIR = ROOT / "logs" / "decisions"
PHASES = ["Southbound", "Brudger", "Northbound", "Estanislao", "City Hall", "Pedestrian"]
APPROACH_COLUMNS = {
    "Northbound": "north",
    "Southbound": "south",
    "City Hall": "cityhall",
    "Brudger": "brudger",
    "Estanislao": "estanislao",
}


def iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def decision_files(scenario: str | None) -> list[Path]:
    candidates = sorted(LOG_DIR.glob("decisions_*_*.csv"), key=lambda p: p.stat().st_mtime, reverse=True)
    if scenario:
        candidates = [p for p in candidates if f"decisions_{scenario}_" in p.name]
    return candidates


def read_latest_row(scenario: str | None) -> tuple[Path, dict[str, str]] | None:
    for path in decision_files(scenario):
        with path.open(newline="", encoding="utf-8") as file:
            rows = list(csv.DictReader(file))
        if rows:
            return path, rows[-1]
    return None


def as_number(row: dict[str, str], field: str, fallback: float = 0) -> float:
    try:
        return float(row.get(field, fallback))
    except (TypeError, ValueError):
        return fallback


def snapshot(scenario: str | None) -> dict:
    result = read_latest_row(scenario)
    if result is None:
        return {
            "schemaVersion": "1.0",
            "kind": "sumo-decision-log",
            "available": False,
            "generatedAt": iso_now(),
            "message": "No SUMO decision log is available. Run an evaluation first.",
        }

    path, row = result
    phase_index = int(as_number(row, "chosen_phase"))
    phase_name = PHASES[phase_index] if 0 <= phase_index < len(PHASES) else "Unknown"
    approaches = []
    for name, prefix in APPROACH_COLUMNS.items():
        approaches.append({
            "name": name,
            "observedVehicles": int(as_number(row, f"{prefix}_count")),
            "maxWaitingTimeNormalized": as_number(row, f"{prefix}_wait_norm"),
            "emergencyVehiclePresent": bool(as_number(row, f"{prefix}_ev")),
            "source": "SUMO lane-area detector",
        })

    return {
        "schemaVersion": "1.0",
        "kind": "sumo-decision-log",
        "available": True,
        "generatedAt": iso_now(),
        "sourceFile": path.name,
        "sourceModifiedAt": datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat().replace("+00:00", "Z"),
        "simulation": {
            "scenario": path.name.removeprefix("decisions_").rsplit("_", 1)[0],
            "decisionStep": int(as_number(row, "step")),
            "weatherScalar": as_number(row, "weather"),
            "dayNormalized": as_number(row, "day_norm"),
            "timeOfDayNormalized": as_number(row, "time_of_day"),
        },
        "controllerDecision": {
            "phase": phase_name,
            "phaseIndex": phase_index,
            "greenSeconds": int(as_number(row, "actual_seconds")),
            "timePercentage": as_number(row, "time_pct"),
            "semantics": "Recorded simulator decision; not controller-confirmed field telemetry.",
        },
        "pedestrian": {
            "requestPresent": bool(as_number(row, "ped_exists")),
            "maxWaitingTimeNormalized": as_number(row, "ped_wait_norm"),
        },
        "approaches": approaches,
        "readOnly": True,
        "controlCommandsSupported": False,
    }


class BridgeHandler(BaseHTTPRequestHandler):
    server_version = "ANDARSimulationBridge/1.0"

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def respond(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        scenario = query.get("scenario", [None])[0]
        if parsed.path == "/health":
            self.respond({"status": "ok", "service": "ANDAR SUMO read-only bridge", "generatedAt": iso_now()})
        elif parsed.path == "/api/v1/simulation/latest":
            self.respond(snapshot(scenario))
        elif parsed.path == "/api/v1/simulation/sources":
            self.respond({"availableLogs": [p.name for p in decision_files(scenario)], "generatedAt": iso_now()})
        else:
            self.respond({"error": "not_found", "paths": ["/health", "/api/v1/simulation/latest", "/api/v1/simulation/sources"]}, HTTPStatus.NOT_FOUND)

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}")


def main() -> None:
    global LOG_DIR
    parser = argparse.ArgumentParser(description="Read-only ANDAR SUMO dashboard bridge")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument("--log-dir", type=Path, default=LOG_DIR, help="SUMO decision-log directory")
    args = parser.parse_args()
    LOG_DIR = args.log_dir.resolve()
    server = ThreadingHTTPServer((args.host, args.port), BridgeHandler)
    print(f"ANDAR SUMO read-only bridge on http://{args.host}:{args.port}")
    print("Routes: /health, /api/v1/simulation/latest, /api/v1/simulation/sources")
    server.serve_forever()


if __name__ == "__main__":
    main()
