import { READINGS_URL } from "./config.js";

/**
 * @typedef {Object} Reading
 * @property {number} id
 * @property {string} received_at  ISO timestamp (server local time)
 * @property {number} time_s       Time between the two sensors
 * @property {number} speed_mps
 * @property {number} speed_kmh
 *
 * @typedef {Object} Stats
 * @property {number} count
 * @property {number|null} top_kmh
 * @property {number|null} avg_kmh
 *
 * @typedef {Object} Snapshot
 * @property {Reading[]} readings  Most recent readings, oldest first
 * @property {Stats} stats         Computed over every reading, not just those returned
 */

/** @returns {Promise<Snapshot>} */
export async function fetchSnapshot() {
  const response = await fetch(READINGS_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`GET ${READINGS_URL} failed: HTTP ${response.status}`);
  }
  return response.json();
}
