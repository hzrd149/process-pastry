import { startServer } from "./server";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export interface CLIOptions {
  env?: string;
  cmd?: string;
  port?: string;
  html?: string;
  htmlRoute?: string;
  exampleEnv?: string;
  proxyPort?: string;
  proxyHost?: string;
  authUser?: string;
  authPassword?: string;
  ssl?: boolean;
  sslCert?: string;
  sslKey?: string;
  sslHost?: string;
  help?: boolean;
  config?: string;
}

/**
 * Loads configuration from a JSON file
 * @param configPath Path to the config file
 * @returns CLIOptions object or null if file doesn't exist
 */
function loadConfigFile(configPath: string): CLIOptions | null {
  const resolvedPath = resolve(configPath);

  if (!existsSync(resolvedPath)) {
    return null;
  }

  try {
    const content = readFileSync(resolvedPath, "utf-8");
    const config = JSON.parse(content) as CLIOptions;

    // Validate that config has expected structure (basic validation)
    // Convert port and proxyPort to strings if they're numbers (for consistency)
    if (config.port && typeof config.port === "number") {
      config.port = String(config.port);
    }
    if (config.proxyPort && typeof config.proxyPort === "number") {
      config.proxyPort = String(config.proxyPort);
    }

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(
        `Error: Invalid JSON in config file ${resolvedPath}: ${error.message}`,
      );
    } else {
      console.error(
        `Error: Failed to read config file ${resolvedPath}: ${error}`,
      );
    }
    process.exit(1);
  }
}

export function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--env" || arg === "-e") {
      options.env = args[++i];
    } else if (arg === "--cmd" || arg === "-c") {
      options.cmd = args[++i];
    } else if (arg === "--port" || arg === "-p") {
      options.port = args[++i];
    } else if (arg === "--html" || arg === "-h") {
      options.html = args[++i];
    } else if (arg === "--html-route") {
      options.htmlRoute = args[++i];
    } else if (arg === "--example-env" || arg === "-E") {
      options.exampleEnv = args[++i];
    } else if (arg === "--proxy-port") {
      options.proxyPort = args[++i];
    } else if (arg === "--proxy-host") {
      options.proxyHost = args[++i];
    } else if (arg === "--auth-user") {
      options.authUser = args[++i];
    } else if (arg === "--auth-password") {
      options.authPassword = args[++i];
    } else if (arg === "--ssl" || arg === "--https") {
      options.ssl = true;
    } else if (arg === "--ssl-cert") {
      options.sslCert = args[++i];
    } else if (arg === "--ssl-key") {
      options.sslKey = args[++i];
    } else if (arg === "--ssl-host") {
      options.sslHost = args[++i];
    } else if (arg === "--config") {
      options.config = args[++i];
    } else if (arg === "--help") {
      options.help = true;
    }
  }

  return options;
}

export function printHelp(): void {
  console.log(`
Usage: process-pastry [options]

Options:
  --config <path>         Path to JSON config file (default: process-pastry.json in current directory)
  --env, -e <path>        Path to .env file (default: .env)
  --cmd, -c <command>     Command to run as child process (required)
  --port, -p <port>       Web server port (default: 3000)
  --html, -h <path>       Path to HTML file to serve as UI (optional)
  --html-route <path>     Route path for HTML UI (default: /)
  --example-env, -E <path> Path to .env.example file (auto-discovered if not provided)
  --proxy-port <port>     Port to proxy unmatched requests to
  --proxy-host <host>     Host to proxy unmatched requests to (default: localhost)
  --auth-user <user>      Username for HTTP Basic Auth (optional, can also use PROCESS_PASTRY_AUTH_USER env var)
  --auth-password <pass>  Password for HTTP Basic Auth (optional, can also use PROCESS_PASTRY_AUTH_PASSWORD env var)
  --ssl, --https          Enable SSL/HTTPS mode (will auto-generate self-signed certificate if not provided)
  --ssl-cert <path>       Path to SSL certificate file (optional, auto-generated if not provided)
  --ssl-key <path>        Path to SSL private key file (optional, auto-generated if not provided)
  --ssl-host <hostname>   Hostname for certificate (default: localhost)
  --help                  Show this help message

Config File:
  You can create a process-pastry.json file in your project directory to avoid specifying
  all options via CLI arguments. CLI arguments will override values from the config file.

  Example config file (process-pastry.json):
  {
    "cmd": "node app.js",
    "env": ".env",
    "port": "3000",
    "html": "./ui.html",
    "htmlRoute": "/",
    "proxyPort": "4000",
    "proxyHost": "localhost",
    "ssl": true
  }

Examples:
  process-pastry --cmd "node app.js" --env .env
  process-pastry --cmd "bun run server.ts" --env config/.env --port 8080
  process-pastry --cmd "node app.js" --html ./ui.html --html-route /config
  process-pastry --cmd "node app.js" --html ./ui.html --html-route /config --proxy-port 4000
  process-pastry --cmd "node app.js" --html ./ui.html --html-route /config --proxy-port 4000 --proxy-host 192.168.1.100
  process-pastry --cmd "node app.js" --env .env --ssl
  process-pastry --cmd "node app.js" --env .env --ssl --ssl-cert ./cert.pem --ssl-key ./key.pem
  process-pastry --config ./my-config.json
`);
}

