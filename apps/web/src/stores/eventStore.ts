import { create } from 'zustand'
import { api } from '../services/api'
import type { Earthquake, Hurricane, Wildfire, SevereWeather, Notification, Filters } from '../types'

interface EventStore {
  // State
  earthquakes: Earthquake[]
  hurricanes: Hurricane[]
  wildfires: Wildfire[]
  severeWeather: SevereWeather[]
  notifications: Notification[]
  selectedEvent: Earthquake | Hurricane | Wildfire | SevereWeather | null
  filters: Filters
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchRecentEarthquakes: () => Promise<void>
  fetchActiveHurricanes: () => Promise<void>
  fetchActiveWildfires: () => Promise<void>
  fetchSevereWeather: () => Promise<void>
  fetchAllEvents: () => Promise<void>
  setSelectedEvent: (event: Earthquake | Hurricane | Wildfire | SevereWeather | null) => void
  setFilters: (filters: Partial<Filters>) => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  dismissNotification: (id: string) => void
  addEarthquake: (earthquake: Earthquake) => void
  updateHurricane: (hurricane: Hurricane) => void
}

export const useEventStore = create<EventStore>((set, get) => ({
  // Initial state
  earthquakes: [],
  hurricanes: [],
  wildfires: [],
  severeWeather: [],
  notifications: [],
  selectedEvent: null,
  filters: {
    minMagnitude: 2.5,
    minCategory: null,
    hoursAgo: 24,
    eventTypes: ['earthquake', 'hurricane', 'wildfire', 'tornado', 'flooding', 'hail'],
  },
  isLoading: false,
  error: null,
  
  // Actions
  fetchRecentEarthquakes: async () => {
    set({ isLoading: true, error: null })
    try {
      const { filters } = get()
      const data = await api.getRecentEarthquakes(filters.hoursAgo, filters.minMagnitude)
      
      // Parse GeoJSON features into our format
      const earthquakes: Earthquake[] = data.features.map((f: any) => ({
        usgs_id: f.id,
        magnitude: f.properties.mag,
        magnitude_type: f.properties.magType,
        place: f.properties.place,
        event_time: new Date(f.properties.time).toISOString(),
        longitude: f.geometry.coordinates[0],
        latitude: f.geometry.coordinates[1],
        depth_km: f.geometry.coordinates[2],
        status: f.properties.status,
        tsunami: f.properties.tsunami,
        significance: f.properties.sig,
      }))
      
      set({ earthquakes, isLoading: false })
    } catch (error) {
      set({ error: 'Failed to fetch earthquakes', isLoading: false })
    }
  },
  
  fetchActiveHurricanes: async () => {
    try {
      const data = await api.getActiveHurricanes()
      set({ hurricanes: data.storms || [] })
    } catch (error) {
      // Hurricanes might not be active, don't show error
      set({ hurricanes: [] })
    }
  },
  
  fetchActiveWildfires: async () => {
    try {
      const data = await api.getActiveWildfires()
      
      const wildfires: Wildfire[] = (data.features || []).map((f: any) => ({
        source_id: f.properties.source_id,
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        brightness: f.properties.brightness,
        frp: f.properties.frp,
        confidence: f.properties.confidence,
        satellite: f.properties.satellite,
        detected_at: f.properties.detected_at,
        is_active: true,
      }))
      
      set({ wildfires })
    } catch (error) {
      set({ wildfires: [] })
    }
  },
  
  fetchSevereWeather: async () => {
    try {
      const data = await api.getSevereWeatherAlerts()
      
      const severeWeather: SevereWeather[] = (data.features || []).map((f: any) => ({
        source_id: f.properties.source_id,
        event_type: f.properties.event_type,
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        location: f.properties.location,
        description: f.properties.description,
        severity: f.properties.severity,
        urgency: f.properties.urgency,
        event_time: f.properties.event_time,
        expires_at: f.properties.expires_at,
      }))
      
      set({ severeWeather })
    } catch (error) {
      set({ severeWeather: [] })
    }
  },
  
  fetchAllEvents: async () => {
    set({ isLoading: true })
    await Promise.all([
      get().fetchRecentEarthquakes(),
      get().fetchActiveHurricanes(),
      get().fetchActiveWildfires(),
      get().fetchSevereWeather(),
    ])
    set({ isLoading: false })
  },
  
  setSelectedEvent: (event) => {
    set({ selectedEvent: event })
  },
  
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }))
  },
  
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      read: false,
    }
    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50),
    }))
  },
  
  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ),
    }))
  },
  
  addEarthquake: (earthquake) => {
    set((state) => {
      // Check if already exists
      if (state.earthquakes.some(e => e.usgs_id === earthquake.usgs_id)) {
        return state
      }
      
      // Add notification for significant earthquakes
      if (earthquake.magnitude >= 5.0) {
        get().addNotification({
          type: 'earthquake',
          title: `M${earthquake.magnitude.toFixed(1)} Earthquake`,
          message: earthquake.place,
        })
      }
      
      return {
        earthquakes: [earthquake, ...state.earthquakes].slice(0, 500),
      }
    })
  },
  
  updateHurricane: (hurricane) => {
    set((state) => {
      const existing = state.hurricanes.find(h => h.storm_id === hurricane.storm_id)
      
      // Add notification for new storms or category upgrades
      if (!existing) {
        get().addNotification({
          type: 'hurricane',
          title: `New Storm: ${hurricane.name}`,
          message: `${hurricane.classification} with ${hurricane.max_wind_mph} mph winds`,
        })
      } else if (hurricane.category && (!existing.category || hurricane.category > existing.category)) {
        get().addNotification({
          type: 'hurricane',
          title: `${hurricane.name} Upgraded`,
          message: `Now Category ${hurricane.category} with ${hurricane.max_wind_mph} mph winds`,
        })
      }
      
      return {
        hurricanes: existing
          ? state.hurricanes.map(h => h.storm_id === hurricane.storm_id ? hurricane : h)
          : [...state.hurricanes, hurricane],
      }
    })
  },
}))
