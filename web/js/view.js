import { FLASH_DURATION_MS, RECENT_ROW_LIMIT } from "./config.js";
import {
  formatClockTime,
  formatKmh,
  formatMps,
  formatRelative,
  formatSeconds,
} from "./format.js";

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Dashboard markup is missing #${id}`);
  return element;
}

function cell(text, className) {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function readingRow(reading) {
  const tr = document.createElement("tr");
  tr.append(
    cell(String(reading.id)),
    cell(formatClockTime(reading.received_at), "hide-sm"),
    cell(formatSeconds(reading.time_s)),
    cell(formatMps(reading.speed_mps)),
    cell(reading.speed_kmh.toFixed(1)),
  );
  return tr;
}

/** Owns every DOM write on the page. */
export function createDashboardView() {
  const el = {
    statusDot: byId("status-dot"),
    statusText: byId("status-text"),
    hero: byId("hero"),
    latestSpeed: byId("latest-speed"),
    latestDetail: byId("latest-detail"),
    statCount: byId("stat-count"),
    statTop: byId("stat-top"),
    statAvg: byId("stat-avg"),
    readingsBody: byId("readings-body"),
  };
  let lastSeenId = null;

  function flashHero() {
    el.hero.classList.add("is-flashing");
    setTimeout(() => el.hero.classList.remove("is-flashing"), FLASH_DURATION_MS);
  }

  function renderLatest(latest) {
    el.latestSpeed.textContent = latest.speed_kmh.toFixed(1);
    el.latestDetail.textContent = [
      `${formatMps(latest.speed_mps)} m/s`,
      `${formatSeconds(latest.time_s)} through the gate`,
      formatRelative(latest.received_at),
    ].join(" · ");

    if (lastSeenId !== null && latest.id !== lastSeenId) flashHero();
    lastSeenId = latest.id;
  }

  function renderStats(stats) {
    el.statCount.textContent = String(stats.count);
    el.statTop.textContent = formatKmh(stats.top_kmh);
    el.statAvg.textContent = formatKmh(stats.avg_kmh);
  }

  function renderTable(readings) {
    const rows = readings.slice(-RECENT_ROW_LIMIT).reverse().map(readingRow);
    if (rows.length) el.readingsBody.replaceChildren(...rows);
  }

  return {
    setConnected(connected) {
      el.statusDot.classList.toggle("is-live", connected);
      el.statusText.textContent = connected ? "Live" : "Server unreachable";
    },

    /** @param {import("./api.js").Snapshot} snapshot */
    render({ readings, stats }) {
      renderStats(stats);
      if (!readings.length) return;
      renderLatest(readings[readings.length - 1]);
      renderTable(readings);
    },
  };
}
