#!/usr/bin/env bun

// Library exports
export { startServer, type ServerOptions } from "./src/server";
export {
  ProcessManager,
  type ProcessManagerOptions,
  type ProcessStatus,
} from "./src/process-manager";
export {
  readEnv,
  writeEnv,
  readEnvExample,
  type EnvVariableSchema,
} from "./src/config-handler";
export { parseArgs, printHelp, runCLI, type CLIOptions } from "./src/cli";

// CLI entry point when run directly
if (import.meta.main) {
  const { runCLI } = await import("./src/cli");
  runCLI();
}
