// Pure display formatters. No DOM access here.

export const PLACEHOLDER = "—";

export function formatKmh(value) {
  return value == null ? PLACEHOLDER : `${value.toFixed(1)} km/h`;
}

export function formatMps(value) {
  return value.toFixed(2);
}

export function formatSeconds(value) {
  return `${value.toFixed(4)} s`;
}

export function formatClockTime(iso) {
  return new Date(iso).toLocaleTimeString();
}

export function formatRelative(iso, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return new Date(iso).toLocaleString();
}
