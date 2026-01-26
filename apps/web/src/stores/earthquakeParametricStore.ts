import { create } from 'zustand'
import {
  EarthquakeBoundingBox,
  HistoricalEarthquake,
  EarthquakeBoxStatistics,
  EarthquakeAnalysisFilters,
  EarthquakeDatasetInfo,
  StressTestConfig,
  StressTestResult,
  OverallStatistics,
  PayoutAggregationOptions,
  StressTestComparison,
} from '../types/parametric'
import { earthquakeParametricApi } from '../services/earthquakeParametricApi'

interface EarthquakeParametricStore {
  // Data
  boxes: EarthquakeBoundingBox[]
  earthquakes: HistoricalEarthquake[]
  statistics: Record<string, EarthquakeBoxStatistics>
  datasets: EarthquakeDatasetInfo[]

  // Overall Statistics
  overallStatistics: OverallStatistics | null
  payoutAggregationOptions: PayoutAggregationOptions
  stressTestComparison: StressTestComparison | null

  // UI State
  selectedBoxId: string | null
  isLoading: boolean
  isLoadingStats: boolean
  error: string | null

  // Filters
  filters: EarthquakeAnalysisFilters

  // Stress Testing
  stressTestConfig: StressTestConfig
  stressTestResults: Record<string, StressTestResult[]>
  isRunningStressTest: boolean

  // Actions
  addBox: (box: EarthquakeBoundingBox) => void
  addBoxes: (boxes: EarthquakeBoundingBox[]) => void
  updateBox: (id: string, updates: Partial<EarthquakeBoundingBox>) => void
  removeBox: (id: string) => void
  clearAllBoxes: () => void
  selectBox: (id: string | null) => void
  setFilters: (filters: Partial<EarthquakeAnalysisFilters>) => void
  setStressTestConfig: (config: Partial<StressTestConfig>) => void
  setPayoutAggregationOptions: (options: Partial<PayoutAggregationOptions>) => void
  getExtendedBoxes: () => EarthquakeBoundingBox[]
  runStressTest: (boxId: string) => Promise<void>
  runOverallStressTest: () => Promise<void>

  // API Actions
  fetchDatasets: () => Promise<void>
  fetchHistoricalEarthquakes: () => Promise<void>
  calculateStatistics: (boxId: string) => Promise<void>
  calculateAllStatistics: () => Promise<void>
  calculateOverallStatistics: () => void
}

const DEFAULT_FILTERS: EarthquakeAnalysisFilters = {
  startYear: 1980,
  endYear: new Date().getFullYear(),
  minMagnitude: 4.5,
  dataset: 'usgs_worldwide',
}

const DEFAULT_STRESS_TEST_CONFIG: StressTestConfig = {
  boundaryExtensionKm: 50,
  boundaryExtensionPercent: 10,
  usePerecentageExtension: false,
  extendClusterOnly: true,
  enabled: false,
}

// Helper to detect box clusters (boxes that overlap or are within a threshold distance)
function detectClusters(boxes: EarthquakeBoundingBox[], thresholdKm: number = 100): EarthquakeBoundingBox[][] {
  if (boxes.length === 0) return []
  
  // Convert km to approximate degrees (1 degree ≈ 111km at equator)
  const thresholdDeg = thresholdKm / 111
  
  const visited = new Set<string>()
  const clusters: EarthquakeBoundingBox[][] = []
  
  function boxesOverlapOrClose(a: EarthquakeBoundingBox, b: EarthquakeBoundingBox): boolean {
    // Check if boxes overlap or are within threshold
    const aExpanded = {
      north: a.north + thresholdDeg,
      south: a.south - thresholdDeg,
      east: a.east + thresholdDeg,
      west: a.west - thresholdDeg,
    }
    return !(b.west > aExpanded.east || 
             b.east < aExpanded.west || 
             b.south > aExpanded.north || 
             b.north < aExpanded.south)
  }
  
  function dfs(box: EarthquakeBoundingBox, cluster: EarthquakeBoundingBox[]) {
    visited.add(box.id)
    cluster.push(box)
    for (const other of boxes) {
      if (!visited.has(other.id) && boxesOverlapOrClose(box, other)) {
        dfs(other, cluster)
      }
    }
  }
  
  for (const box of boxes) {
    if (!visited.has(box.id)) {
      const cluster: EarthquakeBoundingBox[] = []
      dfs(box, cluster)
      clusters.push(cluster)
    }
  }
  
  return clusters
}

