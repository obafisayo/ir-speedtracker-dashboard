# IR Speed Tracker

Two IR sensors on an Arduino Uno WiFi Rev2 time a car between them, and the board
POSTs each speed reading to a small Python server on a laptop. The server shows the
readings on a live dashboard in the browser.

## Run

```bash
python server.py            # http://localhost:8080
python server.py --port 5000
```

On startup the server prints the laptop IP to put in `SERVER_HOST` in the sketch.
Python 3.9+ standard library only; nothing to install.

## Layout

```
ir-speedtracker.cpp   Arduino sketch: edge-triggered timing + WiFi POST
server.py             HTTP server: API, CSV storage, static file serving
readings.csv          Saved readings (created on first reading)
web/
  index.html          Dashboard markup
  css/
    tokens.css        Colour/spacing variables, light + dark
    base.css          Reset and page layout
    components.css    Card, status, hero, stats, table
  js/
    main.js           Entry point: wires api → poller → view
    config.js         Poll interval, row limit, endpoints
    api.js            fetchSnapshot() + response types
    poller.js         Non-overlapping polling, pauses when the tab is hidden
    format.js         Pure number/time formatters
    view.js           All DOM updates
```

## API

| Method | Path            | Body / response |
|--------|-----------------|-----------------|
| POST   | `/api/speed`    | `{"time_s": 0.04, "speed_mps": 2.5}` → `201` with the stored reading |
| GET    | `/api/readings` | `{"readings": [...last 200], "stats": {"count", "top_kmh", "avg_kmh"}}` |

Stats are computed over every saved reading, not just the 200 returned.

Send a test reading without the Arduino:

```bash
curl -X POST localhost:8080/api/speed -d '{"time_s":0.04,"speed_mps":2.5}'
```
