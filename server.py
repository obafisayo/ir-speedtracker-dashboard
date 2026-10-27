"""Laptop-side server for the IR speed tracker.

The Arduino POSTs each reading to /api/speed as JSON: {"time_s": 0.0412, "speed_mps": 2.427}.
The dashboard (static files in web/) polls /api/readings once a second.
Readings are kept in readings.csv.

Run:  python server.py [--port 8080]
Standard library only; no installs needed.
"""

import argparse
import csv
import json
import socket
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
WEB_ROOT = HERE / "web"
CSV_PATH = HERE / "readings.csv"
FIELDS = ["id", "received_at", "time_s", "speed_mps", "speed_kmh"]
MAX_RETURNED = 200

# Explicit types: on Windows, mimetypes can read .js as text/plain from the
# registry, which browsers refuse to run as an ES module.
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}

lock = threading.Lock()
readings = []


def load_history():
    if not CSV_PATH.exists():
        return
    with CSV_PATH.open(newline="") as f:
        for row in csv.DictReader(f):
            readings.append({
                "id": int(row["id"]),
                "received_at": row["received_at"],
                "time_s": float(row["time_s"]),
                "speed_mps": float(row["speed_mps"]),
                "speed_kmh": float(row["speed_kmh"]),
            })


def add_reading(data):
    time_s = float(data["time_s"])
    speed_mps = float(data["speed_mps"])
    if time_s <= 0 or speed_mps < 0:
        raise ValueError("time_s must be > 0 and speed_mps >= 0")

    with lock:
        reading = {
            "id": readings[-1]["id"] + 1 if readings else 1,
            "received_at": datetime.now().isoformat(timespec="seconds"),
            "time_s": time_s,
            "speed_mps": speed_mps,
            "speed_kmh": round(speed_mps * 3.6, 3),
        }
        readings.append(reading)
        new_file = not CSV_PATH.exists()
        with CSV_PATH.open("a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=FIELDS)
            if new_file:
                writer.writeheader()
            writer.writerow(reading)
    return reading


def snapshot():
    # Stats cover every reading; only the most recent MAX_RETURNED rows are sent
    with lock:
        speeds = [r["speed_kmh"] for r in readings]
        return {
            "readings": readings[-MAX_RETURNED:],
            "stats": {
                "count": len(speeds),
                "top_kmh": max(speeds) if speeds else None,
                "avg_kmh": round(sum(speeds) / len(speeds), 3) if speeds else None,
            },
        }


def resolve_static(url_path):
    """Map a URL path to a file inside WEB_ROOT, or None if it isn't servable."""
    relative = "index.html" if url_path == "/" else url_path.lstrip("/")
    file = (WEB_ROOT / relative).resolve()
    if not file.is_relative_to(WEB_ROOT) or not file.is_file():
        return None
    if file.suffix not in CONTENT_TYPES:
        return None
    return file


class Handler(BaseHTTPRequestHandler):
    def send_body(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, payload):
        self.send_body(status, json.dumps(payload).encode(), "application/json")

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/readings":
            self.send_json(200, snapshot())
            return
        file = resolve_static(path)
        if file is None:
            self.send_json(404, {"error": "not found"})
            return
        self.send_body(200, file.read_bytes(), CONTENT_TYPES[file.suffix])

    def do_POST(self):
        if urlsplit(self.path).path != "/api/speed":
            self.send_json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            reading = add_reading(json.loads(self.rfile.read(length)))
        except (ValueError, KeyError, TypeError) as exc:
            self.send_json(400, {"error": f"bad reading: {exc}"})
            return
        print(f"Reading #{reading['id']}: {reading['speed_mps']:.2f} m/s "
              f"({reading['speed_kmh']:.1f} km/h) in {reading['time_s']:.4f} s")
        self.send_json(201, reading)

    def log_message(self, fmt, *args):
        pass  # Silence per-request logs; the dashboard polls every second


def lan_ip():
    # Connecting a UDP socket sends nothing; it just picks the outbound interface
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def main():
    parser = argparse.ArgumentParser(description="IR speed tracker dashboard server")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    load_history()
    try:
        server = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    except OSError as exc:
        raise SystemExit(f"Can't use port {args.port} ({exc.strerror}). "
                         f"Another program has it; try: python server.py --port 5000")
    ip = lan_ip()
    print(f"Dashboard:      http://localhost:{args.port}")
    print(f"Arduino target: SERVER_HOST = \"{ip}\", SERVER_PORT = {args.port}")
    print(f"Loaded {len(readings)} saved reading(s). Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
