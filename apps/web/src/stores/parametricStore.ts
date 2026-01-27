import { create } from 'zustand'
import { BoundingBox, HistoricalHurricane, BoxStatistics, AnalysisFilters, DatasetInfo } from '../types/parametric'
import { parametricApi } from '../services/parametricApi'

interface ParametricStore {
  // Data
  boxes: BoundingBox[]
  hurricanes: HistoricalHurricane[]
  allHurricanes: HistoricalHurricane[]  // All fetched hurricanes before top-N filter
  statistics: Record<string, BoxStatistics>
  datasets: DatasetInfo[]
  
  // UI State
  selectedBoxId: string | null
  isLoading: boolean
  isLoadingStats: boolean
  error: string | null
  
  // Filters
  filters: AnalysisFilters
  
  // Actions
  addBox: (box: BoundingBox) => void
  addBoxes: (boxes: BoundingBox[]) => void
  updateBox: (id: string, updates: Partial<BoundingBox>) => void
  removeBox: (id: string) => void
  clearAllBoxes: () => void
  selectBox: (id: string | null) => void
  setFilters: (filters: Partial<AnalysisFilters>) => void
  
  // API Actions
  fetchDatasets: () => Promise<void>
  fetchHistoricalHurricanes: () => Promise<void>
  calculateStatistics: (boxId: string) => Promise<void>
  calculateAllStatistics: () => Promise<void>
}

const DEFAULT_FILTERS: AnalysisFilters = {
  startYear: 1980,
  endYear: new Date().getFullYear(),
  minCategory: 0,
  basin: null,
  dataset: 'ibtracs',
  topEventsLimit: null,  // null = show all, number = show top N by significance
}

export const useParametricStore = create<ParametricStore>((set, get) => ({
  // Initial state
  boxes: [],
  hurricanes: [],
  allHurricanes: [],
  statistics: {},
  datasets: [],
  selectedBoxId: null,
  isLoading: false,
  isLoadingStats: false,
  error: null,
  filters: DEFAULT_FILTERS,
  
  // Box management
  addBox: (box) => {
    set((state) => ({
      boxes: [...state.boxes, box],
    }))
  },

  addBoxes: (newBoxes) => {
    set((state) => ({
      boxes: [...state.boxes, ...newBoxes],
    }))
  },
  
  updateBox: (id, updates) => {
    set((state) => ({
      boxes: state.boxes.map((box) =>
        box.id === id ? { ...box, ...updates } : box
      ),
    }))
  },
  
  removeBox: (id) => {
    set((state) => ({
      boxes: state.boxes.filter((box) => box.id !== id),
      statistics: Object.fromEntries(
        Object.entries(state.statistics).filter(([key]) => key !== id)
      ),
      selectedBoxId: state.selectedBoxId === id ? null : state.selectedBoxId,
    }))
  },

  clearAllBoxes: () => {
    set({
      boxes: [],
      statistics: {},
      selectedBoxId: null,
    })
  },
  
  selectBox: (id) => {
    set({ selectedBoxId: id })
  },
  
  setFilters: (newFilters) => {
    set((state) => {
      const updatedFilters = { ...state.filters, ...newFilters }
      
      // If topEventsLimit changed, re-filter the displayed hurricanes
      if ('topEventsLimit' in newFilters) {
        const limit = updatedFilters.topEventsLimit
        let filteredHurricanes = state.allHurricanes
        
        if (limit !== null && limit > 0) {
          // Sort by significance (max_wind_knots as proxy) and take top N
          filteredHurricanes = [...state.allHurricanes]
            .sort((a, b) => b.max_wind_knots - a.max_wind_knots)
            .slice(0, limit)
        }
        
        return { filters: updatedFilters, hurricanes: filteredHurricanes }
      }
      
      return { filters: updatedFilters }
    })
  },
  
  // API Actions
  fetchDatasets: async () => {
    try {
      const datasets = await parametricApi.getAvailableDatasets()
      set({ datasets })
    } catch (error) {
      console.error('Failed to fetch datasets:', error)
    }
  },
  
  fetchHistoricalHurricanes: async () => {
    const { filters } = get()
    set({ isLoading: true, error: null })
    
    try {
      const allHurricanes = await parametricApi.getHistoricalHurricanes(filters)
      
      // Apply topEventsLimit filter if set
      let hurricanes = allHurricanes
      if (filters.topEventsLimit !== null && filters.topEventsLimit > 0) {
        hurricanes = [...allHurricanes]
          .sort((a, b) => b.max_wind_knots - a.max_wind_knots)
          .slice(0, filters.topEventsLimit)
      }
      
      set({ allHurricanes, hurricanes, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch hurricanes',
        isLoading: false,
      })
    }
  },
  
  calculateStatistics: async (boxId) => {
    const { boxes, filters } = get()
    const box = boxes.find((b) => b.id === boxId)
    if (!box) return
    
    set({ isLoadingStats: true, error: null })
    
    try {
      const stats = await parametricApi.calculateBoxStatistics(box, filters)
      set((state) => ({
        statistics: { ...state.statistics, [boxId]: stats },
        isLoadingStats: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to calculate statistics',
        isLoadingStats: false,
      })
    }
  },
  
  calculateAllStatistics: async () => {
    const { boxes, filters } = get()
    if (boxes.length === 0) return
    
    set({ isLoadingStats: true, error: null })
    
    try {
      const allStats = await parametricApi.calculateAllBoxStatistics(boxes, filters)
      set({ statistics: allStats, isLoadingStats: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to calculate statistics',
        isLoadingStats: false,
      })
    }
  },
}))
