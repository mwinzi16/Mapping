import { create } from 'zustand'
import {
  TIVRecord,
  TIVDataset,
  TIVGranularity,
  AggregatedTIV,
  TIVStatistics,
  TIVImpactAnalysis,
  EventPath,
  IndemnityFilters,
} from '../types/indemnity'

interface IndemnityState {
  // Data
  datasets: TIVDataset[]
  activeDatasetId: string | null
  aggregatedData: AggregatedTIV[]
  
  // Display settings
  granularity: TIVGranularity
  filters: IndemnityFilters
  
  // Statistics
  statistics: TIVStatistics | null
  isCalculatingStats: boolean
  
  // Event path analysis
  selectedEventPaths: EventPath[]
  impactAnalyses: TIVImpactAnalysis[]
  isAnalyzingImpact: boolean
  
  // UI state
  isLoading: boolean
  error: string | null
  selectedRecordId: string | null
  
  // Actions
  addDataset: (dataset: TIVDataset) => void
  removeDataset: (id: string) => void
  setActiveDataset: (id: string | null) => void
  setGranularity: (granularity: TIVGranularity) => void
  setFilters: (filters: Partial<IndemnityFilters>) => void
  clearFilters: () => void
  selectRecord: (id: string | null) => void
  
  // Aggregation
  aggregateData: () => void
  
  // Statistics
  calculateStatistics: () => void
  
  // Event path analysis
  addEventPath: (path: EventPath) => void
  removeEventPath: (eventId: string) => void
  clearEventPaths: () => void
  analyzeImpact: () => void
  
  // Import
  importTIVData: (records: TIVRecord[], name: string, currency?: string) => void
  clearAllData: () => void
}

// Helper function to aggregate TIV data based on granularity
function aggregateByGranularity(
  records: TIVRecord[],
  granularity: TIVGranularity,
  filters: IndemnityFilters
): AggregatedTIV[] {
  // Apply filters first
  let filtered = records
  
  if (filters.minTIV !== undefined) {
    filtered = filtered.filter(r => r.tiv >= filters.minTIV!)
  }
  if (filters.maxTIV !== undefined) {
    filtered = filtered.filter(r => r.tiv <= filters.maxTIV!)
  }
  if (filters.categories?.length) {
    filtered = filtered.filter(r => r.category && filters.categories!.includes(r.category))
  }
  if (filters.states?.length) {
    filtered = filtered.filter(r => r.state && filters.states!.includes(r.state))
  }
  if (filters.countries?.length) {
    filtered = filtered.filter(r => r.country && filters.countries!.includes(r.country))
  }
  
  const groups: Record<string, { records: TIVRecord[]; key: string }> = {}
  
  filtered.forEach(record => {
    let key: string
    
    switch (granularity) {
      case 'location':
        key = record.id
        break
      case 'postal':
        key = record.postalCode || `loc_${record.id}`
        break
      case 'city':
        key = record.city || `loc_${record.id}`
        break
      case 'county':
        key = record.county || `loc_${record.id}`
        break
      case 'state':
        key = record.state || `loc_${record.id}`
        break
      case 'country':
        key = record.country || `loc_${record.id}`
        break
      case 'grid':
        // 0.5 degree grid cells
        const latBucket = Math.floor(record.latitude * 2) / 2
        const lonBucket = Math.floor(record.longitude * 2) / 2
        key = `${latBucket},${lonBucket}`
        break
      default:
        key = record.id
    }
    
    if (!groups[key]) {
      groups[key] = { records: [], key }
    }
    groups[key].records.push(record)
  })
  
  return Object.entries(groups).map(([key, { records }]) => {
    const totalTIV = records.reduce((sum, r) => sum + r.tiv, 0)
    const avgLat = records.reduce((sum, r) => sum + r.latitude, 0) / records.length
    const avgLon = records.reduce((sum, r) => sum + r.longitude, 0) / records.length
    
    const lats = records.map(r => r.latitude)
    const lons = records.map(r => r.longitude)
    
    return {
      id: key,
      name: key,
      latitude: avgLat,
      longitude: avgLon,
      totalTIV,
      recordCount: records.length,
      bounds: records.length > 1 ? {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lons),
        west: Math.min(...lons),
      } : undefined,
    }
  })
}

