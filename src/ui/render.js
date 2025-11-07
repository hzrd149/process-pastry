/**
 * Rendering functions for UI components
 */

import { state } from "./state.js";
import { escapeHtml, linkifyUrls } from "./utils.js";
import { showAlert } from "./ui.js";
import { checkForChanges } from "./change-detection.js";

/**
 * Update variable presets datalist
 */
export function updateVarPresets() {
  const datalist = document.getElementById("varPresets");
  if (!datalist) return;

  datalist.innerHTML = "";
  const currentVars = new Set([
    ...Object.keys(state.envVars),
    ...Array.from(state.hiddenVars),
  ]);

  // Add variables from schema that aren't already in use
  Object.keys(state.envSchema).forEach((key) => {
    if (!currentVars.has(key)) {
      const option = document.createElement("option");
      option.value = key;
      const schema = state.envSchema[key];
      if (schema.description) {
        option.textContent = `${key} - ${schema.description.split("\n")[0]}`;
      } else {
        option.textContent = key;
      }
      datalist.appendChild(option);
    }
  });
}

/**
 * Render example variables section
 */
export function renderExampleVars() {
  const exampleVarsContainer = document.getElementById("exampleVarsContainer");
  const exampleSection = document.getElementById("exampleSection");
  const exampleCount = document.getElementById("exampleCount");

  if (!exampleVarsContainer || !exampleSection) return;

  exampleVarsContainer.innerHTML = "";

  // Get example variables (from schema but not in envVars and not hidden)
  const exampleVars = Object.keys(state.envSchema).filter(
    (key) => !state.envVars[key] && !state.hiddenVars.has(key),
  );

  if (exampleVars.length === 0) {
    exampleSection.style.display = "none";
    return;
  }

  exampleSection.style.display = "block";
  if (exampleCount) {
    exampleCount.textContent = `${exampleVars.length} available`;
  }

  exampleVars.sort().forEach((key) => {
    const schema = state.envSchema[key];
    const hasDescription = schema?.description;
    const hasDefault = schema?.defaultValue;

    const item = document.createElement("div");
    item.className = "example-var-item";

    let descriptionHtml = "";
    if (hasDescription) {
      const linkifiedDesc = linkifyUrls(schema.description);
      descriptionHtml = `<div class="example-var-description">${linkifiedDesc}</div>`;
    }

    let defaultHtml = "";
    if (hasDefault) {
      defaultHtml = `<div class="example-var-default">Default: ${escapeHtml(schema.defaultValue)}</div>`;
    }

    item.innerHTML = `
      <div class="example-var-header">
        <span class="example-var-name">${escapeHtml(key)}</span>
        <button type="button" class="example-var-add-btn" data-key="${key}">
          Add
        </button>
      </div>
      ${descriptionHtml}
      ${defaultHtml}
    `;
    exampleVarsContainer.appendChild(item);
  });

  // Add event listeners for add buttons
  document.querySelectorAll(".example-var-add-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const key = e.target.dataset.key;
      const schema = state.envSchema[key];
      // Add to envVars with default value if available
      const defaultValue = schema?.defaultValue || "";
      state.envVars[key] = defaultValue;
      // Don't set originalEnvVars for new variables - this marks them as modified
      state.hiddenVars.delete(key);
      checkForChanges();
      renderEnvVars();
      renderExampleVars();
      updateVarPresets();
      showAlert(`Added ${key} to configuration`, "success");
    });
  });
}

/**
 * Render environment variables list
 */
