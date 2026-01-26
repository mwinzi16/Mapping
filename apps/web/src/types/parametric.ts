/**
 * Types for the Parametric Insurance Analysis feature.
 */

export type DatasetType = 'ibtracs' | 'hurdat2_atlantic' | 'hurdat2_pacific'

export interface TriggerCriteria {
  min_category?: number
  min_wind_knots?: number
  max_pressure_mb?: number
}

/**
 * Payout structure for parametric insurance.
 * Defines payout amounts based on event intensity.
 */
export interface PayoutStructure {
  basePayout: number  // Base payout amount (USD) or limit for percentage-based
  currency: string    // Currency code (USD, EUR, etc.)
  payoutType: 'binary' | 'percentage' | 'tiered'  // Type of payout calculation
  // Tiered payouts based on event intensity
  tiers: PayoutTier[]
}

export interface PayoutTier {
  id: string
  name: string
  // For hurricanes: category threshold, for earthquakes: magnitude threshold
  minIntensity: number
  maxIntensity?: number
  // For binary or multiplier-based payouts
  payoutMultiplier: number  // Multiplier applied to base payout
  fixedPayout?: number      // Or fixed payout amount
  // For percentage-based payouts (non-binary)
  payoutPercent?: number    // Percentage of base payout (0-100)
}

export interface BoundingBox {
  id: string
  name: string
  north: number  // Max latitude
  south: number  // Min latitude
  east: number   // Max longitude
  west: number   // Min longitude
  color?: string
  trigger?: TriggerCriteria
  payout?: PayoutStructure  // Payout configuration for this zone
}

export interface DatasetInfo {
  id: string
  name: string
  description: string
  basins: string[]
  year_range: [number, number]
  source_url: string
}

export interface HistoricalHurricane {
  storm_id: string
  name: string
  year: number
  basin: string
  max_category: number
  max_wind_knots: number
  min_pressure_mb: number | null
  track: HurricaneTrackPoint[]
  start_date: string
  end_date: string
}

export interface HurricaneTrackPoint {
  timestamp: string
  latitude: number
  longitude: number
  wind_knots: number
  pressure_mb: number | null
  category: number
  status: string
}

export interface BoxIntersection {
  box_id: string
  hurricane: HistoricalHurricane
  entry_point: HurricaneTrackPoint
  exit_point?: HurricaneTrackPoint
  max_intensity_in_box: number  // Max wind speed while in box
  min_pressure_in_box?: number  // Min pressure while in box
  category_at_crossing: number
}

export interface BoxStatistics {
  box_id: string
  box_name: string
  total_hurricanes: number
  qualifying_hurricanes: number  // Hurricanes meeting trigger criteria
  years_analyzed: number
  annual_frequency: number
  qualifying_annual_frequency: number
  category_distribution: Record<number, number>  // Category -> count
  monthly_distribution: Record<number, number>   // Month -> count
  average_intensity_knots: number
  max_intensity_knots: number
  trigger_probability: number  // Probability of at least one qualifying crossing per year
  trigger_criteria?: TriggerCriteria
  dataset: string
}

export interface AnalysisFilters {
  startYear: number
  endYear: number
  minCategory: number
  basin: string | null
  dataset: DatasetType
}

// =====================
// Earthquake Types
// =====================

export type EarthquakeDatasetType = 'usgs_worldwide' | 'usgs_us'

export interface EarthquakeTriggerCriteria {
  min_magnitude?: number
  max_depth_km?: number
  min_depth_km?: number
}

export interface EarthquakeBoundingBox {
  id: string
  name: string
  north: number
  south: number
  east: number
  west: number
  color?: string
  trigger?: EarthquakeTriggerCriteria
  payout?: PayoutStructure  // Payout configuration for this zone
}

export interface EarthquakeDatasetInfo {
  id: string
  name: string
  description: string
  coverage: string
  year_range: [number, number]
  source_url: string
}

export interface HistoricalEarthquake {
  event_id: string
  magnitude: number
  magnitude_type?: string
  place: string
  event_time: string
  latitude: number
  longitude: number
  depth_km: number
  significance: number
  tsunami: number
  url?: string
}

