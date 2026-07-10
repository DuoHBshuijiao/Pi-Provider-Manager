import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

serve(
  {
    fetch: app.fetch,
    port,
    hostname: "127.0.0.1",
  },
  (info) => {
    console.log(`Pi Provider Manager API running on http://127.0.0.1:${info.port}`);
  },
);
