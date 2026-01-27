import { useState } from 'react'
import { useEarthquakeParametricStore } from '../../stores/earthquakeParametricStore'
import {
  Loader2,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Mountain,
  Target,
  Layers,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react'
import { EarthquakeTriggerCriteria } from '../../types/parametric'
import { CHART_COLORS, CHART_STYLES } from '../../utils/chartConstants'

interface EarthquakeStatisticsPanelProps {
  embedded?: boolean
}

export default function EarthquakeStatisticsPanel({ embedded = false }: EarthquakeStatisticsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const {
    boxes,
    statistics,
    selectedBoxId,
    isLoadingStats,
    calculateAllStatistics,
  } = useEarthquakeParametricStore()

  const selectedStats = selectedBoxId ? statistics[selectedBoxId] : null

  // Get overall stats
  const hasBoxes = boxes.length > 0
  const hasStats = Object.keys(statistics).length > 0

  // Format trigger criteria for display
  const formatTriggerCriteria = (
    trigger: EarthquakeTriggerCriteria | undefined
  ): string | null => {
    if (!trigger) return null
    const parts: string[] = []
    if (trigger.min_magnitude !== undefined)
      parts.push(`M${trigger.min_magnitude}+`)
    if (trigger.max_depth_km !== undefined)
      parts.push(`≤${trigger.max_depth_km}km`)
    if (trigger.min_depth_km !== undefined)
      parts.push(`≥${trigger.min_depth_km}km`)
    return parts.length > 0 ? parts.join(', ') : null
  }

  // Content to render (shared between embedded and standalone modes)
  const renderContent = () => (
    <div className={`${embedded ? '' : 'px-4 pb-4'} max-h-80 overflow-y-auto`}>
      {/* Analyze All Button - only show in standalone mode */}
      {!embedded && hasBoxes && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => calculateAllStatistics()}
            disabled={isLoadingStats}
            className="text-xs px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingStats ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Analyze All'
            )}
          </button>
        </div>
      )}

      {isLoadingStats && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
          <span className="ml-2 text-gray-400">Calculating...</span>
        </div>
      )}

      {!hasBoxes && !isLoadingStats && (
        <p className="text-sm text-gray-500 text-center py-4">
          Add trigger zones to see statistics
        </p>
      )}

      {selectedStats && !isLoadingStats && (
        <div className="space-y-4">
          {/* Trigger Criteria Badge (if set) */}
          {selectedStats.trigger_criteria &&
            formatTriggerCriteria(selectedStats.trigger_criteria) && (
              <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                <Target className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-yellow-300">
                  <span className="font-medium">Trigger: </span>
                  {formatTriggerCriteria(selectedStats.trigger_criteria)}
                </span>
              </div>
            )}

          {/* Dataset Badge */}
          <div className="text-xs text-gray-500 text-right">
            Data: {selectedStats.dataset.toUpperCase()}
          </div>

          {/* Trigger Probability - Main Stat */}
          <div className={CHART_STYLES.gradientCardEQ}>
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-400 uppercase">
                Annual Trigger Probability
              </span>
            </div>
            <div className="text-3xl font-bold text-white">
              {(selectedStats.trigger_probability * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Based on {selectedStats.years_analyzed} years of data
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className={CHART_STYLES.statsGrid2}>
            <div className={CHART_STYLES.card}>
              <div className="flex items-center space-x-1 mb-1">
                <AlertTriangle className="w-3 h-3 text-orange-400" />
                <span className="text-xs text-gray-400">Total Events</span>
              </div>
              <div className="text-xl font-semibold text-white">
                {selectedStats.total_earthquakes}
              </div>
            </div>

            <div className="bg-gray-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Target className="w-3 h-3 text-green-400" />
                <span className="text-xs text-gray-400">Qualifying</span>
              </div>
              <div className="text-xl font-semibold text-white">
                {selectedStats.qualifying_earthquakes}
              </div>
            </div>

            <div className="bg-gray-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Calendar className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-gray-400">Per Year</span>
              </div>
              <div className="text-xl font-semibold text-white">
                {selectedStats.qualifying_annual_frequency.toFixed(2)}
              </div>
            </div>

            <div className="bg-gray-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Mountain className="w-3 h-3 text-red-400" />
                <span className="text-xs text-gray-400">Max Magnitude</span>
              </div>
              <div className="text-xl font-semibold text-white">
                M{selectedStats.max_magnitude.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Magnitude Details */}
          <div className="bg-gray-700/50 p-3 rounded-lg">
            <div className="flex items-center space-x-1 mb-2">
              <Mountain className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-gray-400 uppercase">
                Magnitude Stats
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-400">Average: </span>
                <span className="text-white">
                  M{selectedStats.average_magnitude.toFixed(1)}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Maximum: </span>
                <span className="text-white">
                  M{selectedStats.max_magnitude.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Depth Details */}
          <div className="bg-gray-700/50 p-3 rounded-lg">
            <div className="flex items-center space-x-1 mb-2">
              <Layers className="w-3 h-3 text-cyan-400" />
              <span className="text-xs text-gray-400 uppercase">Depth Stats</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-400">Average: </span>
                <span className="text-white">
                  {selectedStats.average_depth_km.toFixed(1)} km
                </span>
              </div>
              <div>
                <span className="text-gray-400">Shallowest: </span>
                <span className="text-white">
                  {selectedStats.shallowest_depth_km.toFixed(1)} km
                </span>
              </div>
            </div>
          </div>

          {/* Magnitude Distribution */}
          {Object.keys(selectedStats.magnitude_distribution).length > 0 && (
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <span className="text-xs text-gray-400 uppercase block mb-2">
                Magnitude Distribution
              </span>
              <div className="space-y-1">
                {Object.entries(selectedStats.magnitude_distribution)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([range, count]) => {
                    const maxCount = Math.max(
                      ...Object.values(selectedStats.magnitude_distribution)
                    )
                    const percentage = (count / maxCount) * 100
                    return (
                      <div key={range} className="flex items-center text-xs">
                        <span className="w-20 text-gray-400">M{range}</span>
                        <div className="flex-1 bg-gray-600 rounded-full h-2 mx-2">
                          <div
                            className="bg-yellow-500 rounded-full h-2"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-white">{count}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Depth Distribution */}
          {Object.keys(selectedStats.depth_distribution).length > 0 && (
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <span className="text-xs text-gray-400 uppercase block mb-2">
                Depth Distribution
              </span>
              <div className="space-y-1">
                {Object.entries(selectedStats.depth_distribution)
                  .sort(([a], [b]) => {
                    // Sort by depth category
                    const order: Record<string, number> = {
                      '0-10 km (Shallow)': 1,
                      '10-70 km (Intermediate)': 2,
                      '70-300 km (Deep)': 3,
                      '300+ km (Very Deep)': 4,
                    }
                    return (order[a] || 99) - (order[b] || 99)
                  })
                  .map(([range, count]) => {
                    const maxCount = Math.max(
                      ...Object.values(selectedStats.depth_distribution)
                    )
                    const percentage = (count / maxCount) * 100
                    return (
                      <div key={range} className="flex items-center text-xs">
                        <span className="w-36 text-gray-400 truncate">{range}</span>
                        <div className="flex-1 bg-gray-600 rounded-full h-2 mx-2">
                          <div
                            className="bg-cyan-500 rounded-full h-2"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-white">{count}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary when no box selected but stats exist */}
      {!selectedStats && hasStats && !isLoadingStats && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">All Zones Summary</p>
          
          {/* Per-box statistics summary */}
          <div className="space-y-2">
            {boxes.map((box) => {
              const boxStats = statistics[box.id]
              if (!boxStats) return null
              
              return (
                <div
                  key={box.id}
                  className="bg-gray-700/50 p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => useEarthquakeParametricStore.getState().selectBox(box.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: box.color || '#eab308' }}
                      />
                      <span className="text-sm font-medium text-white">{box.name}</span>
                    </div>
                    <span className="text-lg font-bold text-green-400">
                      {(boxStats.trigger_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{boxStats.qualifying_earthquakes} qualifying</span>
                    <span>Max M{boxStats.max_magnitude.toFixed(1)}</span>
                  </div>
                  {box.trigger && formatTriggerCriteria(box.trigger) && (
                    <div className="mt-1 text-xs text-yellow-500">
                      {formatTriggerCriteria(box.trigger)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          <div className="text-xs text-gray-500 text-center pt-2">
            Click a zone for detailed statistics
          </div>
        </div>
      )}
    </div>
  )

  // Embedded mode - just show content without header
  if (embedded) {
    return renderContent()
  }

  // Standalone mode with collapsible header
  return (
    <div className="border-t border-gray-700">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-gray-200">Statistics</span>
        </div>
        <div className="flex items-center space-x-2">
          {hasStats && (
            <span className="text-xs text-gray-400">{Object.keys(statistics).length} analyzed</span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && renderContent()}
    </div>
  )
}