export function runCLI(): void {
  const args = process.argv.slice(2);
  const cliOptions = parseArgs(args);

  // Load config file if specified or try to auto-discover
  let configOptions: CLIOptions = {};
  const configPath = cliOptions.config || "process-pastry.json";
  const loadedConfig = loadConfigFile(configPath);
  if (loadedConfig) {
    configOptions = loadedConfig;
  } else if (cliOptions.config) {
    // User explicitly specified a config file that doesn't exist
    console.warn(
      `Warning: Config file specified with --config not found: ${configPath}`,
    );
  }

  // Merge config file options with CLI options (CLI overrides config)
  const options: CLIOptions = {
    ...configOptions,
    ...cliOptions,
  };

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Validate required options
  if (!options.cmd) {
    console.error("Error: --cmd is required");
    printHelp();
    process.exit(1);
  }

  // Parse command into array (handle quoted strings)
  const command = options.cmd.split(/\s+/).filter(Boolean);

  // Parse port
  const port = options.port ? parseInt(options.port, 10) : 3000;
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error("Error: Invalid port number");
    process.exit(1);
  }

  // Parse proxy port
  let proxyPort: number | undefined;
  if (options.proxyPort) {
    proxyPort = parseInt(options.proxyPort, 10);
    if (isNaN(proxyPort) || proxyPort < 1 || proxyPort > 65535) {
      console.error("Error: Invalid proxy port number");
      process.exit(1);
    }
  }

  // Validate HTML file path if provided
  let htmlPath: string | undefined;
  if (options.html) {
    const resolvedHtmlPath = resolve(options.html);
    if (!existsSync(resolvedHtmlPath)) {
      console.error(`Error: HTML file not found: ${resolvedHtmlPath}`);
      process.exit(1);
    }
    htmlPath = resolvedHtmlPath;
  }

  // Validate that --html-route must be set (not '/') when using --proxy-port
  // This prevents path conflicts between the HTML route/bundled assets and proxied requests
  if (proxyPort) {
    const htmlRoute = options.htmlRoute || "/";
    if (htmlRoute === "/") {
      console.error(
        "Error: --html-route must be explicitly set (not '/') when using --proxy-port.",
      );
      console.error(
        "This prevents path conflicts between the HTML route/bundled assets and proxied requests.",
      );
      if (htmlPath) {
        console.error(
          "Example: --html ./ui.html --html-route /config --proxy-port 8080",
        );
      } else {
        console.error("Example: --html-route /config --proxy-port 8080");
      }
      process.exit(1);
    }
  }

  // Get auth credentials from CLI args or environment variables
  const authUser = options.authUser || process.env.PROCESS_PASTRY_AUTH_USER;
  const authPassword =
    options.authPassword || process.env.PROCESS_PASTRY_AUTH_PASSWORD;

  // Start the server
  startServer({
    port,
    envPath: options.env || ".env",
    command,
    htmlRoute: options.htmlRoute || "/",
    html: htmlPath,
    exampleEnvPath: options.exampleEnv,
    proxyPort,
    proxyHost: options.proxyHost,
    authUser,
    authPassword,
    ssl: options.ssl,
    sslCert: options.sslCert,
    sslKey: options.sslKey,
    sslHost: options.sslHost || "localhost",
  }).catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}
