# process-pastry

A CLI tool built with Bun that provides a web-based configuration interface for managing environment variables and restarting child processes. Run it with command-line flags to configure paths and optionally provide your own custom HTML UI.

## Features

- 🎨 **Default HTML UI** - Built-in web interface for managing environment variables (can be overridden)
- ⚙️ **Environment Management** - Read and write `.env` files at customizable paths
- 🔄 **Process Management** - Automatically restart child processes when configuration changes
- 📊 **Error Tracking** - Capture and display process errors in real-time
- 🚀 **Bun Fullstack** - Leverages Bun's automatic bundling of scripts and styles in HTML files
- 🔧 **Partial Updates** - PATCH endpoint for updating only specific variables
- ⏸️ **Skip Restart** - Optional header to save config without restarting the process
- 📝 **Schema Support** - Optional `.env.example` file for variable descriptions and defaults

## Installation

```bash
bun install
```

## Usage

process-pastry is primarily used as a CLI tool. Run it with your command and configuration options:

```bash
# Basic usage (uses default UI)
bun run index.ts --cmd "node app.js" --env .env

# With custom port
bun run index.ts --cmd "bun run server.ts" --env config/.env --port 8080

# With custom HTML UI (overrides default)
bun run index.ts --cmd "node app.js" --html ./ui.html --html-route /config

# With .env.example file for schema
bun run index.ts --cmd "node app.js" --env .env --example-env .env.example
```

**Note:** If no `--html` option is provided, a default UI will be automatically served at the root route.

### CLI Options

- `--env, -e <path>` - Path to `.env` file (default: `.env`)
- `--cmd, -c <command>` - Command to run as child process (required)
- `--port, -p <port>` - Web server port (default: 3000)
- `--html, -h <path>` - Path to HTML file to serve as UI (optional)
- `--html-route <path>` - Route path for HTML UI (default: `/`)
- `--example-env, -E <path>` - Path to `.env.example` file (auto-discovered if not provided)
- `--help` - Show help message

## API Endpoints

The server provides the following REST API endpoints:

### `GET /api/config`

Returns the current configuration as a JSON object.

**Response:**

```json
{
  "PORT": "3000",
  "DATABASE_URL": "postgresql://localhost:5432/mydb",
  "NODE_ENV": "production"
}
```

### `POST /api/config`

Updates the entire configuration and optionally restarts the child process.

**Request Body:**

```json
{
  "PORT": "3000",
  "DATABASE_URL": "postgresql://localhost:5432/mydb",
  "NODE_ENV": "production"
}
```

**Headers:**

- `X-Restart-Process: false` - Skip process restart (default: `true`)

**Response:**

```json
{
  "success": true,
  "error": null,
  "restarted": true
}
```

If the process fails to start, `error` will contain the error message.

### `PATCH /api/config`

Updates only the specified environment variables (partial update) and optionally restarts the child process.

**Request Body:**

```json
{
  "PORT": "8080"
}
```

**Headers:**

- `X-Restart-Process: false` - Skip process restart (default: `true`)

**Response:**

```json
{
  "success": true,
  "error": null,
  "restarted": true,
  "updated": ["PORT"]
}
```

### `GET /api/status`

Returns the current status of the managed process.

**Response:**

```json
{
  "running": true,
  "lastError": null,
  "pid": 12345
}
```

### `GET /api/example`

Returns the schema metadata from `.env.example` file (if available). This includes variable descriptions, default values, and whether variables are commented out.

**Response:**

```json
{
  "PORT": {
    "description": "Server port number",
    "defaultValue": "3000",
    "commented": false
  },
  "API_KEY": {
    "description": "Required API key for external service",
    "commented": true
  }
}
```

## Creating a Custom Config UI

This section provides a complete guide for creating custom configuration UIs that work with process-pastry. You can copy and paste this entire section to AI agents or other developers.

### Overview

To use a custom UI, create an HTML file and pass it to process-pastry using the `--html` flag:

```bash
bun run index.ts --cmd "node app.js" --html ./my-custom-ui.html --html-route /config
```

process-pastry serves your custom HTML file and provides REST API endpoints for managing environment variables. Your HTML file can include inline `<script>` and `<link>` tags that Bun will automatically bundle.

### API Reference

All endpoints are served at `/api/*`:

#### `GET /api/config`

