/**
 * Application state management
 */

export const state = {
  envVars: {},
  originalEnvVars: {}, // Track original values to detect changes
  envSchema: {},
  hiddenVars: new Set(), // Track variables user has explicitly removed
  hasUnsavedChanges: false,
};

/**
 * Reset state to initial values
 */
export function resetState() {
  state.envVars = {};
  state.originalEnvVars = {};
  state.envSchema = {};
  state.hiddenVars = new Set();
  state.hasUnsavedChanges = false;
}

/**
 * Update original values after a successful save
 */
export function updateOriginalValues() {
  state.originalEnvVars = JSON.parse(JSON.stringify(state.envVars));
  state.hasUnsavedChanges = false;
}
