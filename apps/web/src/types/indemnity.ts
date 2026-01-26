// TIV (Total Insured Value) data types

export interface TIVRecord {
  id: string
  latitude: number
  longitude: number
  tiv: number  // Total Insured Value
  currency: string
  category?: string  // e.g., "residential", "commercial", "industrial"
  subcategory?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  constructionType?: string
  yearBuilt?: number
  numberOfStories?: number
  occupancyType?: string
}

export interface TIVDataset {
  id: string
  name: string
  records: TIVRecord[]
  totalTIV: number
  currency: string
  granularity: TIVGranularity
  uploadedAt: Date
}

export type TIVGranularity = 'location' | 'postal' | 'city' | 'state' | 'country' | 'grid'

export interface AggregatedTIV {
  id: string
  name: string  // Could be postal code, city name, etc.
  latitude: number
  longitude: number
  totalTIV: number
  recordCount: number
  bounds?: {
    north: number
    south: number
    east: number
    west: number
  }
}

export interface EventPath {
  eventId: string
  eventName: string
  eventType: 'hurricane' | 'earthquake' | 'wildfire' | 'tornado'
  pathPoints: Array<{
    latitude: number
    longitude: number
    timestamp?: string
    intensity?: number  // wind speed, magnitude, etc.
  }>
  bufferRadiusKm: number  // Radius around path to consider for TIV impact
}

export interface TIVImpactAnalysis {
  eventPath: EventPath
  affectedRecords: TIVRecord[]
  totalAffectedTIV: number
  affectedCount: number
  percentageOfPortfolio: number
  byCategory: Record<string, { count: number; tiv: number }>
}

export interface TIVStatistics {
  totalRecords: number
  totalTIV: number
  averageTIV: number
  medianTIV: number
  minTIV: number
  maxTIV: number
  currency: string
  byCategory: Record<string, { count: number; tiv: number; percentage: number }>
  byState?: Record<string, { count: number; tiv: number; percentage: number }>
  byCountry?: Record<string, { count: number; tiv: number; percentage: number }>
  concentrationRisk: {
    top10Locations: Array<{ name: string; tiv: number; percentage: number }>
    top10PostalCodes?: Array<{ code: string; tiv: number; percentage: number }>
  }
}

export interface IndemnityFilters {
  minTIV?: number
  maxTIV?: number
  categories?: string[]
  states?: string[]
  countries?: string[]
  constructionTypes?: string[]
}