- **Purpose**: Load current environment variables
- **Response**: `Record<string, string>` - Object mapping variable names to values
- **Example**:
  ```javascript
  const response = await fetch("/api/config");
  const config = await response.json();
  // { "PORT": "3000", "DATABASE_URL": "postgres://..." }
  ```

#### `POST /api/config`

- **Purpose**: Save entire configuration (replaces all variables)
- **Request Body**: `Record<string, string>` - Complete config object
- **Headers**:
  - `Content-Type: application/json`
  - `X-Restart-Process: false` (optional) - Set to `"false"` to skip restart
- **Response**:
  ```json
  {
    "success": true,
    "error": null,
    "restarted": true
  }
  ```
- **Example**:
  ```javascript
  const response = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ PORT: "3000", DATABASE_URL: "postgres://..." }),
  });
  const result = await response.json();
  ```

#### `PATCH /api/config`

- **Purpose**: Update specific variables only (partial update)
- **Request Body**: `Record<string, string>` - Only variables to update
- **Headers**: Same as POST
- **Response**:
  ```json
  {
    "success": true,
    "error": null,
    "restarted": true,
    "updated": ["PORT"]
  }
  ```
- **Example**:
  ```javascript
  const response = await fetch("/api/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ PORT: "8080" }),
  });
  ```

#### `GET /api/status`

- **Purpose**: Check if managed process is running
- **Response**:
  ```json
  {
    "running": true,
    "lastError": null,
    "pid": 12345
  }
  ```
- **Example**:
  ```javascript
  const response = await fetch("/api/status");
  const status = await response.json();
  if (!status.running) {
    console.error("Process stopped:", status.lastError);
  }
  ```

#### `GET /api/example`

- **Purpose**: Load variable schema from `.env.example` (optional)
- **Response**: `Record<string, { description: string, defaultValue?: string, commented: boolean }>`
- **Example**:
  ```javascript
  const response = await fetch("/api/example");
  const schema = await response.json();
  // { "PORT": { description: "Server port", defaultValue: "3000", commented: false } }
  ```

### Basic HTML Template

Here's a minimal working template you can customize:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Config Manager</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        max-width: 800px;
        margin: 40px auto;
        padding: 20px;
      }
      .var-item {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
      }
      input {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      button {
        padding: 10px 20px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover {
        background: #0056b3;
      }
      .status {
        padding: 10px;
        margin-bottom: 20px;
        border-radius: 4px;
      }
      .status.running {
        background: #d4edda;
        color: #155724;
      }
      .status.stopped {
        background: #f8d7da;
        color: #721c24;
      }
    </style>
  </head>
  <body>
    <h1>Configuration Manager</h1>

    <div id="status" class="status">Loading...</div>

    <div id="configForm">
      <div id="vars"></div>
      <button id="addVar">Add Variable</button>
      <button id="saveBtn">Save & Restart</button>
    </div>

    <script type="module">
      let config = {};
      let status = { running: false };

      // Load initial data
      async function loadData() {
        const [configRes, statusRes] = await Promise.all([
          fetch("/api/config"),
          fetch("/api/status"),
        ]);
        config = await configRes.json();
        status = await statusRes.json();
        updateStatus();
        renderVars();
      }

      // Update status display
      function updateStatus() {
        const statusEl = document.getElementById("status");
        statusEl.textContent = status.running
          ? `✓ Running (PID: ${status.pid})`
          : `✗ Stopped${status.lastError ? `: ${status.lastError}` : ""}`;
        statusEl.className = `status ${status.running ? "running" : "stopped"}`;
      }

      // Render variables
      function renderVars() {
        const varsEl = document.getElementById("vars");
        varsEl.innerHTML = Object.entries(config)
          .map(
            ([key, value]) => `
          <div class="var-item">
            <input type="text" class="var-key" value="${key}" readonly>
            <input type="text" class="var-value" value="${value}" data-key="${key}">
            <button onclick="deleteVar('${key}')">Delete</button>
          </div>
        `,
          )
          .join("");
      }

      // Delete variable
      window.deleteVar = (key) => {
        delete config[key];
        renderVars();
      };

      // Add variable
      document.getElementById("addVar").addEventListener("click", () => {
        const key = prompt("Variable name:");
        if (key) {
          config[key] = "";
          renderVars();
        }
      });

      // Save configuration
      document.getElementById("saveBtn").addEventListener("click", async () => {
        // Collect current values
        const updated = {};
        document.querySelectorAll(".var-item").forEach((item) => {
          const key = item.querySelector(".var-key").value;
          const value = item.querySelector(".var-value").value;
          if (key) updated[key] = value;
        });

        const response = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });

        const result = await response.json();
        if (result.success) {
          alert("Config saved and process restarted!");
          await loadData();
        } else {
          alert(`Error: ${result.error}`);
        }
      });

      // Poll status
      setInterval(async () => {
        const res = await fetch("/api/status");
        status = await res.json();
        updateStatus();
      }, 2000);

      // Initial load
      loadData();
    </script>
  </body>
