import { useParametricStore } from '../../stores/parametricStore'
import { TrendingUp, AlertTriangle, Calendar, BarChart3 } from 'lucide-react'

export default function TropicalCycloneOverallStatsPanel() {
  const { boxes, statistics, isLoadingStats } = useParametricStore()

  const hasBoxes = boxes.length > 0
  const hasStats = Object.keys(statistics).length > 0

  // Calculate aggregate statistics
  const aggregateStats = hasStats
    ? Object.values(statistics).reduce(
        (acc, stats) => {
          acc.totalCrossings += stats.total_hurricanes
          acc.totalQualifying += stats.qualifying_hurricanes
          acc.avgProbability += stats.trigger_probability
          acc.count += 1
          return acc
        },
        { totalCrossings: 0, totalQualifying: 0, avgProbability: 0, count: 0 }
      )
    : null

  if (aggregateStats) {
    aggregateStats.avgProbability = aggregateStats.avgProbability / aggregateStats.count
  }

  return (
    <div className="px-4 pb-4">
      {!hasBoxes && (
        <p className="text-sm text-gray-500 text-center py-4">
          Add trigger zones to see overall statistics
        </p>
      )}

      {hasBoxes && !hasStats && !isLoadingStats && (
        <p className="text-sm text-gray-500 text-center py-4">
          Calculate statistics first to see overall summary
        </p>
      )}

      {aggregateStats && hasStats && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <BarChart3 className="w-3 h-3 text-cyan-400" />
                <span className="text-xs text-gray-400">Zones Analyzed</span>
              </div>
              <div className="text-2xl font-bold text-white">{aggregateStats.count}</div>
            </div>

            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <TrendingUp className="w-3 h-3 text-purple-400" />
                <span className="text-xs text-gray-400">Avg Trigger Prob</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {(aggregateStats.avgProbability * 100).toFixed(1)}%
              </div>
            </div>

            <div className="bg-gray-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <AlertTriangle className="w-3 h-3 text-orange-400" />
                <span className="text-xs text-gray-400">Total Crossings</span>
              </div>
              <div className="text-xl font-semibold text-white">{aggregateStats.totalCrossings}</div>
            </div>

            <div className="bg-gray-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Calendar className="w-3 h-3 text-green-400" />
                <span className="text-xs text-gray-400">Total Qualifying</span>
              </div>
              <div className="text-xl font-semibold text-white">{aggregateStats.totalQualifying}</div>
            </div>
          </div>

          {/* Zone Summary List */}
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2 font-medium">Zone Probabilities</div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {Object.entries(statistics)
                .sort(([, a], [, b]) => b.trigger_probability - a.trigger_probability)
                .map(([boxId, stats]) => (
                  <div key={boxId} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 truncate flex-1 mr-2">{stats.box_name}</span>
                    <span className="text-blue-400 font-medium">
                      {(stats.trigger_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
