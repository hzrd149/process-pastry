# process-pastry

A reusable Bun application that provides a web-based configuration interface for managing environment variables and restarting child processes. Built with Bun's fullstack server capabilities, allowing consuming apps to provide their own HTML UI.

## Features

- 🎨 **Default HTML UI** - Built-in web interface for managing environment variables (can be overridden)
- ⚙️ **Environment Management** - Read and write `.env` files at customizable paths
- 🔄 **Process Management** - Automatically restart child processes when configuration changes
- 📊 **Error Tracking** - Capture and display process errors in real-time
- 🚀 **Bun Fullstack** - Leverages Bun's automatic bundling of scripts and styles in HTML files
- 🔧 **Partial Updates** - PATCH endpoint for updating only specific variables
- ⏸️ **Skip Restart** - Optional header to save config without restarting the process

## Installation

```bash
bun install
```

## Usage

### CLI Mode

Run `process-pastry` as a command-line tool:

```bash
# Basic usage (uses default UI)
bun run index.ts --cmd "node app.js" --env .env

# With custom port
bun run index.ts --cmd "bun run server.ts" --env config/.env --port 8080

# With custom HTML UI (overrides default)
bun run index.ts --cmd "node app.js" --html ./ui.html --html-route /config
```

**Note:** If no `--html` option is provided, a default UI will be automatically served at the root route.

### CLI Options

- `--env, -e <path>` - Path to `.env` file (default: `.env`)
- `--cmd, -c <command>` - Command to run as child process (required)
- `--port, -p <port>` - Web server port (default: 3000)
- `--html, -h <path>` - Path to HTML file to serve as UI (optional)
- `--html-route <path>` - Route path for HTML UI (default: `/`)
- `--help` - Show help message

### Library Mode

Import and use programmatically:

```typescript
import { startServer } from "process-pastry";
import uiHtml from "./ui.html";

startServer({
  port: 3000,
  envPath: ".env",
  command: ["node", "app.js"],
  htmlRoute: "/",
  htmlContent: uiHtml,
});
```

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

Updates the configuration (merges with existing config) and optionally restarts the child process.

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

This is useful when you only want to update specific variables without sending the entire configuration.

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

## Creating a Custom HTML UI

Consuming apps can provide their own HTML file that will be automatically bundled by Bun. The HTML can include `<script>` and `<link>` tags that Bun will process.

**Basic structure:**
```html
<!doctype html>
<html>
  <head>
    <title>Config Manager</title>
    <style>/* your styles */</style>
  </head>
  <body>
    <form id="configForm">
      <!-- form fields -->
    </form>
    <script type="module">
      // Load config: fetch("/api/config")
      // Save config: POST /api/config
      // Check status: GET /api/status
    </script>
  </body>
</html>
```

**Using HTML imports:**
```typescript
import { startServer } from "process-pastry";
import uiHtml from "./ui.html"; // Bun processes this automatically

startServer({
  htmlContent: uiHtml, // Pass imported HTML
  // ... other options
});
```

Bun automatically bundles `<script>` and `<link>` tags. See `src/default-ui.html` for a complete example.

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

```typescript
import { startServer } from "process-pastry";
import configUI from "./config-ui.html";

startServer({
  port: 3000,
  envPath: ".env",
  command: ["bun", "run", "my-server.ts"],
  htmlContent: configUI,
});
```

## License

MIT
