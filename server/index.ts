import { createAdaptorServer } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { upgradeHookExtension } from "./long-cache-store.js";
import { getEffectiveCatalog } from "./pi-catalog.js";
import { api } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8787);
const isProd = process.env.NODE_ENV === "production";

const app = new Hono();

app.route("/api", api);

if (isProd) {
  const clientDir = path.join(__dirname, "../client");
  app.use("/*", serveStatic({ root: clientDir }));
  app.get("*", serveStatic({ path: path.join(clientDir, "index.html") }));
}

const hostname = "127.0.0.1";
const server = createAdaptorServer({ fetch: app.fetch });

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EACCES" || error.code === "EADDRINUSE") {
    console.error(
      `无法在 ${hostname}:${port} 监听（${error.code}）。该端口当前不可用。请关闭占用该端口的进程，或换一个端口后重新启动，例如：PORT=8788 npm run dev`,
    );
    process.exit(1);
  }
  throw error;
});

server.listen(port, hostname, () => {
  console.log(`Pi Provider Manager API running on http://${hostname}:${port}`);
  void getEffectiveCatalog().catch((error) => {
    console.warn("[pi-catalog] startup sync failed:", error);
  });
  void upgradeHookExtension().catch((error) => {
    console.warn("[long-cache] extension upgrade failed:", error);
  });
});
