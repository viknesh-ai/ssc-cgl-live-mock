/**
 * Application entry point.
 *
 * Next.js handles every HTTP request; the same server also answers the /ws
 * upgrade so exam state, chat and camera signalling travel over one port —
 * which is all Railway exposes.
 */
import { createServer } from "node:http";
import next from "next";
import { loadLocalEnv } from "@/lib/load-env";
import { attachRealtime } from "@/server/realtime";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
// Not HOSTNAME: container runtimes set that to the container id, and binding to
// it makes the app unreachable from the platform's proxy and health checks.
const hostname = process.env.BIND_HOST ?? "0.0.0.0";

async function main() {
  loadLocalEnv();
  const app = next({ dev, hostname, port });
  await app.prepare();
  const handle = app.getRequestHandler();

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("[http]", err);
      res.statusCode = 500;
      res.end("Internal server error");
    });
  });

  attachRealtime(server);

  server.listen(port, hostname, () => {
    console.log(`ssc-cgl-live-mock listening on http://${hostname}:${port} (${dev ? "dev" : "production"})`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
