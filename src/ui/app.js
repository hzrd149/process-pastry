/**
 * Main application initialization and event handlers
 */

import { state } from "./state.js";
import { loadSchema, loadConfig, updateStatus, saveConfig } from "./api.js";
import {
  renderEnvVars,
  renderExampleVars,
  updateVarPresets,
} from "./render.js";
import { showAlert, updateModifiedIndicator } from "./ui.js";
import { checkForChanges } from "./change-detection.js";

/**
 * Initialize the application
 */
export async function init() {
  // Get DOM elements
  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");
  const errorCard = document.getElementById("errorCard");
  const errorLog = document.getElementById("errorLog");
  const saveBtn = document.getElementById("saveBtn");
  const addVarBtn = document.getElementById("addVarBtn");
  const newVarKey = document.getElementById("newVarKey");
  const newVarValue = document.getElementById("newVarValue");
  const exampleHeader = document.getElementById("exampleHeader");
  const exampleVarsContainer = document.getElementById("exampleVarsContainer");

  // Initial load
  await loadSchema();
  await loadConfig();
  renderEnvVars();
  renderExampleVars();
  updateVarPresets();
  updateStatus(statusIndicator, statusText, errorCard, errorLog);

  // Poll status every 2 seconds
  setInterval(() => {
    updateStatus(statusIndicator, statusText, errorCard, errorLog);
  }, 2000);

  // Save button handler
  saveBtn.addEventListener("click", () => {
    saveConfig(
      true,
      saveBtn,
      () => updateModifiedIndicator(state.hasUnsavedChanges),
      () => updateStatus(statusIndicator, statusText, errorCard, errorLog),
    );
  });

  // Add variable button handler
  addVarBtn.addEventListener("click", () => {
    const key = newVarKey.value.trim();
    const value = newVarValue.value.trim();

    if (!key) {
      showAlert("Please enter a variable name", "warning");
      return;
    }

    // Check if variable already exists in current config
    const allCurrentVars = new Set([
      ...Object.keys(state.envVars),
      ...Array.from(state.hiddenVars),
    ]);
    if (allCurrentVars.has(key)) {
      showAlert(`Variable ${key} already exists`, "warning");
      return;
    }

    // If it was hidden, remove from hidden set
    state.hiddenVars.delete(key);

    // Use user's value if provided, otherwise use default value from schema
    const finalValue = value || state.envSchema[key]?.defaultValue || "";
    state.envVars[key] = finalValue;
    // Don't set originalEnvVars for new variables - this marks them as modified

    newVarKey.value = "";
    newVarValue.value = "";
    const presetHint = document.getElementById("presetHint");
    if (presetHint) {
      presetHint.style.display = "none";
    }
    checkForChanges();
    renderEnvVars();
    renderExampleVars();
    updateVarPresets();
  });

  // Show preset hint when typing
  newVarKey.addEventListener("input", (e) => {
    const key = e.target.value.trim();
    const hint = document.getElementById("presetHint");
    if (!hint) return;

    if (key && state.envSchema[key]) {
      const schema = state.envSchema[key];
      let hintText = schema.description
        ? schema.description.split("\n")[0]
        : "Available variable";
      if (schema.defaultValue) {
        hintText += ` (default: ${schema.defaultValue})`;
      }
      hint.textContent = hintText;
      hint.style.display = "block";
    } else {
      hint.style.display = "none";
    }
  });

  // Toggle example section
  if (exampleHeader && exampleVarsContainer) {
    exampleHeader.addEventListener("click", () => {
      exampleHeader.classList.toggle("expanded");
      exampleVarsContainer.classList.toggle("expanded");
    });
  }

  // Warn user before leaving if there are unsaved changes
  window.addEventListener("beforeunload", (e) => {
    if (state.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue =
        "You have unsaved changes. Are you sure you want to leave?";
      return e.returnValue;
    }
  });

  // Allow Enter key to add variable
  newVarKey.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      newVarValue.focus();
    }
  });

  newVarValue.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addVarBtn.click();
    }
  });
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
