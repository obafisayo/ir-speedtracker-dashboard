// Entry point: wires the API, the poller and the view together.
import { fetchSnapshot } from "./api.js";
import { POLL_INTERVAL_MS } from "./config.js";
import { createPoller } from "./poller.js";
import { createDashboardView } from "./view.js";

const view = createDashboardView();

const poller = createPoller({
  task: fetchSnapshot,
  intervalMs: POLL_INTERVAL_MS,
  onSuccess(snapshot) {
    view.setConnected(true);
    view.render(snapshot);
  },
  onError(error) {
    view.setConnected(false);
    console.warn(error);
  },
});

poller.start();
