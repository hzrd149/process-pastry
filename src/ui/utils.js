/**
 * Utility functions for the UI
 */

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Converts URLs in text to clickable links
 * @param {string} text - Text that may contain URLs
 * @returns {string} HTML with linked URLs
 */
export function linkifyUrls(text) {
  if (!text) return "";
  // Escape HTML first to prevent XSS
  const escaped = escapeHtml(text);
  // Match URLs: http://, https://, or www.
  const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;
  return escaped.replace(urlRegex, (url) => {
    let href = url;
    if (url.startsWith("www.")) {
      href = `https://${url}`;
    }
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}