</html>
```

### Using Your Custom UI

Once you've created your HTML file, use it with the CLI:

```bash
# Serve custom UI at the default route (/)
bun run index.ts --cmd "node app.js" --html ./config-ui.html

# Serve custom UI at a custom route
bun run index.ts --cmd "node app.js" --html ./config-ui.html --html-route /admin/config

# With .env.example for schema support
bun run index.ts --cmd "node app.js" --html ./config-ui.html --example-env .env.example
```

### Advanced Features

#### Using Schema from .env.example

If you provide a `.env.example` file, you can load variable descriptions and defaults:

```javascript
// Load schema
const schemaRes = await fetch("/api/example");
const schema = await schemaRes.json();

// Use schema to show descriptions
Object.entries(schema).forEach(([key, meta]) => {
  console.log(`${key}: ${meta.description}`);
  if (meta.defaultValue) {
    console.log(`  Default: ${meta.defaultValue}`);
  }
});
```

#### Skipping Process Restart

To save config without restarting the process:

```javascript
const response = await fetch("/api/config", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Restart-Process": "false",
  },
  body: JSON.stringify(config),
});
```

#### Partial Updates

Update only specific variables without sending the entire config:

```javascript
// Only update PORT
const response = await fetch("/api/config", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ PORT: "8080" }),
});
```

### Best Practices

1. **Error Handling**: Always check `result.success` and `result.error` in API responses
2. **Status Polling**: Poll `/api/status` periodically to show real-time process status
3. **Validation**: Validate variable names (typically uppercase, alphanumeric + underscores)
4. **User Feedback**: Show loading states and success/error messages
5. **Schema Integration**: Use `/api/example` to provide helpful descriptions and defaults

See `src/ui/` for the modular UI implementation with separate files for HTML, CSS, and JavaScript modules.

## How It Works

1. **Config Management**: The app reads environment variables from a `.env` file at a customizable path
2. **Process Spawning**: When started, it spawns a child process with the environment variables from the `.env` file
3. **Web Interface**: Provides a web server with API endpoints for reading/updating config
4. **Auto-restart**: When config is updated via the API, the child process is automatically restarted with the new environment variables
5. **Error Tracking**: Captures stderr and stdout from the child process to help diagnose configuration issues

## Testing

Run the example app to test the config manager:

```bash
bun dev
```

This starts the config manager on port 3000, managing the example app (`example/index.ts`) which runs on port 4000. Visit `http://localhost:3000` to access the config UI.

The example app demonstrates:

- Reading environment variables
- Error handling (try removing `REQUIRED_VAR`)
- Process restart behavior
- Health checks

## Example Integration

Here's a complete example of using process-pastry with a custom UI:

1. **Create your custom UI** (`config-ui.html`):

   ```html
   <!doctype html>
   <html>
     <!-- Your custom UI code here -->
   </html>
   ```

2. **Run process-pastry with your UI**:

   ```bash
   bun run index.ts \
     --cmd "bun run my-server.ts" \
     --env .env \
     --html ./config-ui.html \
     --port 3000
   ```

3. **Visit** `http://localhost:3000` to access your configuration interface.

## Advanced: Programmatic API

For advanced use cases, you can also use process-pastry as a library:

```typescript
import { startServer } from "process-pastry";
import uiHtml from "./ui.html";

startServer({
  port: 3000,
  envPath: ".env",
  command: ["node", "app.js"],
  htmlRoute: "/",
  htmlContent: uiHtml,
  exampleEnvPath: ".env.example", // optional
});
```

**Note:** Most users should use the CLI interface. The programmatic API is available for integration into other applications or build tools.

## License

MIT
