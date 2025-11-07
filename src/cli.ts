import { startServer } from "./server";
import { readFileSync } from "fs";

export interface CLIOptions {
  env?: string;
  cmd?: string;
  port?: string;
  html?: string;
  htmlRoute?: string;
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
  --help                  Show this help message

Examples:
  process-pastry --cmd "node app.js" --env .env
  process-pastry --cmd "bun run server.ts" --env config/.env --port 8080
  process-pastry --cmd "node app.js" --html ./ui.html --html-route /config
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

  // Start the server
  startServer({
    port,
    envPath: options.env || ".env",
    command,
    htmlRoute: options.htmlRoute || "/",
    htmlContent,
  });
}
