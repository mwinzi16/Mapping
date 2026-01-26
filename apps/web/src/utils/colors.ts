/**
 * Get color for earthquake magnitude using a consistent scale.
 * Based on standard seismological practices.
 */
export function getMagnitudeColor(magnitude: number): string {
  if (magnitude < 3) return '#22c55e'      // Green - Minor
  if (magnitude < 4) return '#84cc16'      // Lime - Light
  if (magnitude < 5) return '#eab308'      // Yellow - Light
  if (magnitude < 6) return '#f97316'      // Orange - Moderate
  if (magnitude < 7) return '#ef4444'      // Red - Strong
  if (magnitude < 8) return '#dc2626'      // Dark Red - Major
  return '#7c2d12'                          // Brown-Red - Great
}

/**
 * Get color for hurricane category using Saffir-Simpson scale.
 */
export function getCategoryColor(category: number | null): string {
  if (category === null) return '#3b82f6'  // Blue - Tropical Storm
  if (category === 1) return '#fbbf24'      // Yellow
  if (category === 2) return '#f97316'      // Orange
  if (category === 3) return '#ef4444'      // Red
  if (category === 4) return '#dc2626'      // Dark Red
  if (category === 5) return '#7c2d12'      // Brown-Red
  return '#6b7280'                          // Gray - Depression
}

/**
 * Get color for wildfire based on confidence/FRP.
 */
export function getWildfireColor(confidence?: number, frp?: number): string {
  // Use FRP (Fire Radiative Power) if available
  if (frp !== undefined) {
    if (frp < 10) return '#fbbf24'        // Yellow - Low intensity
    if (frp < 50) return '#f97316'        // Orange - Moderate
    if (frp < 100) return '#ef4444'       // Red - High
    return '#dc2626'                       // Dark Red - Extreme
  }
  // Fallback to confidence
  if (confidence !== undefined) {
    if (confidence < 50) return '#fbbf24'
    if (confidence < 80) return '#f97316'
    return '#ef4444'
  }
  return '#f97316'  // Default orange
}

/**
 * Get color for tornado based on EF scale.
 */
export function getTornadoColor(efScale?: number): string {
  if (efScale === undefined || efScale === null) return '#8b5cf6'  // Purple - Unknown
  if (efScale === 0) return '#a855f7'     // Light Purple - EF0
  if (efScale === 1) return '#7c3aed'     // Purple - EF1
  if (efScale === 2) return '#6d28d9'     // Dark Purple - EF2
  if (efScale === 3) return '#5b21b6'     // Darker Purple - EF3
  if (efScale === 4) return '#4c1d95'     // Very Dark Purple - EF4
  return '#3b0764'                         // Deepest Purple - EF5
}

/**
 * Get color for flooding severity.
 */
export function getFloodingColor(severity?: string): string {
  switch (severity?.toLowerCase()) {
    case 'minor': return '#3b82f6'        // Blue
    case 'moderate': return '#0ea5e9'     // Sky Blue
    case 'major': return '#0284c7'        // Dark Blue
    case 'extreme': return '#1e3a8a'      // Navy
    default: return '#60a5fa'             // Light Blue
  }
}

/**
 * Get color for hail based on size.
 */
export function getHailColor(sizeInches?: number): string {
  if (sizeInches === undefined) return '#06b6d4'  // Cyan - Unknown
  if (sizeInches < 1) return '#22d3d1'    // Teal - Small (< quarter)
  if (sizeInches < 1.75) return '#14b8a6' // Green-teal - Medium (quarter to golf ball)
  if (sizeInches < 2.5) return '#0d9488'  // Dark Teal - Large (golf ball to tennis)
  return '#0f766e'                         // Darkest Teal - Giant (> tennis ball)
}

/**
 * Get human-readable label for earthquake magnitude.
 */
export function getMagnitudeLabel(magnitude: number): string {
  if (magnitude < 3) return 'Minor'
  if (magnitude < 4) return 'Light'
  if (magnitude < 5) return 'Light'
  if (magnitude < 6) return 'Moderate'
  if (magnitude < 7) return 'Strong'
  if (magnitude < 8) return 'Major'
  return 'Great'
}

/**
 * Get human-readable label for hurricane category.
 */
export function getCategoryLabel(category: number | null): string {
  if (category === null) return 'Tropical Storm'
  if (category === 1) return 'Category 1'
  if (category === 2) return 'Category 2'
  if (category === 3) return 'Category 3 (Major)'
  if (category === 4) return 'Category 4 (Major)'
  if (category === 5) return 'Category 5 (Major)'
  return 'Tropical Depression'
}

/**
 * Get EF scale label.
 */
export function getTornadoLabel(efScale?: number): string {
  if (efScale === undefined || efScale === null) return 'Unknown'
  return `EF${efScale}`
}

/**
 * Get hail size description.
 */
export function getHailLabel(sizeInches?: number): string {
  if (sizeInches === undefined) return 'Unknown'
  if (sizeInches < 0.5) return 'Pea size'
  if (sizeInches < 1) return 'Quarter size'
  if (sizeInches < 1.75) return 'Golf ball'
  if (sizeInches < 2.5) return 'Tennis ball'
  if (sizeInches < 4) return 'Softball'
  return 'Grapefruit+'
}

/**
 * Format wind speed with appropriate units.
 */
export function formatWindSpeed(mph: number): string {
  return `${mph} mph (${Math.round(mph * 1.60934)} km/h)`
}

/**
 * Event type icons (emoji representation).
 */
export const eventIcons = {
  earthquake: '🔴',
  hurricane: '🌀',
  wildfire: '🔥',
  tornado: '🌪️',
  flooding: '🌊',
  hail: '🧊',
}
