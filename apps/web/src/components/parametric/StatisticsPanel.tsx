import { useParametricStore } from '../../stores/parametricStore'
import { Loader2, TrendingUp, AlertTriangle, Calendar, Wind, Target } from 'lucide-react'
import { TriggerCriteria } from '../../types/parametric'

export default function StatisticsPanel() {
  const { boxes, statistics, selectedBoxId, isLoadingStats, calculateAllStatistics } = useParametricStore()
  
  const selectedStats = selectedBoxId ? statistics[selectedBoxId] : null
  
  // Get overall stats
  const hasBoxes = boxes.length > 0
  const hasStats = Object.keys(statistics).length > 0
  
  // Format trigger criteria for display
  const formatTriggerCriteria = (trigger: TriggerCriteria | undefined): string | null => {
    if (!trigger) return null
    const parts: string[] = []
    if (trigger.min_category !== undefined) parts.push(`Cat ${trigger.min_category}+`)
    if (trigger.min_wind_knots !== undefined) parts.push(`≥${trigger.min_wind_knots}kt`)
    if (trigger.max_pressure_mb !== undefined) parts.push(`≤${trigger.max_pressure_mb}mb`)
    return parts.length > 0 ? parts.join(', ') : null
  }
  
  return (
    <div className="p-4 max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Statistics
        </h3>
        {hasBoxes && (
          <button
            onClick={() => calculateAllStatistics()}
            disabled={isLoadingStats}
            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingStats ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Analyze All'
            )}
          </button>
        )}
      </div>
      
      {isLoadingStats && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
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
          {selectedStats.trigger_criteria && formatTriggerCriteria(selectedStats.trigger_criteria) && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-amber-900/30 border border-amber-700/50 rounded-lg">
              <Target className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-300">
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
          <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400 uppercase">Annual Trigger Probability</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {(selectedStats.trigger_probability * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Based on {selectedStats.years_analyzed} years of data
            </div>
          </div>
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <AlertTriangle className="w-3 h-3 text-orange-400" />
                <span className="text-xs text-gray-400">Total Crossings</span>
              </div>
              <div className="text-xl font-semibold text-white">
                {selectedStats.total_hurricanes}
              </div>
            </div>
            
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Target className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-gray-400">Qualifying</span>
              </div>
              <div className="text-xl font-semibold text-white">
                {selectedStats.qualifying_hurricanes}
                {selectedStats.total_hurricanes > 0 && (
                  <span className="text-xs text-gray-400 ml-1">
                    ({((selectedStats.qualifying_hurricanes / selectedStats.total_hurricanes) * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
            
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Calendar className="w-3 h-3 text-green-400" />
                <span className="text-xs text-gray-400">Annual Avg</span>
              </div>
              <div className="text-xl font-semibold text-white">
                {selectedStats.qualifying_annual_frequency.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">
                (all: {selectedStats.annual_frequency.toFixed(2)})
              </div>
            </div>
            
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Wind className="w-3 h-3 text-cyan-400" />
                <span className="text-xs text-gray-400">Avg Intensity</span>
              </div>
              <div className="text-xl font-semibold text-white">
                {selectedStats.average_intensity_knots.toFixed(0)} kt
              </div>
            </div>
          </div>
          
          {/* Category Distribution */}
          <div className="bg-gray-700/50 p-3 rounded-lg">
            <div className="text-xs text-gray-400 mb-2">Category Distribution</div>
            <div className="space-y-1">
              {Object.entries(selectedStats.category_distribution)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([category, count]) => {
                  const percentage = (count / selectedStats.total_hurricanes) * 100
                  return (
                    <div key={category} className="flex items-center space-x-2">
                      <span className="text-xs text-gray-300 w-12">
                        {category === '0' ? 'TS' : `Cat ${category}`}
                      </span>
                      <div className="flex-1 h-2 bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8">{count}</span>
                    </div>
                  )
                })}
            </div>
          </div>
          
          {/* Monthly Distribution */}
          <div className="bg-gray-700/50 p-3 rounded-lg">
            <div className="text-xs text-gray-400 mb-2">Monthly Distribution</div>
            <div className="flex justify-between items-end h-16">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const count = selectedStats.monthly_distribution[month] || 0
                const maxCount = Math.max(...Object.values(selectedStats.monthly_distribution), 1)
                const height = (count / maxCount) * 100
                return (
                  <div key={month} className="flex flex-col items-center" style={{ width: '7%' }}>
                    <div
                      className="w-full bg-purple-500 rounded-t"
                      style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                    />
                    <span className="text-[10px] text-gray-500 mt-1">
                      {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][month - 1]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* All Boxes Summary */}
      {hasStats && !selectedBoxId && !isLoadingStats && (
        <div className="space-y-2">
          {Object.entries(statistics).map(([boxId, stats]) => (
            <div
              key={boxId}
              className="bg-gray-700/50 p-3 rounded-lg cursor-pointer hover:bg-gray-700"
              onClick={() => useParametricStore.getState().selectBox(boxId)}
            >
              <div className="flex justify-between items-center">
                <span className="text-white font-medium text-sm">{stats.box_name}</span>
                <span className="text-blue-400 font-bold">
                  {(stats.trigger_probability * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-400">
                {stats.qualifying_hurricanes}/{stats.total_hurricanes} qualifying in {stats.years_analyzed} years
              </div>
              {stats.trigger_criteria && formatTriggerCriteria(stats.trigger_criteria) && (
                <div className="text-xs text-amber-400 mt-1">
                  Trigger: {formatTriggerCriteria(stats.trigger_criteria)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
