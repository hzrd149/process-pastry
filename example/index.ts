#!/usr/bin/env bun

// Example app for testing process-pastry
// This app reads environment variables and runs a simple server

const PORT = parseInt(process.env.PORT || "4000", 10);
const MESSAGE = process.env.MESSAGE || "Hello from example app!";
const DELAY = parseInt(process.env.DELAY || "0", 10);

console.log(`[Example App] Starting on port ${PORT}...`);
console.log(`[Example App] Message: ${MESSAGE}`);
console.log(`[Example App] Delay: ${DELAY}ms`);

// Simulate startup delay if configured
if (DELAY > 0) {
  console.log(`[Example App] Waiting ${DELAY}ms before starting server...`);
  await new Promise((resolve) => setTimeout(resolve, DELAY));
}

// Validate required env vars (example of error handling)
if (process.env.REQUIRED_VAR === undefined) {
  console.error("[Example App] ERROR: REQUIRED_VAR is not set!");
  console.error("[Example App] This is a test error to demonstrate error tracking.");
  process.exit(1);
}

// Start a simple HTTP server
const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response(
        JSON.stringify({
          message: MESSAGE,
          port: PORT,
          timestamp: new Date().toISOString(),
          env: {
            PORT,
            MESSAGE,
            DELAY,
            REQUIRED_VAR: process.env.REQUIRED_VAR,
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[Example App] ✓ Server running on http://localhost:${PORT}`);
console.log(`[Example App] ✓ Health check: http://localhost:${PORT}/health`);

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Example App] Received SIGTERM, shutting down...");
  server.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Example App] Received SIGINT, shutting down...");
  server.stop();
  process.exit(0);
});