export function renderEnvVars() {
  const envVarsContainer = document.getElementById("envVarsContainer");
  if (!envVarsContainer) return;

  envVarsContainer.innerHTML = "";

  // Only show variables that are actually in envVars
  const sortedVars = Object.keys(state.envVars).sort();

  if (sortedVars.length === 0) {
    envVarsContainer.innerHTML = `
      <div class="empty-state">
        <p>No environment variables configured</p>
        <p style="font-size: 12px; margin-top: 4px;">Add a variable above or from the example section below</p>
      </div>
    `;
  } else {
    sortedVars.forEach((key) => {
      const value = state.envVars[key] || "";
      const schema = state.envSchema[key];
      const hasDescription = schema?.description;

      const item = document.createElement("div");
      item.className = "env-var-item";

      let descriptionHtml = "";
      if (hasDescription) {
        const linkifiedDesc = linkifyUrls(schema.description);
        descriptionHtml = `<div class="env-var-description">${linkifiedDesc}</div>`;
      }

      // Check if this variable has been modified
      const isModified = state.originalEnvVars[key] !== value;
      const modifiedClass = isModified ? "modified" : "";

      item.innerHTML = `
        <div class="env-var-item-row">
          <input
            type="text"
            value="${escapeHtml(key)}"
            data-key="${escapeHtml(key)}"
            class="var-key"
            placeholder="Variable name"
          />
          <input
            type="text"
            value="${escapeHtml(value)}"
            data-key="${escapeHtml(key)}"
            class="var-value"
            placeholder="${escapeHtml(schema?.defaultValue || "Value")}"
          />
          <button type="button" class="delete-var" data-key="${escapeHtml(key)}">Delete</button>
        </div>
        ${descriptionHtml}
      `;
      item.className = `env-var-item ${modifiedClass}`;
      envVarsContainer.appendChild(item);
    });
  }

  // Add event listeners
  attachEnvVarListeners();
}

/**
 * Attach event listeners to environment variable inputs
 */
function attachEnvVarListeners() {
  document.querySelectorAll(".var-key").forEach((input) => {
    input.addEventListener("change", (e) => {
      const oldKey = e.target.dataset.key;
      const newKey = e.target.value.trim();
      if (newKey && newKey !== oldKey) {
        // Move value from old key to new key
        if (state.envVars[oldKey]) {
          state.envVars[newKey] = state.envVars[oldKey];
          delete state.envVars[oldKey];
          // Update original tracking
          if (state.originalEnvVars[oldKey] !== undefined) {
            state.originalEnvVars[newKey] = state.originalEnvVars[oldKey];
            delete state.originalEnvVars[oldKey];
          }
        } else {
          // If it was from schema, add it to envVars with default or empty
          const defaultValue = state.envSchema[oldKey]?.defaultValue || "";
          state.envVars[newKey] = defaultValue;
          state.originalEnvVars[newKey] = defaultValue;
        }

        // Update hidden vars
        if (state.hiddenVars.has(oldKey)) {
          state.hiddenVars.delete(oldKey);
          state.hiddenVars.add(newKey);
        }

        e.target.dataset.key = newKey;
        e.target
          .closest(".env-var-item")
          .querySelector(".var-value").dataset.key = newKey;
        e.target
          .closest(".env-var-item")
          .querySelector(".delete-var").dataset.key = newKey;

        checkForChanges();
        renderEnvVars();
        renderExampleVars();
        updateVarPresets();
      }
    });
  });

  document.querySelectorAll(".var-value").forEach((input) => {
    input.addEventListener("input", (e) => {
      const key = e.target.dataset.key;
      const value = e.target.value;
      // If it was from schema, add it to envVars when user changes it
      if (!state.envVars[key] && state.envSchema[key]) {
        state.hiddenVars.delete(key); // Remove from hidden if it was there
        updateVarPresets();
      }
      state.envVars[key] = value;
      checkForChanges();
      // Update the modified class on the current item without re-rendering
      const item = e.target.closest(".env-var-item");
      if (item) {
        const isModified = state.originalEnvVars[key] !== value;
        if (isModified) {
          item.classList.add("modified");
        } else {
          item.classList.remove("modified");
        }
      }
    });
  });

  document.querySelectorAll(".delete-var").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const key = e.target.dataset.key;
      // Remove from envVars if it exists there
      if (state.envVars[key]) {
        delete state.envVars[key];
      }
      // Don't remove from originalEnvVars - this allows checkForChanges to detect the deletion
      // originalEnvVars will be updated when saving successfully
      // Only hide from examples if it's NOT in the schema (custom variable)
      // Schema variables should reappear in examples after deletion
      if (state.envSchema[key]) {
        state.hiddenVars.delete(key); // Remove from hidden so it can show in examples
      } else {
        state.hiddenVars.add(key); // Hide custom variables from examples
      }
      checkForChanges();
      renderEnvVars();
      renderExampleVars();
      updateVarPresets();
    });
  });
}
