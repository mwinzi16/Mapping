/**
 * API service for indemnity historical events.
 * Fetches significant earthquakes and hurricanes for TIV impact analysis.
 */

import { client } from './api'

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
  const response = await client.get('/indemnity/historical/earthquakes', {
    params: {
      mode: options.mode,
      limit: options.limit,
      start_year: options.startYear,
      end_year: options.endYear,
      min_magnitude: options.minMagnitude,
    },
  })
  return response.data.data
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
  const response = await client.get('/indemnity/historical/hurricanes', {
    params: {
      mode: options.mode,
      limit: options.limit,
      start_year: options.startYear,
      end_year: options.endYear,
      min_category: options.minCategory,
      basin: options.basin,
    },
  })
  return response.data.data
}

/**
 * Fetch summary of available historical data.
 */
export async function fetchHistoricalSummary(): Promise<HistoricalSummary> {
  const response = await client.get('/indemnity/historical/summary')
  return response.data.data
}
