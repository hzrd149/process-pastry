import { serve } from "bun";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { ProcessManager } from "./process-manager";
import { readEnv, writeEnv, readEnvExample } from "./config-handler";

// Get the directory of the current module (Bun supports import.meta.dir)
const uiDir = join(import.meta.dir, "ui");

const LOG_PREFIX = "[process-pastry]";
const API_PREFIX = "/process-pastry/api";

/**
 * Generate a self-signed SSL certificate using OpenSSL
 * @param certPath Path to save the certificate
 * @param keyPath Path to save the private key
 * @param hostname Hostname for the certificate
 * @returns Promise that resolves when certificate is generated
 */
async function generateSelfSignedCert(
  certPath: string,
  keyPath: string,
  hostname: string,
): Promise<void> {
  const { spawn } = await import("child_process");

  return new Promise((resolve, reject) => {
    // Generate certificate using OpenSSL
    const openssl = spawn("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "365",
      "-nodes",
      "-subj",
      `/CN=${hostname}/O=process-pastry/C=US`,
    ]);

    let stderr = "";

    openssl.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    openssl.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`OpenSSL failed with code ${code}: ${stderr}`));
      }
    });

    openssl.on("error", (error) => {
      reject(
        new Error(
          `Failed to run OpenSSL: ${error.message}. Make sure OpenSSL is installed.`,
        ),
      );
    });
  });
}

/**
 * Get or generate SSL certificate and key
 * @param sslCert Optional path to certificate file
 * @param sslKey Optional path to key file
 * @param sslHost Hostname for certificate generation
 * @returns Object with cert and key as strings
 */
async function getSSLCertificates(
  sslCert?: string,
  sslKey?: string,
  sslHost: string = "localhost",
): Promise<{ cert: string; key: string }> {
  // If both cert and key are provided, read them
  if (sslCert && sslKey) {
    try {
      const cert = readFileSync(sslCert, "utf-8");
      const key = readFileSync(sslKey, "utf-8");
      return { cert, key };
    } catch (error) {
      throw new Error(`Failed to read SSL certificate files: ${error}`);
    }
  }

  // Auto-generate certificate in .ssl directory
  const sslDir = join(process.cwd(), ".ssl");
  const defaultCertPath = join(sslDir, "cert.pem");
  const defaultKeyPath = join(sslDir, "key.pem");

  // Create .ssl directory if it doesn't exist
  if (!existsSync(sslDir)) {
    mkdirSync(sslDir, { recursive: true });
  }

  // Check if certificate already exists
  if (existsSync(defaultCertPath) && existsSync(defaultKeyPath)) {
    console.log(
      `${LOG_PREFIX} 📜 Using existing self-signed certificate at ${defaultCertPath}`,
    );
    const cert = readFileSync(defaultCertPath, "utf-8");
    const key = readFileSync(defaultKeyPath, "utf-8");
    return { cert, key };
  }

  // Generate new certificate
  console.log(
    `${LOG_PREFIX} 🔐 Generating self-signed SSL certificate for ${sslHost}...`,
  );
  try {
    await generateSelfSignedCert(defaultCertPath, defaultKeyPath, sslHost);
    console.log(`${LOG_PREFIX} ✅ Certificate generated at ${defaultCertPath}`);
    const cert = readFileSync(defaultCertPath, "utf-8");
    const key = readFileSync(defaultKeyPath, "utf-8");
    return { cert, key };
  } catch (error) {
    throw new Error(
      `Failed to generate SSL certificate: ${error}. Make sure OpenSSL is installed.`,
    );
  }
}

export interface ServerOptions {
  port: number;
  envPath: string;
  command: string[];
  htmlRoute?: string; // Path for HTML route, default: "/"
  htmlContent?: string | any; // HTML content to serve (from import or file path)
  exampleEnvPath?: string; // Path to .env.example file (auto-discovered if not provided)
  proxyPort?: number; // Port to proxy unmatched requests to (when custom HTML is provided)
  proxyHost?: string; // Host to proxy unmatched requests to (default: "localhost")
  authUser?: string; // Username for HTTP Basic Auth (optional)
  authPassword?: string; // Password for HTTP Basic Auth (optional)
  ssl?: boolean; // Enable SSL/HTTPS mode
  sslCert?: string; // Path to SSL certificate file (optional, auto-generated if not provided)
  sslKey?: string; // Path to SSL private key file (optional, auto-generated if not provided)
  sslHost?: string; // Hostname for certificate (default: "localhost")
}

