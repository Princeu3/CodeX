/**
 * Escapes HTML characters.
 */
export function escapeHtml(text) {
  return text.replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
}

/**
 * Returns a promise that resolves after ms milliseconds.
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms)); 