// Helper function to calculate statistics
function calculateTIVStatistics(records: TIVRecord[], currency: string): TIVStatistics {
  if (records.length === 0) {
    return {
      totalRecords: 0,
      totalTIV: 0,
      averageTIV: 0,
      medianTIV: 0,
      minTIV: 0,
      maxTIV: 0,
      currency,
      byCategory: {},
      concentrationRisk: { top10Locations: [] },
    }
  }
  
  const tivValues = records.map(r => r.tiv).sort((a, b) => a - b)
  const totalTIV = tivValues.reduce((sum, v) => sum + v, 0)
  
  // By category
  const byCategory: Record<string, { count: number; tiv: number; percentage: number }> = {}
  records.forEach(r => {
    const cat = r.category || 'Unknown'
    if (!byCategory[cat]) {
      byCategory[cat] = { count: 0, tiv: 0, percentage: 0 }
    }
    byCategory[cat].count++
    byCategory[cat].tiv += r.tiv
  })
  Object.keys(byCategory).forEach(key => {
    byCategory[key].percentage = (byCategory[key].tiv / totalTIV) * 100
  })
  
  // By state
  const byState: Record<string, { count: number; tiv: number; percentage: number }> = {}
  records.forEach(r => {
    if (r.state) {
      if (!byState[r.state]) {
        byState[r.state] = { count: 0, tiv: 0, percentage: 0 }
      }
      byState[r.state].count++
      byState[r.state].tiv += r.tiv
    }
  })
  Object.keys(byState).forEach(key => {
    byState[key].percentage = (byState[key].tiv / totalTIV) * 100
  })
  
  // Top 10 locations by TIV
  const sortedByTIV = [...records].sort((a, b) => b.tiv - a.tiv)
  const top10Locations = sortedByTIV.slice(0, 10).map(r => ({
    name: r.address || r.city || `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`,
    tiv: r.tiv,
    percentage: (r.tiv / totalTIV) * 100,
  }))
  
  return {
    totalRecords: records.length,
    totalTIV,
    averageTIV: totalTIV / records.length,
    medianTIV: tivValues[Math.floor(tivValues.length / 2)],
    minTIV: tivValues[0],
    maxTIV: tivValues[tivValues.length - 1],
    currency,
    byCategory,
    byState: Object.keys(byState).length > 0 ? byState : undefined,
    concentrationRisk: { top10Locations },
  }
}

// Helper to check if a point is within a path buffer
function isPointInPathBuffer(
  lat: number,
  lon: number,
  path: EventPath
): boolean {
  const bufferDegrees = path.bufferRadiusKm / 111 // Rough conversion
  
  for (const point of path.pathPoints) {
    const distance = Math.sqrt(
      Math.pow(lat - point.latitude, 2) + Math.pow(lon - point.longitude, 2)
    )
    if (distance <= bufferDegrees) {
      return true
    }
  }
  return false
}

