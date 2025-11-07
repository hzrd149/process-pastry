/**
 * API communication functions
 */

import { state, updateOriginalValues } from "./state.js";
import { showAlert } from "./ui.js";
import { renderEnvVars } from "./render.js";

const API_PREFIX = "/process-pastry/api";

/**
 * Load environment variable schema from the server
 * @returns {Promise<boolean>} Success status
 */
export async function loadSchema() {
  try {
    const res = await fetch(`${API_PREFIX}/example`);
    if (!res.ok) throw new Error("Failed to load schema");
    state.envSchema = await res.json();
    return true;
  } catch (error) {
    console.warn("Failed to load schema:", error);
    state.envSchema = {};
    return false;
  }
}

/**
 * Load current configuration from the server
 * @returns {Promise<boolean>} Success status
 */
export async function loadConfig() {
  try {
    const res = await fetch(`${API_PREFIX}/config`);
    if (!res.ok) throw new Error("Failed to load config");
    state.envVars = await res.json();
    // Store original values for comparison
    state.originalEnvVars = JSON.parse(JSON.stringify(state.envVars));
    state.hasUnsavedChanges = false;
    return true;
  } catch (error) {
    showAlert(`Failed to load config: ${error.message}`, "error");
    return false;
  }
}

/**
 * Update process status from the server
 * @param {HTMLElement} statusIndicator - Status indicator element
 * @param {HTMLElement} statusText - Status text element
 * @param {HTMLElement} errorCard - Error card element
 * @param {HTMLElement} errorLog - Error log element
 */
export async function updateStatus(
  statusIndicator,
  statusText,
  errorCard,
  errorLog,
) {
  try {
    const res = await fetch(`${API_PREFIX}/status`);
    if (!res.ok) throw new Error("Failed to get status");
    const status = await res.json();

    statusIndicator.className = `status-indicator ${status.running ? "running" : ""}`;
    statusText.textContent = status.running
      ? `✓ Process Running${status.pid ? ` (PID: ${status.pid})` : ""}`
      : "✗ Process Stopped";

    if (status.lastError) {
      errorCard.style.display = "block";
      errorLog.textContent = status.lastError;
    } else {
      errorCard.style.display = "none";
    }
  } catch (error) {
    console.error("Failed to update status:", error);
  }
}

/**
 * Save configuration to the server
 * @param {boolean} restart - Whether to restart the process
 * @param {HTMLElement} saveBtn - Save button element
 * @param {Function} updateModifiedIndicator - Function to update modified indicator
 * @param {Function} updateStatusCallback - Function to update status after save
 * @returns {Promise<void>}
 */
export async function saveConfig(
  restart = true,
  saveBtn,
  updateModifiedIndicator,
  updateStatusCallback,
) {
  // Collect current values from inputs
  const currentVars = {};
  document.querySelectorAll(".env-var-item").forEach((item) => {
    const keyInput = item.querySelector(".var-key");
    const valueInput = item.querySelector(".var-value");
    if (keyInput && valueInput) {
      const key = keyInput.value.trim();
      const value = valueInput.value.trim();
      if (key) {
        currentVars[key] = value;
      }
    }
  });

  saveBtn.disabled = true;
  saveBtn.textContent = "🔄 Saving & Restarting...";

  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (!restart) {
      headers["X-Restart-Process"] = "false";
    }

    const res = await fetch(`${API_PREFIX}/config`, {
      method: "POST",
      headers,
      body: JSON.stringify(currentVars),
    });

    const result = await res.json();

    if (result.success) {
      state.envVars = currentVars;
      // Update original values after successful save
      updateOriginalValues();
      updateModifiedIndicator(false);
      // Re-render to clear modified indicators
      renderEnvVars();
      if (result.error) {
        showAlert(
          `⚠️ Config saved but process error: ${result.error}`,
          "warning",
        );
      } else {
        showAlert(
          restart
            ? "✓ Config saved and process restarted successfully!"
            : "✓ Config saved successfully!",
          "success",
        );
      }
    } else {
      showAlert(`Error: ${result.error}`, "error");
    }
  } catch (error) {
    showAlert(`Failed to save config: ${error.message}`, "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 Save & Restart";
    if (updateStatusCallback) {
      updateStatusCallback();
    }
  }
}
