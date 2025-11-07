/**
 * UI helper functions
 */

/**
 * Show an alert message
 * @param {string} message - Message to display
 * @param {string} type - Alert type (success, error, warning)
 */
export function showAlert(message, type) {
  const alertDiv = document.getElementById("alert");
  if (!alertDiv) return;

  alertDiv.className = `alert ${type} show`;
  alertDiv.textContent = message;
  setTimeout(() => {
    alertDiv.className = "alert";
    alertDiv.textContent = "";
  }, 5000);
}

/**
 * Update the modified indicator visibility
 * @param {boolean} hasChanges - Whether there are unsaved changes
 */
export function updateModifiedIndicator(hasChanges) {
  const modifiedIndicator = document.getElementById("modifiedIndicator");
  if (modifiedIndicator) {
    modifiedIndicator.style.display = hasChanges ? "inline-block" : "none";
  }
}
