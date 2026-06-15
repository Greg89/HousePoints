import "dotenv/config";
import { buildApp } from "./app.js";
import { error, info } from "./logging.js";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const app = await buildApp();

info(app.log, "api.starting", { port });
await app.listen({ port, host: "0.0.0.0" });
info(app.log, "api.listening", { port });

let shutdownStarted = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  info(app.log, "api.stopping", { signal });

  try {
    await app.close();
  } catch (err) {
    error(app.log, "api.shutdown_failed", { signal }, err);
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
