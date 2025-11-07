import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Reads environment variables from a .env file
 * @param envPath Path to the .env file
 * @returns Record of key-value pairs from the .env file
 */
export function readEnv(envPath: string): Record<string, string> {
  const resolvedPath = resolve(envPath);

  if (!existsSync(resolvedPath)) {
    return {};
  }

  const content = readFileSync(resolvedPath, "utf-8");
  const config: Record<string, string> = {};

  content.split("\n").forEach((line) => {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    // Handle key=value pairs
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) {
      return;
    }

    const key = trimmed.substring(0, equalIndex).trim();
    const value = trimmed.substring(equalIndex + 1).trim();

    // Remove quotes if present
    const unquotedValue = value.replace(/^["']|["']$/g, "");

    if (key) {
      config[key] = unquotedValue;
    }
  });

  return config;
}

/**
 * Writes environment variables to a .env file
 * @param envPath Path to the .env file
 * @param config Record of key-value pairs to write
 */
export function writeEnv(
  envPath: string,
  config: Record<string, string>,
): void {
  const resolvedPath = resolve(envPath);

  const content = Object.entries(config)
    .map(([key, value]) => {
      // Escape special characters and wrap in quotes if needed
      const needsQuotes =
        value.includes(" ") || value.includes("=") || value.includes("#");
      const escapedValue = needsQuotes
        ? `"${value.replace(/"/g, '\\"')}"`
        : value;
      return `${key}=${escapedValue}`;
    })
    .join("\n");

  writeFileSync(resolvedPath, content, "utf-8");
}
