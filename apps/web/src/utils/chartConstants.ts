/**
 * Unified chart and visualization constants for consistent styling across the app.
 * 
 * Color Scheme:
 * - Tropical Cyclones (TC): Blue tones
 * - Earthquakes (EQ): Yellow/Orange tones
 * - TIV/Portfolio: Purple tones
 * - Neutral/Grid: Gray tones
 */

// =============================================================================
// COLOR PALETTES
// =============================================================================

export const CHART_COLORS = {
  // Tropical Cyclone colors (blue spectrum)
  tc: {
    primary: 'bg-blue-500',
    primaryHex: '#3b82f6',
    secondary: 'bg-cyan-400',
    secondaryHex: '#22d3ee',
    gradient: 'from-blue-900/50 to-cyan-900/50',
    text: 'text-blue-400',
    border: 'border-blue-500',
  },
  
  // Earthquake colors (yellow/orange spectrum)
  eq: {
    primary: 'bg-yellow-500',
    primaryHex: '#eab308',
    secondary: 'bg-orange-400',
    secondaryHex: '#fb923c',
    gradient: 'from-yellow-900/50 to-orange-900/50',
    text: 'text-yellow-400',
    border: 'border-yellow-500',
  },
  
  // TIV/Portfolio colors (purple spectrum)
  tiv: {
    primary: 'bg-purple-500',
    primaryHex: '#a855f7',
    secondary: 'bg-violet-400',
    secondaryHex: '#a78bfa',
    gradient: 'from-purple-900/50 to-violet-900/50',
    text: 'text-purple-400',
    border: 'border-purple-500',
  },
  
  // Neutral colors for backgrounds and grids
  neutral: {
    cardBg: 'bg-gray-700/50',
    barBg: 'bg-gray-600',
    text: 'text-gray-400',
    textLight: 'text-gray-300',
    textDark: 'text-gray-500',
  },
  
  // Category-specific colors for hurricane categories
  hurricaneCategory: {
    0: '#22d3ee',   // TS - Cyan
    1: '#22c55e',   // Cat 1 - Green
    2: '#eab308',   // Cat 2 - Yellow
    3: '#f97316',   // Cat 3 - Orange
    4: '#ef4444',   // Cat 4 - Red
    5: '#dc2626',   // Cat 5 - Dark Red
  },
  
  // Magnitude-specific colors for earthquakes
  earthquakeMagnitude: {
    small: '#22c55e',     // M < 5 - Green
    moderate: '#eab308',  // M 5-6 - Yellow
    strong: '#f97316',    // M 6-7 - Orange
    major: '#ef4444',     // M 7-8 - Red
    great: '#dc2626',     // M 8+ - Dark Red
  },
} as const

// =============================================================================
// CHART DIMENSIONS
// =============================================================================

export const CHART_DIMENSIONS = {
  // Progress bar heights
  progressBar: {
    small: 'h-1.5',
    default: 'h-2',
    large: 'h-3',
  },
  
  // Bar chart heights
  barChart: {
    compact: 'h-12',
    default: 'h-16',
    tall: 'h-24',
  },
  
  // Card padding
  cardPadding: {
    compact: 'p-2',
    default: 'p-3',
    spacious: 'p-4',
  },
  
  // Spacing between items
  spacing: {
    tight: 'space-y-1',
    default: 'space-y-2',
    relaxed: 'space-y-3',
  },
} as const

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const CHART_TYPOGRAPHY = {
  // Stat labels
  label: 'text-xs text-gray-400 uppercase',
  labelNoCase: 'text-xs text-gray-400',
  
  // Stat values
  valueSmall: 'text-sm font-medium text-white',
  valueDefault: 'text-xl font-semibold text-white',
  valueLarge: 'text-2xl font-bold text-white',
  valueXLarge: 'text-3xl font-bold text-white',
  
  // Section headers
  sectionHeader: 'text-xs text-gray-400 mb-2 font-medium',
  
  // Chart axis labels
  axisLabel: 'text-[10px] text-gray-500',
} as const

// =============================================================================
// COMMON STYLES
// =============================================================================

export const CHART_STYLES = {
  // Card container
  card: 'bg-gray-700/50 p-3 rounded-lg',
  cardHover: 'bg-gray-700/50 p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors',
  
  // Progress bar container
  progressContainer: 'h-2 bg-gray-600 rounded-full overflow-hidden',
  
  // Gradient cards for main stats
  gradientCardTC: 'bg-gradient-to-r from-blue-900/50 to-cyan-900/50 p-4 rounded-lg',
  gradientCardEQ: 'bg-gradient-to-r from-yellow-900/50 to-orange-900/50 p-4 rounded-lg',
  gradientCardTIV: 'bg-gradient-to-r from-purple-900/50 to-violet-900/50 p-4 rounded-lg',
  
  // Icon with label row
  iconLabelRow: 'flex items-center space-x-1 mb-1',
  iconLabelRowLarge: 'flex items-center space-x-2 mb-1',
  
  // Stats grid
  statsGrid2: 'grid grid-cols-2 gap-3',
  statsGrid3: 'grid grid-cols-3 gap-2',
  statsGrid4: 'grid grid-cols-4 gap-2',
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get hurricane category color
 */
export function getHurricaneCategoryColor(category: number): string {
  if (category <= 0) return CHART_COLORS.hurricaneCategory[0]
  if (category >= 5) return CHART_COLORS.hurricaneCategory[5]
  return CHART_COLORS.hurricaneCategory[category as keyof typeof CHART_COLORS.hurricaneCategory]
}

/**
 * Get earthquake magnitude color
 */
export function getEarthquakeMagnitudeColor(magnitude: number): string {
  if (magnitude < 5) return CHART_COLORS.earthquakeMagnitude.small
  if (magnitude < 6) return CHART_COLORS.earthquakeMagnitude.moderate
  if (magnitude < 7) return CHART_COLORS.earthquakeMagnitude.strong
  if (magnitude < 8) return CHART_COLORS.earthquakeMagnitude.major
  return CHART_COLORS.earthquakeMagnitude.great
}

/**
 * Format large numbers with K/M/B suffix
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}

/**
 * Calculate percentage for progress bar
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.min(100, Math.max(0, (value / total) * 100))
}
