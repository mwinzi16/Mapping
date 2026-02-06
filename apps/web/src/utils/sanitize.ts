/**
 * Escape a value for safe insertion into an HTML string.
 *
 * Replaces the five characters that have special meaning in HTML
 * (&, <, >, ", ') with their entity equivalents.  Returns an empty
 * string for nullish inputs so callers don't have to guard every
 * template slot individually.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
