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
      this.kill();
      // Wait a bit for process to fully terminate
      await new Promise((resolve) => setTimeout(resolve, 500));
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
   */
  kill(): void {
    if (this.childProcess) {
      try {
        this.childProcess.kill();
        this.childProcess = null;
      } catch (error) {
        console.error(`${LOG_PREFIX} Error killing process:`, error);
      }
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