// Extend box boundaries
function extendBox(box: EarthquakeBoundingBox, extensionKm: number): EarthquakeBoundingBox {
  // Convert km to degrees (approximate)
  const latExtension = extensionKm / 111
  const avgLat = (box.north + box.south) / 2
  const lngExtension = extensionKm / (111 * Math.cos(avgLat * Math.PI / 180))
  
  return {
    ...box,
    north: Math.min(90, box.north + latExtension),
    south: Math.max(-90, box.south - latExtension),
    east: box.east + lngExtension,
    west: box.west - lngExtension,
    // Mark as extended and store original bounds for visualization
    _isExtended: true,
    _originalBounds: {
      north: box.north,
      south: box.south,
      east: box.east,
      west: box.west,
    },
  } as EarthquakeBoundingBox & { 
    _isExtended?: boolean
    _originalBounds?: { north: number; south: number; east: number; west: number }
  }
}

// Get cluster bounding box
function getClusterBounds(cluster: EarthquakeBoundingBox[]): { north: number; south: number; east: number; west: number } {
  return {
    north: Math.max(...cluster.map(b => b.north)),
    south: Math.min(...cluster.map(b => b.south)),
    east: Math.max(...cluster.map(b => b.east)),
    west: Math.min(...cluster.map(b => b.west)),
  }
}

