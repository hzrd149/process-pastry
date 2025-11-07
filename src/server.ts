import { serve } from "bun";
import { ProcessManager } from "./process-manager";
import { readEnv, writeEnv } from "./config-handler";
import defaultUI from "./default-ui.html";

const LOG_PREFIX = "[process-pastry]";

export interface ServerOptions {
  port: number;
  envPath: string;
  command: string[];
  htmlRoute?: string; // Path for HTML route, default: "/"
  htmlContent?: string | any; // HTML content to serve (from import or file path)
}

export function startServer(options: ServerOptions): void {
  const { port, envPath, command, htmlRoute = "/", htmlContent } = options;

  // Initialize process manager
  const processManager = new ProcessManager({ command, envPath });

  // Start the initial process
  processManager.start().catch((error) => {
    console.error(`${LOG_PREFIX} Failed to start initial process:`, error);
  });

  // Build routes object
  const routes: Record<string, any> = {};

  // Add HTML route - use provided HTML or default UI
  const uiToServe = htmlContent || defaultUI;
  if (uiToServe) {
    if (typeof uiToServe === "string") {
      // For string content (from file read), serve as HTML response
      routes[htmlRoute] = () =>
        new Response(uiToServe, {
          headers: { "Content-Type": "text/html" },
        });
    } else {
      // For HTML imports, pass directly to Bun's routes
      routes[htmlRoute] = uiToServe;
    }
  }

  // Helper function to check if restart should be skipped
  function shouldRestart(req: Request): boolean {
    const restartHeader = req.headers.get("X-Restart-Process");
    return restartHeader !== "false";
  }

  // Add API routes
  routes["/api/config"] = {
    async GET() {
      const config = readEnv(envPath);
      return Response.json(config);
    },

    async POST(req: Request) {
      try {
        const config = (await req.json()) as Record<string, string>;
        // POST replaces the entire config (UI sends complete config)
        writeEnv(envPath, config);

        const restart = shouldRestart(req);
        let error: string | null = null;

        if (restart) {
          // Restart process with new config
          await processManager.restart();

          // Wait a bit for process to potentially error
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const status = processManager.getStatus();
          error = status.lastError || null;
        }

        return Response.json({
          success: true,
          error,
          restarted: restart,
        });
      } catch (error) {
        return Response.json(
          { success: false, error: String(error) },
          { status: 400 },
        );
      }
    },

    async PATCH(req: Request) {
      try {
        const partialConfig = (await req.json()) as Record<string, string>;
        const currentConfig = readEnv(envPath);

        // Merge only the provided variables
        const mergedConfig = { ...currentConfig, ...partialConfig };
        writeEnv(envPath, mergedConfig);

        const restart = shouldRestart(req);
        let error: string | null = null;

        if (restart) {
          // Restart process with new config
          await processManager.restart();

          // Wait a bit for process to potentially error
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const status = processManager.getStatus();
          error = status.lastError || null;
        }

        return Response.json({
          success: true,
          error,
          restarted: restart,
          updated: Object.keys(partialConfig as Record<string, string>),
        });
      } catch (error) {
        return Response.json(
          { success: false, error: String(error) },
          { status: 400 },
        );
      }
    },
  };

  routes["/api/status"] = {
    GET() {
      const status = processManager.getStatus();
      return Response.json(status);
    },
  };

  // Start the server
  const server = serve({
    port,
    routes,
    fetch(req) {
      // Handle any unmatched routes
      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`${LOG_PREFIX} 🚀 Config manager running on http://localhost:${port}`);
  console.log(`${LOG_PREFIX} 📝 Config file: ${envPath}`);
  console.log(`${LOG_PREFIX} 🔄 Managing process: ${command.join(" ")}`);
  console.log(`${LOG_PREFIX} 🌐 UI available at http://localhost:${port}${htmlRoute}`);
}
