/**
 * Core type definitions for the Catastrophe Mapping application.
 */

export type EventType = 'earthquake' | 'hurricane' | 'wildfire' | 'tornado' | 'flooding' | 'hail'

export interface Earthquake {
  usgs_id: string
  magnitude: number
  magnitude_type: string
  place: string
  event_time: string
  longitude: number
  latitude: number
  depth_km: number
  status: string
  tsunami: number
  significance: number
}

export interface Hurricane {
  storm_id: string
  name: string
  classification: string
  basin: string
  category: number | null
  latitude: number
  longitude: number
  max_wind_mph: number
  max_wind_knots: number
  min_pressure_mb: number | null
  movement_direction: string | null
  movement_speed_mph: number | null
  is_active: boolean
  advisory_time?: string
}

export interface Wildfire {
  source_id: string
  latitude: number
  longitude: number
  name?: string
  brightness?: number
  frp?: number  // Fire Radiative Power in MW
  confidence?: number
  acres_burned?: number
  containment_percent?: number
  satellite?: string
  detected_at: string
  is_active: boolean
}

export interface SevereWeather {
  source_id: string
  event_type: 'tornado' | 'hail' | 'flooding' | 'wind' | 'thunderstorm'
  latitude: number
  longitude: number
  location?: string
  state?: string
  description?: string
  severity?: string
  urgency?: string
  event_time: string
  expires_at?: string
  // Tornado specific
  tornado_scale?: number  // EF0-EF5
  // Hail specific
  hail_size_inches?: number
  // Flooding specific
  flood_severity?: string
  // Wind specific
  wind_speed_mph?: number
}

export interface Notification {
  id: string
  type: EventType
  title: string
  message: string
  timestamp: string
  read: boolean
}

export interface Filters {
  minMagnitude: number
  minCategory: number | null
  hoursAgo: number
  eventTypes: EventType[]
}

export interface GeoJSONFeature {
  type: 'Feature'
  id: string
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon'
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, unknown>
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
  metadata?: Record<string, any>
}

/** USGS earthquake GeoJSON feature */
export interface USGSEarthquakeFeature {
  type: 'Feature'
  id: string
  properties: {
    mag: number
    magType: string
    place: string
    time: number
    status: string
    tsunami: number
    sig: number
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number, number] // [longitude, latitude, depth_km]
  }
}

/** Wildfire GeoJSON feature from API */
export interface WildfireFeature {
  type: 'Feature'
  properties: {
    source_id: string
    brightness: number
    frp: number
    confidence: number
    satellite: string
    detected_at: string
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }
}

/** Severe weather GeoJSON feature from API */
export interface SevereWeatherFeature {
  type: 'Feature'
  properties: {
    source_id: string
    event_type: string
    location?: string
    description?: string
    severity?: string
    urgency?: string
    event_time: string
    expires_at?: string
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }
}

// Re-export parametric types
export * from './parametric'
