import { startServer } from "./server";
import { readFileSync } from "fs";

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
  help?: boolean;
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
  --help                  Show this help message

Examples:
  process-pastry --cmd "node app.js" --env .env
  process-pastry --cmd "bun run server.ts" --env config/.env --port 8080
  process-pastry --cmd "node app.js" --html ./ui.html --html-route /config
  process-pastry --cmd "node app.js" --html ./ui.html --html-route /config --proxy-port 4000
  process-pastry --cmd "node app.js" --html ./ui.html --html-route /config --proxy-port 4000 --proxy-host 192.168.1.100
`);
}

export function runCLI(): void {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

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

  // Read HTML file if provided
  let htmlContent: string | undefined;
  if (options.html) {
    try {
      htmlContent = readFileSync(options.html, "utf-8");
    } catch (error) {
      console.error(`Error reading HTML file: ${error}`);
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
    htmlContent,
    exampleEnvPath: options.exampleEnv,
    proxyPort,
    proxyHost: options.proxyHost,
    authUser,
    authPassword,
  });
}