export async function startServer(options: ServerOptions): Promise<void> {
  const {
    port,
    envPath,
    command,
    htmlRoute = "/",
    htmlContent,
    exampleEnvPath,
    proxyPort,
    proxyHost = "localhost",
    authUser,
    authPassword,
    ssl,
    sslCert,
    sslKey,
    sslHost = "localhost",
  } = options;

  // Get SSL certificates if SSL is enabled
  let tlsConfig: { key: string; cert: string } | undefined;
  if (ssl) {
    try {
      tlsConfig = await getSSLCertificates(sslCert, sslKey, sslHost);
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ SSL Error:`, error);
      process.exit(1);
    }
  }

  // Initialize process manager
  const processManager = new ProcessManager({ command, envPath });

  // Start the initial process
  processManager.start().catch((error) => {
    console.error(`${LOG_PREFIX} Failed to start initial process:`, error);
  });

  // Build routes object
  const routes: Record<string, any> = {};

  // Add HTML route - use provided HTML or default UI
  if (htmlContent) {
    // Use provided HTML content
    if (typeof htmlContent === "string") {
      routes[htmlRoute] = () =>
        new Response(htmlContent, {
          headers: { "Content-Type": "text/html" },
        });
    } else {
      routes[htmlRoute] = htmlContent;
    }
  } else {
    // Serve default UI from ui folder
    const defaultUIHtml = readFileSync(join(uiDir, "index.html"), "utf-8");
    routes[htmlRoute] = () =>
      new Response(defaultUIHtml, {
        headers: { "Content-Type": "text/html" },
      });

    // Serve UI static assets (CSS, JS)
    routes["/ui/styles.css"] = () => {
      const css = readFileSync(join(uiDir, "styles.css"), "utf-8");
      return new Response(css, {
        headers: { "Content-Type": "text/css" },
      });
    };

    routes["/ui/app.js"] = () => {
      const js = readFileSync(join(uiDir, "app.js"), "utf-8");
      return new Response(js, {
        headers: { "Content-Type": "application/javascript" },
      });
    };

    routes["/ui/utils.js"] = () => {
      const js = readFileSync(join(uiDir, "utils.js"), "utf-8");
      return new Response(js, {
        headers: { "Content-Type": "application/javascript" },
      });
    };

    routes["/ui/state.js"] = () => {
      const js = readFileSync(join(uiDir, "state.js"), "utf-8");
      return new Response(js, {
        headers: { "Content-Type": "application/javascript" },
      });
    };

    routes["/ui/api.js"] = () => {
      const js = readFileSync(join(uiDir, "api.js"), "utf-8");
      return new Response(js, {
        headers: { "Content-Type": "application/javascript" },
      });
    };

    routes["/ui/ui.js"] = () => {
      const js = readFileSync(join(uiDir, "ui.js"), "utf-8");
      return new Response(js, {
        headers: { "Content-Type": "application/javascript" },
      });
    };

    routes["/ui/render.js"] = () => {
      const js = readFileSync(join(uiDir, "render.js"), "utf-8");
      return new Response(js, {
        headers: { "Content-Type": "application/javascript" },
      });
    };

    routes["/ui/change-detection.js"] = () => {
      const js = readFileSync(join(uiDir, "change-detection.js"), "utf-8");
      return new Response(js, {
        headers: { "Content-Type": "application/javascript" },
      });
    };
  }

  // Helper function to check if restart should be skipped
  function shouldRestart(req: Request): boolean {
    const restartHeader = req.headers.get("X-Restart-Process");
    return restartHeader !== "false";
  }

  // Helper function to check HTTP Basic Auth
  function checkAuth(req: Request): Response | null {
    // Skip auth if credentials are not provided
    if (!authUser && !authPassword) {
      return null;
    }

    // If only one credential is provided, require both
    if (!authUser || !authPassword) {
      return new Response("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Config UI"',
        },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return new Response("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Config UI"',
        },
      });
    }

    try {
      const base64Credentials = authHeader.substring(6);
      const credentials = Buffer.from(base64Credentials, "base64").toString(
        "utf-8",
      );
      const [username, password] = credentials.split(":", 2);

      if (username === authUser && password === authPassword) {
        return null; // Auth passed
      }
    } catch (error) {
      // Invalid base64 or malformed credentials
    }

    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Config UI"',
      },
    });
  }

  // Add API routes
  routes[`${API_PREFIX}/config`] = {
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

  routes[`${API_PREFIX}/status`] = {
    GET() {
      const status = processManager.getStatus();
      return Response.json(status);
    },
  };

  routes[`${API_PREFIX}/example`] = {
    GET() {
      try {
        const schema = readEnvExample(exampleEnvPath, envPath);
        return Response.json(schema);
      } catch (error) {
        // Return empty object if there's an error (e.g., file doesn't exist)
        return Response.json({});
      }
    },
  };

  // Helper function to proxy requests to another host/port
  async function proxyRequest(
    req: Request,
    targetHost: string,
    targetPort: number,
    useHttps: boolean = false,
  ): Promise<Response> {
    const url = new URL(req.url);
    const protocol = useHttps ? "https" : "http";
    const targetUrl = `${protocol}://${targetHost}:${targetPort}${url.pathname}${url.search}`;

    try {
      const proxyReq = new Request(targetUrl, {
        method: req.method,
        headers: req.headers,
        body:
          req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      });

      const response = await fetch(proxyReq);
      return response;
    } catch (error) {
      console.error(`${LOG_PREFIX} Proxy error:`, error);
      return new Response("Proxy Error", { status: 502 });
    }
  }

  // Start the server
  const serverConfig: any = {
    port,
    routes,
    async fetch(req: Request) {
      // Check authentication first (applies to all routes)
      const authResponse = checkAuth(req);
      if (authResponse) {
        return authResponse;
      }

      // If proxyPort is provided, proxy unmatched routes
      if (proxyPort) {
        const url = new URL(req.url);
        const pathname = url.pathname;

        // Don't proxy API routes or the HTML route
        if (
          pathname.startsWith(API_PREFIX + "/") ||
          pathname === htmlRoute ||
          pathname.startsWith(htmlRoute + "/")
        ) {
          // Let the routes handle it or return 404
          return new Response("Not Found", { status: 404 });
        }

        // Proxy all other requests to the target host/port
        return await proxyRequest(req, proxyHost, proxyPort, ssl);
      }

      // Handle any unmatched routes
      return new Response("Not Found", { status: 404 });
    },
  };

  // Add TLS configuration if SSL is enabled
  if (tlsConfig) {
    serverConfig.tls = {
      key: tlsConfig.key,
      cert: tlsConfig.cert,
    };
  }

  const server = serve(serverConfig);

  const protocol = ssl ? "https" : "http";
  console.log(
    `${LOG_PREFIX} 🚀 Config manager running on ${protocol}://localhost:${port}`,
  );
  console.log(`${LOG_PREFIX} 📝 Config file: ${envPath}`);
  console.log(`${LOG_PREFIX} 🔄 Managing process: ${command.join(" ")}`);
  console.log(
    `${LOG_PREFIX} 🌐 UI available at ${protocol}://localhost:${port}${htmlRoute}`,
  );
  if (ssl) {
    console.log(`${LOG_PREFIX} 🔐 SSL/HTTPS enabled`);
    if (!sslCert || !sslKey) {
      console.log(
        `${LOG_PREFIX} ⚠️  Using self-signed certificate. Browsers will show a security warning.`,
      );
    }
  }
  if (authUser && authPassword) {
    console.log(`${LOG_PREFIX} 🔒 HTTP Basic Auth enabled`);
  }
  if (proxyPort) {
    const proxyProtocol = ssl ? "https" : "http";
    console.log(
      `${LOG_PREFIX} 🔀 Proxying unmatched requests to ${proxyProtocol}://${proxyHost}:${proxyPort}`,
    );
  }
}
