import { create } from 'zustand'
import type { 
  PayoutStructure,
} from '../types/parametric'
import type { Earthquake, Hurricane, Wildfire, SevereWeather } from '../types'

// Unified trigger zone that can work with any event type
export interface TriggerZone {
  id: string
  name: string
  north: number
  south: number
  east: number
  west: number
  color?: string
  // Combined trigger criteria
  trigger?: {
    // Earthquake triggers
    min_magnitude?: number
    max_depth_km?: number
    // Hurricane triggers
    min_category?: number
    min_wind_knots?: number
    // Generic
    event_type?: string[]  // Filter by event types
  }
  payout?: PayoutStructure
}

export type SelectedEventType = Earthquake | Hurricane | Wildfire | SevereWeather | null

export interface TriggerZoneCalculation {
  zoneId: string
  zoneName: string
  triggered: boolean
  eventInZone: boolean
  matchesCriteria: boolean
  payoutAmount: number | null
  payoutTier: string | null
  eventDetails: {
    type: string
    intensity: number | string
    location: string
  }
}

interface TriggerZoneStore {
  // Trigger zones for real-time analysis
  zones: TriggerZone[]
  selectedZoneId: string | null
  
  // Selected event for analysis
  selectedEvent: SelectedEventType
  
  // Calculation results
  calculations: TriggerZoneCalculation[]
  
  // Actions
  addZone: (zone: TriggerZone) => void
  addZones: (zones: TriggerZone[]) => void
  updateZone: (id: string, updates: Partial<TriggerZone>) => void
  removeZone: (id: string) => void
  clearAllZones: () => void
  selectZone: (id: string | null) => void
  
  // Event selection
  setSelectedEvent: (event: SelectedEventType) => void
  
  // Calculation
  calculateTriggers: () => void
}

// Check if a point is within a bounding box
function isPointInZone(lat: number, lng: number, zone: TriggerZone): boolean {
  return (
    lat >= zone.south &&
    lat <= zone.north &&
    lng >= zone.west &&
    lng <= zone.east
  )
}

// Get intensity value for an event
function getEventIntensity(event: SelectedEventType): { type: string; intensity: number; label: string } {
  if (!event) return { type: 'unknown', intensity: 0, label: 'N/A' }
  
  if ('magnitude' in event) {
    return { type: 'earthquake', intensity: event.magnitude, label: `M${event.magnitude.toFixed(1)}` }
  }
  if ('category' in event && event.category !== null && event.category !== undefined) {
    return { type: 'hurricane', intensity: event.category, label: `Cat ${event.category}` }
  }
  if ('max_wind_mph' in event) {
    return { type: 'hurricane', intensity: 0, label: `${event.max_wind_mph} mph` }
  }
  if ('brightness' in event) {
    return { type: 'wildfire', intensity: event.brightness || 0, label: `${event.brightness?.toFixed(0)}K` }
  }
  if ('event_type' in event) {
    return { type: event.event_type, intensity: 0, label: event.severity || 'Active' }
  }
  
  return { type: 'unknown', intensity: 0, label: 'N/A' }
}

// Check if event meets trigger criteria
function meetsTriggerCriteria(event: SelectedEventType, trigger?: TriggerZone['trigger']): boolean {
  if (!event || !trigger) return true  // No criteria = always triggered
  
  if ('magnitude' in event) {
    if (trigger.min_magnitude !== undefined && event.magnitude < trigger.min_magnitude) {
      return false
    }
    if (trigger.max_depth_km !== undefined && event.depth_km > trigger.max_depth_km) {
      return false
    }
  }
  
  if ('category' in event && event.category !== null && event.category !== undefined) {
    if (trigger.min_category !== undefined && event.category < trigger.min_category) {
      return false
    }
  }
  
  if ('max_wind_mph' in event && trigger.min_wind_knots !== undefined) {
    const windKnots = event.max_wind_mph * 0.868976  // Convert mph to knots
    if (windKnots < trigger.min_wind_knots) {
      return false
    }
  }
  
  return true
}