export interface EarthquakeBoxStatistics {
  box_id: string
  box_name: string
  total_earthquakes: number
  qualifying_earthquakes: number
  years_analyzed: number
  annual_frequency: number
  qualifying_annual_frequency: number
  magnitude_distribution: Record<string, number>
  depth_distribution: Record<string, number>
  monthly_distribution: Record<number, number>
  average_magnitude: number
  max_magnitude: number
  average_depth_km: number
  shallowest_depth_km: number
  trigger_probability: number
  trigger_criteria?: EarthquakeTriggerCriteria
  dataset: string
}

export interface EarthquakeAnalysisFilters {
  startYear: number
  endYear: number
  minMagnitude: number
  dataset: EarthquakeDatasetType
}

// =====================
// Stress Testing Types
// =====================

/**
 * Configuration for stress-testing trigger zones.
 * Allows extending boundaries and varying parameters.
 */
export interface StressTestConfig {
  // Boundary extension (percentage or fixed km)
  boundaryExtensionKm: number
  boundaryExtensionPercent: number
  usePerecentageExtension: boolean
  
  // Whether to extend cluster boundaries only (not individual boxes)
  extendClusterOnly: boolean
  
  // Enabled state
  enabled: boolean
}

/**
 * Stress test parameter variations for earthquakes.
 */
export interface EarthquakeStressTestParams {
  // Magnitude variations to test
  magnitudeVariations: number[]  // e.g., [-0.5, 0, +0.5]
  
  // Depth variations (km)
  depthVariations: number[]  // e.g., [-10, 0, +10]
}

/**
 * Stress test parameter variations for hurricanes.
 */
export interface HurricaneStressTestParams {
  // Category variations to test
  categoryVariations: number[]  // e.g., [-1, 0, +1]
  
  // Wind speed variations (knots)
  windVariations: number[]  // e.g., [-10, 0, +10]
}

/**
 * Result from a single stress test scenario.
 */
export interface StressTestResult {
  scenarioName: string
  parameterAdjustments: Record<string, number>
  boundaryExtensionKm: number
  triggerProbability: number
  qualifyingEvents: number
  totalEvents: number
  percentageChange: number  // vs baseline
}

/**
 * Extended box with computed stress test boundaries.
 */
export interface ExtendedBoundingBox {
  original: {
    north: number
    south: number
    east: number
    west: number
  }
  extended: {
    north: number
    south: number
    east: number
    west: number
  }
  extensionKm: number
}

// =====================
// Overall Statistics Types
// =====================

/**
 * Options for calculating overall payout aggregation.
 */
export interface PayoutAggregationOptions {
  // 'worst_only' - each event triggers only the worst (highest payout) box
  // 'capped_100' - sum of payouts per event capped at 100% of limit
  // 'sum_all' - sum all payouts (no cap)
  mode: 'worst_only' | 'capped_100' | 'sum_all'
}

/**
 * Overall statistics aggregated across all boxes.
 */
export interface OverallStatistics {
  totalBoxes: number
  totalEvents: number
  totalQualifyingEvents: number
  yearsAnalyzed: number
  overallAnnualFrequency: number
  overallTriggerProbability: number
  
  // Payout-related aggregations
  expectedAnnualPayout: number
  maxSingleEventPayout: number
  totalHistoricalPayouts: number
  avgPayoutPerEvent: number
  
  // Distribution by event (for deduplication)
  eventsWithMultipleBoxes: number
  avgBoxesPerEvent: number
  
  // Settings used
  aggregationMode: PayoutAggregationOptions['mode']
}

/**
 * Stress test comparison between baseline and extended scenarios.
 */
export interface StressTestComparison {
  baseline: OverallStatistics
  extended: OverallStatistics
  
  // Deltas
  triggerProbabilityDelta: number
  expectedPayoutDelta: number
  qualifyingEventsDelta: number
  
  // Percentage changes
  triggerProbabilityChange: number
  expectedPayoutChange: number
  qualifyingEventsChange: number
}
