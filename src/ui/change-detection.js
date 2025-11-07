/**
 * Change detection and tracking
 */

import { state } from "./state.js";
import { updateModifiedIndicator } from "./ui.js";

/**
 * Check if there are any unsaved changes
 */
export function checkForChanges() {
  // Compare current envVars with originalEnvVars
  const currentKeys = new Set(Object.keys(state.envVars));
  const originalKeys = new Set(Object.keys(state.originalEnvVars));

  // Check if keys have been added or removed
  if (currentKeys.size !== originalKeys.size) {
    state.hasUnsavedChanges = true;
    updateModifiedIndicator(true);
    return;
  }

  // Check if any values have changed
  for (const key of currentKeys) {
    if (state.envVars[key] !== state.originalEnvVars[key]) {
      state.hasUnsavedChanges = true;
      updateModifiedIndicator(true);
      return;
    }
  }

  // Check if any original keys were removed
  for (const key of originalKeys) {
    if (!currentKeys.has(key)) {
      state.hasUnsavedChanges = true;
      updateModifiedIndicator(true);
      return;
    }
  }

  state.hasUnsavedChanges = false;
  updateModifiedIndicator(false);
}
