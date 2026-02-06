/**
 * API service for indemnity historical events.
 * Fetches significant earthquakes and hurricanes for TIV impact analysis.
 */

const API_BASE = `${import.meta.env.VITE_API_URL || '/api'}/indemnity`

// =============================================================================
// TYPES
// =============================================================================

export interface HistoricalEarthquake {
  id: string
  name: string
  magnitude: number
  lat: number
  lon: number
  date: string
  depth_km?: number
  deaths?: number
  damage_usd?: number
  significance_score: number
}

export interface HurricaneTrackPoint {
  lat: number
  lon: number
  time: string
  wind_mph: number
  pressure_mb?: number
  category?: number
  status: string
}

export interface HistoricalHurricane {
  id: string
  name: string
  season: number
  max_category: number
  max_wind_mph: number
  min_pressure_mb?: number
  damage_usd?: number
  deaths?: number
  significance_score: number
  track: HurricaneTrackPoint[]
}

export interface HistoricalSummary {
  earthquakes: {
    datasets: string[]
    year_range: { min: number; max: number }
    magnitude_range: { min: number; max: number }
    default_mode: 'all' | 'significant'
    default_limit: number
  }
  hurricanes: {
    datasets: string[]
    year_range: { min: number; max: number }
    basins: string[]
    category_range: { min: number; max: number }
    default_mode: 'all' | 'significant'
    default_limit: number
  }
}

export type LoadMode = 'all' | 'significant'

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch historical earthquakes for indemnity analysis.
 */
export async function fetchHistoricalEarthquakes(options: {
  mode?: LoadMode
  limit?: number
  startYear?: number
  endYear?: number
  minMagnitude?: number
}): Promise<HistoricalEarthquake[]> {
  const params = new URLSearchParams()
  
  if (options.mode) params.append('mode', options.mode)
  if (options.limit) params.append('limit', options.limit.toString())
  if (options.startYear) params.append('start_year', options.startYear.toString())
  if (options.endYear) params.append('end_year', options.endYear.toString())
  if (options.minMagnitude) params.append('min_magnitude', options.minMagnitude.toString())
  
  const response = await fetch(`${API_BASE}/historical/earthquakes?${params}`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch earthquakes: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch historical hurricanes for indemnity analysis.
 */
export async function fetchHistoricalHurricanes(options: {
  mode?: LoadMode
  limit?: number
  startYear?: number
  endYear?: number
  minCategory?: number
  basin?: string
}): Promise<HistoricalHurricane[]> {
  const params = new URLSearchParams()
  
  if (options.mode) params.append('mode', options.mode)
  if (options.limit) params.append('limit', options.limit.toString())
  if (options.startYear) params.append('start_year', options.startYear.toString())
  if (options.endYear) params.append('end_year', options.endYear.toString())
  if (options.minCategory) params.append('min_category', options.minCategory.toString())
  if (options.basin) params.append('basin', options.basin)
  
  const response = await fetch(`${API_BASE}/historical/hurricanes?${params}`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch hurricanes: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch summary of available historical data.
 */
export async function fetchHistoricalSummary(): Promise<HistoricalSummary> {
  const response = await fetch(`${API_BASE}/historical/summary`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch summary: ${response.statusText}`)
  }
  
  return response.json()
}