// Calculate payout based on intensity and payout type
function calculatePayout(
  event: SelectedEventType,
  payout?: PayoutStructure
): { amount: number | null; tier: string | null; allTierPayouts?: Array<{ tier: string; amount: number }> } {
  if (!event || !payout) {
    return { amount: null, tier: null }
  }
  
  // Binary payout - just return base payout if event qualifies
  if (payout.payoutType === 'binary' || payout.tiers.length === 0) {
    return { amount: payout.basePayout, tier: 'Binary' }
  }
  
  const { intensity } = getEventIntensity(event)
  
  // Find ALL matching tiers for the event intensity
  const matchingTiers = payout.tiers
    .filter(tier => {
      if (intensity < tier.minIntensity) return false
      if (tier.maxIntensity !== undefined && intensity > tier.maxIntensity) return false
      return true
    })
    .sort((a, b) => b.minIntensity - a.minIntensity)
  
  if (matchingTiers.length === 0) {
    return { amount: null, tier: null }
  }
  
  // Calculate payouts for all matching tiers
  const allTierPayouts = matchingTiers.map(tier => {
    let tierAmount: number
    if (tier.fixedPayout !== undefined) {
      tierAmount = tier.fixedPayout
    } else if (payout.payoutType === 'percentage' && tier.payoutPercent !== undefined) {
      tierAmount = payout.basePayout * (tier.payoutPercent / 100)
    } else {
      tierAmount = payout.basePayout * tier.payoutMultiplier
    }
    return { tier: tier.name, amount: tierAmount }
  })
  
  // Return the highest matching tier as primary
  const primaryTier = matchingTiers[0]
  let amount: number
  if (primaryTier.fixedPayout !== undefined) {
    amount = primaryTier.fixedPayout
  } else if (payout.payoutType === 'percentage' && primaryTier.payoutPercent !== undefined) {
    amount = payout.basePayout * (primaryTier.payoutPercent / 100)
  } else {
    amount = payout.basePayout * primaryTier.payoutMultiplier
  }
  
  return { amount, tier: primaryTier.name, allTierPayouts }
}

export const useTriggerZoneStore = create<TriggerZoneStore>((set, get) => ({
  zones: [],
  selectedZoneId: null,
  selectedEvent: null,
  calculations: [],
  
  addZone: (zone) => {
    set((state) => ({
      zones: [...state.zones, zone],
    }))
    get().calculateTriggers()
  },
  
  addZones: (newZones) => {
    set((state) => ({
      zones: [...state.zones, ...newZones],
    }))
    get().calculateTriggers()
  },
  
  updateZone: (id, updates) => {
    set((state) => ({
      zones: state.zones.map((zone) =>
        zone.id === id ? { ...zone, ...updates } : zone
      ),
    }))
    get().calculateTriggers()
  },
  
  removeZone: (id) => {
    set((state) => ({
      zones: state.zones.filter((zone) => zone.id !== id),
      selectedZoneId: state.selectedZoneId === id ? null : state.selectedZoneId,
    }))
    get().calculateTriggers()
  },
  
  clearAllZones: () => {
    set({
      zones: [],
      selectedZoneId: null,
      calculations: [],
    })
  },
  
  selectZone: (id) => {
    set({ selectedZoneId: id })
  },
  
  setSelectedEvent: (event) => {
    set({ selectedEvent: event })
    get().calculateTriggers()
  },
  
  calculateTriggers: () => {
    const { zones, selectedEvent } = get()
    
    if (!selectedEvent) {
      set({ calculations: [] })
      return
    }
    
    const calculations: TriggerZoneCalculation[] = zones.map((zone) => {
      const eventInZone = isPointInZone(
        selectedEvent.latitude,
        selectedEvent.longitude,
        zone
      )
      
      const matchesCriteria = meetsTriggerCriteria(selectedEvent, zone.trigger)
      const triggered = eventInZone && matchesCriteria
      
      const { amount, tier } = triggered
        ? calculatePayout(selectedEvent, zone.payout)
        : { amount: null, tier: null }
      
      const { type, label } = getEventIntensity(selectedEvent)
      
      // Determine location with fallback
      let location: string = 'Unknown'
      if ('place' in selectedEvent && selectedEvent.place) {
        location = selectedEvent.place
      } else if ('name' in selectedEvent && selectedEvent.name) {
        location = selectedEvent.name
      }
      
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        triggered,
        eventInZone,
        matchesCriteria,
        payoutAmount: amount,
        payoutTier: tier,
        eventDetails: {
          type,
          intensity: label,
          location,
        },
      }
    })
    
    set({ calculations })
  },
}))
