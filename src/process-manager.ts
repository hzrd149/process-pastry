import { spawn, type Subprocess } from "bun";
import { readEnv } from "./config-handler";

const LOG_PREFIX = "[process-pastry]";

export interface ProcessManagerOptions {
  command: string[];
  envPath: string;
}

export interface ProcessStatus {
  running: boolean;
  lastError: string | null;
  pid: number | null;
}

export class ProcessManager {
  private childProcess: Subprocess<"pipe", "pipe", "pipe"> | null = null;
  private lastError: string = "";
  private command: string[];
  private envPath: string;

  constructor(options: ProcessManagerOptions) {
    this.command = options.command;
    this.envPath = options.envPath;
  }

  /**
   * Starts the child process with environment variables from .env file
   */
  async start(): Promise<void> {
    this.lastError = "";

    // Kill existing process if running
    if (this.childProcess) {
      await this.kill();
    }

    try {
      // Read environment variables from .env file
      const envVars = readEnv(this.envPath);

      // Merge with current process environment
      const processEnv = {
        ...process.env,
        ...envVars,
      };

      // Spawn the child process
      this.childProcess = spawn(this.command, {
        stdio: ["pipe", "pipe", "pipe"],
        env: processEnv,
      });

      const childProcess = this.childProcess;

      // Capture stderr for error logging
      if (childProcess.stderr) {
        const stderrReader = childProcess.stderr.getReader();
        (async () => {
          try {
            while (true) {
              const { done, value } = await stderrReader.read();
              if (done) break;

              const errorMsg = new TextDecoder().decode(value);
              this.lastError += errorMsg;
              // Output child stderr directly without prefix to preserve original logs
              process.stderr.write(value);
            }
          } catch (error) {
            // Reader may be closed
          }
        })();
      }

      // Capture stdout as well (may contain errors)
      if (childProcess.stdout) {
        const stdoutReader = childProcess.stdout.getReader();
        (async () => {
          try {
            while (true) {
              const { done, value } = await stdoutReader.read();
              if (done) break;

              // Output child stdout directly without prefix to preserve original logs
              process.stdout.write(value);
            }
          } catch (error) {
            // Reader may be closed
          }
        })();
      }

      // Monitor process exit
      childProcess.exited.then((exitCode) => {
        if (exitCode !== 0 && exitCode !== null) {
          this.lastError += `\nProcess exited with code ${exitCode}`;
        }
        this.childProcess = null;
      });

      if (childProcess.pid) {
        console.log(
          `${LOG_PREFIX} ✓ Process started with PID ${childProcess.pid}`,
        );
      }
    } catch (error) {
      this.lastError = `Failed to start process: ${error}`;
      console.error(`${LOG_PREFIX} ${this.lastError}`);
      this.childProcess = null;
    }
  }

  /**
   * Kills the child process if it's running
   * First attempts graceful shutdown (SIGTERM), then force kills (SIGKILL) if needed
   * @param timeoutMs Time to wait for graceful shutdown before force killing (default: 5000ms)
   */
  async kill(timeoutMs: number = 5000): Promise<void> {
    if (!this.childProcess) {
      return;
    }

    const pid = this.childProcess.pid;
    if (!pid) {
      this.childProcess = null;
      return;
    }

    try {
      // Send SIGTERM for graceful shutdown
      try {
        // Use process.kill directly with PID for signal support
        process.kill(pid, "SIGTERM");
      } catch (error) {
        // Process might already be dead, continue to cleanup
      }

      // Wait for process to exit gracefully
      const startTime = Date.now();
      while (Date.now() - startTime < timeoutMs) {
        // Check if childProcess reference is still valid
        if (!this.childProcess) {
          return; // Process already cleaned up
        }

        // Check if process has exited
        if (this.childProcess.exitCode !== null) {
          this.childProcess = null;
          return;
        }

        // Check if process is still alive by attempting to send signal 0 (no-op)
        try {
          process.kill(pid, 0);
        } catch (error) {
          // Process is dead (ESRCH error means process doesn't exist)
          this.childProcess = null;
          return;
        }

        // Wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Process didn't exit gracefully, force kill with SIGKILL
      console.log(
        `${LOG_PREFIX} Process ${pid} didn't exit gracefully, force killing...`,
      );
      try {
        process.kill(pid, "SIGKILL");
      } catch (error) {
        // Process might already be dead, ignore
      }

      // Wait a moment for force kill to take effect
      await new Promise((resolve) => setTimeout(resolve, 200));
      this.childProcess = null;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error killing process:`, error);
      this.childProcess = null;
    }
  }

  /**
   * Restarts the child process
   */
  async restart(): Promise<void> {
    await this.start();
  }

  /**
   * Gets the current status of the managed process
   */
  getStatus(): ProcessStatus {
    return {
      running:
        this.childProcess !== null && this.childProcess.exitCode === null,
      lastError: this.lastError || null,
      pid: this.childProcess?.pid || null,
    };
  }

  /**
   * Clears the last error message
   */
  clearError(): void {
    this.lastError = "";
  }
}
