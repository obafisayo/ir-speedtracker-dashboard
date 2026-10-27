/**
 * Runs `task` repeatedly, waiting `intervalMs` after each run finishes, so slow
 * requests never overlap. Pauses while the tab is hidden and resumes immediately
 * when it becomes visible again.
 */
export function createPoller({ task, intervalMs, onSuccess, onError }) {
  let timer = null;
  let running = false;

  async function tick() {
    timer = null;
    try {
      onSuccess(await task());
    } catch (error) {
      onError(error);
    }
    if (running && !document.hidden) {
      timer = setTimeout(tick, intervalMs);
    }
  }

  function handleVisibility() {
    if (!running) return;
    if (document.hidden) {
      clearTimeout(timer);
      timer = null;
    } else if (timer === null) {
      tick();
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      document.addEventListener("visibilitychange", handleVisibility);
      tick();
    },
    stop() {
      running = false;
      clearTimeout(timer);
      timer = null;
      document.removeEventListener("visibilitychange", handleVisibility);
    },
  };
}
