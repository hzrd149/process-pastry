import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";

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

    // Validate that there are no spaces around the = sign (invalid env syntax)
    const charBefore = trimmed[equalIndex - 1];
    const charAfter = trimmed[equalIndex + 1];
    if (charBefore === " " || charAfter === " ") {
      // Invalid syntax - skip this line
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

export interface EnvVariableSchema {
  description: string;
  defaultValue?: string;
  commented: boolean;
}

/**
 * Reads and parses a .env.example file to extract variable metadata
 * @param exampleEnvPath Path to the .env.example file
 * @returns Record of variable names to their schema metadata
 */
export function readEnvExample(
  exampleEnvPath?: string,
  envPath?: string,
): Record<string, EnvVariableSchema> {
  // Auto-discover .env.example if not provided
  let resolvedExamplePath: string;
  if (exampleEnvPath) {
    resolvedExamplePath = resolve(exampleEnvPath);
  } else if (envPath) {
    // Auto-discover in same directory as .env
    const envDir = dirname(resolve(envPath));
    resolvedExamplePath = join(envDir, ".env.example");
  } else {
    return {};
  }

  if (!existsSync(resolvedExamplePath)) {
    return {};
  }

  const content = readFileSync(resolvedExamplePath, "utf-8");
  const schema: Record<string, EnvVariableSchema> = {};
  const lines = content.split("\n");

  let currentComments: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }
    const trimmed = line.trim();

    // Empty line - reset comments if we hit an empty line
    if (!trimmed) {
      currentComments = [];
      i++;
      continue;
    }

    // Check if this is a comment line or commented-out variable
    if (trimmed.startsWith("#")) {
      const afterHash = trimmed.substring(1).trim();

      // Check if this is a commented-out variable (has = or looks like a variable name)
      const equalIndex = afterHash.indexOf("=");
      if (equalIndex !== -1) {
        // Validate that there are no spaces around the = sign (invalid env syntax)
        const charBefore = afterHash[equalIndex - 1];
        const charAfter = afterHash[equalIndex + 1];
        if (charBefore === " " || charAfter === " ") {
          // Invalid syntax - treat as regular comment
          if (afterHash) {
            currentComments.push(afterHash);
          }
          i++;
          continue;
        }

        // Commented variable with value: # VARIABLE=value
        const key = afterHash.substring(0, equalIndex).trim();
        const value = afterHash.substring(equalIndex + 1).trim();
        const unquotedValue = value.replace(/^["']|["']$/g, "");

        if (key) {
          schema[key] = {
            description: currentComments.join("\n"),
            defaultValue: unquotedValue || undefined,
            commented: true,
          };
        }
        currentComments = [];
      } else if (/^[A-Z_][A-Z0-9_]*$/.test(afterHash)) {
        // Commented variable without value: # VARIABLE
        schema[afterHash] = {
          description: currentComments.join("\n"),
          commented: true,
        };
        currentComments = [];
      } else {
        // Regular comment line - collect for next variable
        if (afterHash) {
          currentComments.push(afterHash);
        }
      }
      i++;
      continue;
    }

    // Non-comment line - check if it's a variable assignment
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex !== -1) {
      // Validate that there are no spaces around the = sign (invalid env syntax)
      const charBefore = trimmed[equalIndex - 1];
      const charAfter = trimmed[equalIndex + 1];
      if (charBefore === " " || charAfter === " ") {
        // Invalid syntax - skip this line
        currentComments = [];
        i++;
        continue;
      }

      // Variable with value: VARIABLE=value
      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();
      const unquotedValue = value.replace(/^["']|["']$/g, "");

      if (key) {
        schema[key] = {
          description: currentComments.join("\n"),
          defaultValue: unquotedValue || undefined,
          commented: false,
        };
      }
    }

    // Reset comments after processing a variable
    currentComments = [];
    i++;
  }

  return schema;
}
