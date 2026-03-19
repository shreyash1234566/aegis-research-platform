import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { logError, logInfo, logWarn } from "./logger";

const JSON_BODY_LIMIT = "50mb";

function validateRuntimeConfiguration() {
  const missing = [
    "JWT_SECRET",
    "VITE_APP_ID",
    "OAUTH_SERVER_URL",
    "BUILT_IN_FORGE_API_URL",
    "BUILT_IN_FORGE_API_KEY",
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logWarn("server.config.missing_env", {
      missing,
      message: "Some features may be degraded until env vars are configured.",
    });
  }
}

function resolveRequestId(headerValue: unknown): string {
  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  if (Array.isArray(headerValue) && headerValue[0]) {
    return String(headerValue[0]);
  }

  return randomUUID();
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  validateRuntimeConfiguration();

  const app = express();
  const server = createServer(app);

  app.use((req, res, next) => {
    const requestId = resolveRequestId(req.headers["x-request-id"]);
    (req as any).requestId = requestId;
    res.setHeader("x-request-id", requestId);

    const startedAt = Date.now();
    res.on("finish", () => {
      logInfo("http.request", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  });

  // Configure body parser with larger size limit for file uploads.
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ limit: JSON_BODY_LIMIT, extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logWarn("server.port.fallback", {
      preferredPort,
      selectedPort: port,
    });
  }

  server.listen(port, () => {
    logInfo("server.started", {
      url: `http://localhost:${port}/`,
      mode: process.env.NODE_ENV || "development",
    });
  });
}

startServer().catch((error) => {
  logError("server.start.failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