export const useEarthquakeParametricStore = create<EarthquakeParametricStore>(
  (set, get) => ({
    // Initial state
    boxes: [],
    earthquakes: [],
    statistics: {},
    datasets: [],
    overallStatistics: null,
    payoutAggregationOptions: { mode: 'worst_only' },
    stressTestComparison: null,
    selectedBoxId: null,
    isLoading: false,
    isLoadingStats: false,
    error: null,
    filters: DEFAULT_FILTERS,
    stressTestConfig: DEFAULT_STRESS_TEST_CONFIG,
    stressTestResults: {},
    isRunningStressTest: false,


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
        stressTestResults: {},
      })
    },

    selectBox: (id) => {
      set({ selectedBoxId: id })
    },

    setFilters: (newFilters) => {
      set((state) => ({
        filters: { ...state.filters, ...newFilters },
      }))
    },

    setStressTestConfig: (config) => {
      set((state) => ({
        stressTestConfig: { ...state.stressTestConfig, ...config },
      }))
    },

    setPayoutAggregationOptions: (options) => {
      set((state) => ({
        payoutAggregationOptions: { ...state.payoutAggregationOptions, ...options },
      }))
      // Recalculate overall statistics with new options
      get().calculateOverallStatistics()
    },

    getExtendedBoxes: () => {
      const { boxes, stressTestConfig } = get()
      if (!stressTestConfig.enabled) return boxes

      let extensionKm = stressTestConfig.boundaryExtensionKm
      if (stressTestConfig.usePerecentageExtension) {
        // Calculate average box size and apply percentage
        const avgHeight = boxes.reduce((sum, b) => sum + (b.north - b.south), 0) / boxes.length
        const avgWidth = boxes.reduce((sum, b) => sum + (b.east - b.west), 0) / boxes.length
        const avgSizeKm = ((avgHeight + avgWidth) / 2) * 111 // Convert to km
        extensionKm = (avgSizeKm * stressTestConfig.boundaryExtensionPercent) / 100
      }

      if (stressTestConfig.extendClusterOnly) {
        // Detect clusters and extend only cluster boundaries
        const clusters = detectClusters(boxes)
        const extendedBoxes: EarthquakeBoundingBox[] = []

        for (const cluster of clusters) {
          if (cluster.length === 1) {
            // Single box - extend it directly
            extendedBoxes.push(extendBox(cluster[0], extensionKm))
          } else {
            // Multiple boxes in cluster - extend the cluster boundary
            const clusterBounds = getClusterBounds(cluster)
            const latExtension = extensionKm / 111
            const avgLat = (clusterBounds.north + clusterBounds.south) / 2
            const lngExtension = extensionKm / (111 * Math.cos(avgLat * Math.PI / 180))

            // Create extended cluster bounds
            const extendedCluster = {
              north: Math.min(90, clusterBounds.north + latExtension),
              south: Math.max(-90, clusterBounds.south - latExtension),
              east: clusterBounds.east + lngExtension,
              west: clusterBounds.west - lngExtension,
            }

            // Add individual boxes but mark them as part of cluster
            for (const box of cluster) {
              extendedBoxes.push({
                ...box,
                // Store extended cluster bounds for visualization
                _clusterExtended: extendedCluster,
              } as EarthquakeBoundingBox & { _clusterExtended?: { north: number; south: number; east: number; west: number } })
            }
          }
        }
        return extendedBoxes
      } else {
        // Extend each box individually
        return boxes.map(box => extendBox(box, extensionKm))
      }
    },

    runStressTest: async (boxId) => {
      const { boxes, filters } = get()
      const box = boxes.find(b => b.id === boxId)
      if (!box) return

      set({ isRunningStressTest: true })

      try {
        // Define stress test scenarios
        const magnitudeVariations = [-0.5, 0, 0.5]
        const boundaryVariations = [0, 25, 50, 100]
        
        const results: StressTestResult[] = []
        
        // Get baseline first
        const baselineStats = await earthquakeParametricApi.calculateBoxStatistics(box, filters)
        const baseline = baselineStats.trigger_probability

        for (const magDelta of magnitudeVariations) {
          for (const boundaryKm of boundaryVariations) {
            // Create modified box
            const modifiedBox = boundaryKm > 0 ? extendBox(box, boundaryKm) : box
            
            // Create modified trigger criteria
            const modifiedTrigger = box.trigger ? {
              ...box.trigger,
              min_magnitude: (box.trigger.min_magnitude || 5.0) + magDelta,
            } : { min_magnitude: 5.0 + magDelta }

            const testBox = { ...modifiedBox, trigger: modifiedTrigger }
            const stats = await earthquakeParametricApi.calculateBoxStatistics(testBox, filters)

            results.push({
              scenarioName: `M${modifiedTrigger.min_magnitude?.toFixed(1)}+, +${boundaryKm}km`,
              parameterAdjustments: { magnitude: magDelta },
              boundaryExtensionKm: boundaryKm,
              triggerProbability: stats.trigger_probability,
              qualifyingEvents: stats.qualifying_earthquakes,
              totalEvents: stats.total_earthquakes,
              percentageChange: baseline > 0 ? ((stats.trigger_probability - baseline) / baseline) * 100 : 0,
            })
          }
        }

        set((state) => ({
          stressTestResults: { ...state.stressTestResults, [boxId]: results },
          isRunningStressTest: false,
        }))
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Stress test failed',
          isRunningStressTest: false,
        })
      }
    },

    // API Actions
    fetchDatasets: async () => {
      try {
        const datasets = await earthquakeParametricApi.getAvailableDatasets()
        set({ datasets })
      } catch (error) {
        console.error('Failed to fetch datasets:', error)
      }
    },

    fetchHistoricalEarthquakes: async () => {
      const { filters } = get()
      set({ isLoading: true, error: null })

      try {
        const earthquakes =
          await earthquakeParametricApi.getHistoricalEarthquakes(filters)
        set({ earthquakes, isLoading: false })
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch earthquakes',
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
        const stats = await earthquakeParametricApi.calculateBoxStatistics(
          box,
          filters
        )
        set((state) => ({
          statistics: { ...state.statistics, [boxId]: stats },
          isLoadingStats: false,
        }))
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to calculate statistics',
          isLoadingStats: false,
        })
      }
    },

    calculateAllStatistics: async () => {
      const { boxes, filters } = get()
      if (boxes.length === 0) return

      set({ isLoadingStats: true, error: null })

      try {
        const allStats = await earthquakeParametricApi.calculateAllBoxStatistics(
          boxes,
          filters
        )
        set({ statistics: allStats, isLoadingStats: false })
        // Recalculate overall statistics
        get().calculateOverallStatistics()
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to calculate statistics',
          isLoadingStats: false,
        })
      }
    },

    calculateOverallStatistics: () => {
      const { boxes, earthquakes, statistics, filters, payoutAggregationOptions } = get()
      
      if (boxes.length === 0 || Object.keys(statistics).length === 0) {
        set({ overallStatistics: null })
        return
      }

      const yearsAnalyzed = filters.endYear - filters.startYear + 1
      
      // Calculate which earthquakes fall in which boxes
      const earthquakeBoxMap = new Map<string, { boxes: string[]; payouts: number[]; maxPayout: number }>()
      
      earthquakes.forEach(eq => {
        const boxHits: string[] = []
        const payouts: number[] = []
        let maxPayout = 0
        
        boxes.forEach(box => {
          const inBox = eq.latitude >= box.south && eq.latitude <= box.north &&
                       eq.longitude >= box.west && eq.longitude <= box.east
          
          if (inBox) {
            // Check if meets trigger criteria
            const meetsTrigger = !box.trigger || (
              (box.trigger.min_magnitude === undefined || eq.magnitude >= box.trigger.min_magnitude) &&
              (box.trigger.max_depth_km === undefined || eq.depth_km <= box.trigger.max_depth_km) &&
              (box.trigger.min_depth_km === undefined || eq.depth_km >= box.trigger.min_depth_km)
            )
            
            if (meetsTrigger) {
              boxHits.push(box.id)
              
              // Calculate payout for this box
              let payout = 0
              if (box.payout) {
                const matchingTier = box.payout.tiers
                  .filter(t => eq.magnitude >= t.minIntensity && (t.maxIntensity === undefined || eq.magnitude <= t.maxIntensity))
                  .sort((a, b) => b.minIntensity - a.minIntensity)[0]
                
                if (matchingTier) {
                  if (matchingTier.fixedPayout !== undefined) {
                    payout = matchingTier.fixedPayout
                  } else if (box.payout.payoutType === 'percentage' && matchingTier.payoutPercent !== undefined) {
                    payout = box.payout.basePayout * (matchingTier.payoutPercent / 100)
                  } else {
                    payout = box.payout.basePayout * matchingTier.payoutMultiplier
                  }
                }
              }
              
              payouts.push(payout)
              maxPayout = Math.max(maxPayout, payout)
            }
          }
        })
        
        if (boxHits.length > 0) {
          earthquakeBoxMap.set(eq.event_id, { boxes: boxHits, payouts, maxPayout })
        }
      })

      // Aggregate based on mode
      let totalHistoricalPayouts = 0
      let maxSingleEventPayout = 0
      
      earthquakeBoxMap.forEach(({ payouts, maxPayout }) => {
        let eventPayout = 0
        
        switch (payoutAggregationOptions.mode) {
          case 'worst_only':
            eventPayout = maxPayout
            break
          case 'capped_100':
            // Sum payouts but cap at the max single box payout (100%)
            const sum = payouts.reduce((a, b) => a + b, 0)
            const maxBoxLimit = Math.max(...boxes.map(b => b.payout?.basePayout || 0))
            eventPayout = Math.min(sum, maxBoxLimit)
            break
          case 'sum_all':
            eventPayout = payouts.reduce((a, b) => a + b, 0)
            break
        }
        
        totalHistoricalPayouts += eventPayout
        maxSingleEventPayout = Math.max(maxSingleEventPayout, eventPayout)
      })

      // Aggregate stats from all boxes
      const totalEvents = Object.values(statistics).reduce((sum, s) => sum + s.total_earthquakes, 0)
      const totalQualifying = earthquakeBoxMap.size
      const eventsWithMultipleBoxes = Array.from(earthquakeBoxMap.values()).filter(v => v.boxes.length > 1).length
      const avgBoxesPerEvent = earthquakeBoxMap.size > 0
        ? Array.from(earthquakeBoxMap.values()).reduce((sum, v) => sum + v.boxes.length, 0) / earthquakeBoxMap.size
        : 0

      const overallStats: OverallStatistics = {
        totalBoxes: boxes.length,
        totalEvents,
        totalQualifyingEvents: totalQualifying,
        yearsAnalyzed,
        overallAnnualFrequency: totalQualifying / yearsAnalyzed,
        overallTriggerProbability: 1 - Math.pow(1 - (totalQualifying / yearsAnalyzed), 1),
        expectedAnnualPayout: totalHistoricalPayouts / yearsAnalyzed,
        maxSingleEventPayout,
        totalHistoricalPayouts,
        avgPayoutPerEvent: totalQualifying > 0 ? totalHistoricalPayouts / totalQualifying : 0,
        eventsWithMultipleBoxes,
        avgBoxesPerEvent,
        aggregationMode: payoutAggregationOptions.mode,
      }

      set({ overallStatistics: overallStats })
    },

    runOverallStressTest: async () => {
      const { boxes, filters, getExtendedBoxes, stressTestConfig, overallStatistics } = get()
      
      if (boxes.length === 0 || !stressTestConfig.enabled) return

      set({ isRunningStressTest: true })

      try {
        // Get baseline overall stats
        const baselineStats = overallStatistics

        // Get extended boxes
        const extendedBoxes = getExtendedBoxes()

        // Calculate stats for extended boxes
        const extendedStatsMap = await earthquakeParametricApi.calculateAllBoxStatistics(
          extendedBoxes,
          filters
        )

        // Store temporarily to calculate overall with extended
        const originalBoxes = boxes
        const originalStats = get().statistics

        set({ boxes: extendedBoxes, statistics: extendedStatsMap })
        get().calculateOverallStatistics()
        const extendedOverallStats = get().overallStatistics

        // Restore original
        set({ boxes: originalBoxes, statistics: originalStats })
        get().calculateOverallStatistics()

        if (baselineStats && extendedOverallStats) {
          const comparison: StressTestComparison = {
            baseline: baselineStats,
            extended: extendedOverallStats,
            triggerProbabilityDelta: extendedOverallStats.overallTriggerProbability - baselineStats.overallTriggerProbability,
            expectedPayoutDelta: extendedOverallStats.expectedAnnualPayout - baselineStats.expectedAnnualPayout,
            qualifyingEventsDelta: extendedOverallStats.totalQualifyingEvents - baselineStats.totalQualifyingEvents,
            triggerProbabilityChange: baselineStats.overallTriggerProbability > 0
              ? ((extendedOverallStats.overallTriggerProbability - baselineStats.overallTriggerProbability) / baselineStats.overallTriggerProbability) * 100
              : 0,
            expectedPayoutChange: baselineStats.expectedAnnualPayout > 0
              ? ((extendedOverallStats.expectedAnnualPayout - baselineStats.expectedAnnualPayout) / baselineStats.expectedAnnualPayout) * 100
              : 0,
            qualifyingEventsChange: baselineStats.totalQualifyingEvents > 0
              ? ((extendedOverallStats.totalQualifyingEvents - baselineStats.totalQualifyingEvents) / baselineStats.totalQualifyingEvents) * 100
              : 0,
          }

          set({ stressTestComparison: comparison, isRunningStressTest: false })
        } else {
          set({ isRunningStressTest: false })
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Stress test failed',
          isRunningStressTest: false,
        })
      }
    },
  })
)