export const useIndemnityStore = create<IndemnityState>((set, get) => ({
  // Initial state
  datasets: [],
  activeDatasetId: null,
  aggregatedData: [],
  granularity: 'location',
  filters: {},
  statistics: null,
  isCalculatingStats: false,
  selectedEventPaths: [],
  impactAnalyses: [],
  isAnalyzingImpact: false,
  isLoading: false,
  error: null,
  selectedRecordId: null,
  
  // Actions
  addDataset: (dataset) => {
    set(state => ({
      datasets: [...state.datasets, dataset],
      activeDatasetId: dataset.id,
    }))
    get().aggregateData()
    get().calculateStatistics()
  },
  
  removeDataset: (id) => {
    set(state => ({
      datasets: state.datasets.filter(d => d.id !== id),
      activeDatasetId: state.activeDatasetId === id ? null : state.activeDatasetId,
    }))
    get().aggregateData()
    get().calculateStatistics()
  },
  
  setActiveDataset: (id) => {
    set({ activeDatasetId: id })
    get().aggregateData()
    get().calculateStatistics()
  },
  
  setGranularity: (granularity) => {
    set({ granularity })
    get().aggregateData()
  },
  
  setFilters: (filters) => {
    set(state => ({ filters: { ...state.filters, ...filters } }))
    get().aggregateData()
    get().calculateStatistics()
  },
  
  clearFilters: () => {
    set({ filters: {} })
    get().aggregateData()
    get().calculateStatistics()
  },
  
  selectRecord: (id) => set({ selectedRecordId: id }),
  
  aggregateData: () => {
    const { datasets, activeDatasetId, granularity, filters } = get()
    const activeDataset = datasets.find(d => d.id === activeDatasetId)
    
    if (!activeDataset) {
      set({ aggregatedData: [] })
      return
    }
    
    const aggregated = aggregateByGranularity(activeDataset.records, granularity, filters)
    set({ aggregatedData: aggregated })
  },
  
  calculateStatistics: () => {
    const { datasets, activeDatasetId, filters } = get()
    const activeDataset = datasets.find(d => d.id === activeDatasetId)
    
    if (!activeDataset) {
      set({ statistics: null })
      return
    }
    
    set({ isCalculatingStats: true })
    
    // Apply filters
    let filtered = activeDataset.records
    if (filters.minTIV !== undefined) {
      filtered = filtered.filter(r => r.tiv >= filters.minTIV!)
    }
    if (filters.maxTIV !== undefined) {
      filtered = filtered.filter(r => r.tiv <= filters.maxTIV!)
    }
    if (filters.categories?.length) {
      filtered = filtered.filter(r => r.category && filters.categories!.includes(r.category))
    }
    
    const stats = calculateTIVStatistics(filtered, activeDataset.currency)
    
    set({ statistics: stats, isCalculatingStats: false })
  },
  
  addEventPath: (path) => {
    set(state => ({
      selectedEventPaths: [...state.selectedEventPaths, path],
    }))
  },
  
  removeEventPath: (eventId) => {
    set(state => ({
      selectedEventPaths: state.selectedEventPaths.filter(p => p.eventId !== eventId),
      impactAnalyses: state.impactAnalyses.filter(a => a.eventPath.eventId !== eventId),
    }))
  },
  
  clearEventPaths: () => {
    set({ selectedEventPaths: [], impactAnalyses: [] })
  },
  
  analyzeImpact: () => {
    const { datasets, activeDatasetId, selectedEventPaths } = get()
    const activeDataset = datasets.find(d => d.id === activeDatasetId)
    
    if (!activeDataset || selectedEventPaths.length === 0) {
      return
    }
    
    set({ isAnalyzingImpact: true })
    
    const analyses: TIVImpactAnalysis[] = selectedEventPaths.map(path => {
      const affectedRecords = activeDataset.records.filter(record =>
        isPointInPathBuffer(record.latitude, record.longitude, path)
      )
      
      const totalAffectedTIV = affectedRecords.reduce((sum, r) => sum + r.tiv, 0)
      
      // Group by category
      const byCategory: Record<string, { count: number; tiv: number }> = {}
      affectedRecords.forEach(r => {
        const cat = r.category || 'Unknown'
        if (!byCategory[cat]) {
          byCategory[cat] = { count: 0, tiv: 0 }
        }
        byCategory[cat].count++
        byCategory[cat].tiv += r.tiv
      })
      
      return {
        eventPath: path,
        affectedRecords,
        totalAffectedTIV,
        affectedCount: affectedRecords.length,
        percentageOfPortfolio: (totalAffectedTIV / activeDataset.totalTIV) * 100,
        byCategory,
      }
    })
    
    set({ impactAnalyses: analyses, isAnalyzingImpact: false })
  },
  
  importTIVData: (records, name, currency = 'USD') => {
    const totalTIV = records.reduce((sum, r) => sum + r.tiv, 0)
    
    const dataset: TIVDataset = {
      id: `dataset-${Date.now()}`,
      name,
      records,
      totalTIV,
      currency,
      granularity: 'location',
      uploadedAt: new Date(),
    }
    
    get().addDataset(dataset)
  },
  
  clearAllData: () => {
    set({
      datasets: [],
      activeDatasetId: null,
      aggregatedData: [],
      statistics: null,
      selectedEventPaths: [],
      impactAnalyses: [],
    })
  },
}))
