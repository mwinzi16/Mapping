import { useIndemnityStore } from '../../stores/indemnityStore'
import { DollarSign, MapPin, TrendingUp, BarChart3 } from 'lucide-react'
import { formatTIV, formatTIVShort } from '../../utils/tivExcelUtils'

export default function TIVStatisticsPanel() {
  const { statistics, datasets, activeDatasetId } = useIndemnityStore()

  const activeDataset = datasets.find(d => d.id === activeDatasetId)

  if (!statistics || !activeDataset) {
    return (
      <div className="px-4 pb-4">
        <p className="text-sm text-gray-500 text-center py-4">
          No statistics available. Calculate statistics first.
        </p>
      </div>
    )
  }

  const currency = statistics.currency

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-3 rounded-lg">
          <div className="flex items-center space-x-1 mb-1">
            <DollarSign className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-gray-400">Total TIV</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatTIVShort(statistics.totalTIV, currency)}
          </div>
          <div className="text-xs text-gray-500">
            {formatTIV(statistics.totalTIV, currency)}
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 p-3 rounded-lg">
          <div className="flex items-center space-x-1 mb-1">
            <MapPin className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-gray-400">Locations</span>
          </div>
          <div className="text-xl font-bold text-white">
            {statistics.totalRecords.toLocaleString()}
          </div>
        </div>

        <div className="bg-gray-700/50 p-3 rounded-lg">
          <div className="flex items-center space-x-1 mb-1">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-xs text-gray-400">Average TIV</span>
          </div>
          <div className="text-lg font-semibold text-white">
            {formatTIVShort(statistics.averageTIV, currency)}
          </div>
        </div>

        <div className="bg-gray-700/50 p-3 rounded-lg">
          <div className="flex items-center space-x-1 mb-1">
            <BarChart3 className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-gray-400">Median TIV</span>
          </div>
          <div className="text-lg font-semibold text-white">
            {formatTIVShort(statistics.medianTIV, currency)}
          </div>
        </div>
      </div>

      {/* Min/Max */}
      <div className="bg-gray-700/50 p-3 rounded-lg">
        <div className="flex justify-between text-xs">
          <div>
            <span className="text-gray-400">Min TIV: </span>
            <span className="text-white font-medium">{formatTIVShort(statistics.minTIV, currency)}</span>
          </div>
          <div>
            <span className="text-gray-400">Max TIV: </span>
            <span className="text-white font-medium">{formatTIVShort(statistics.maxTIV, currency)}</span>
          </div>
        </div>
      </div>

      {/* By Category */}
      {Object.keys(statistics.byCategory).length > 0 && (
        <div className="bg-gray-700/50 p-3 rounded-lg">
          <div className="text-xs text-gray-400 mb-2 font-medium">TIV by Category</div>
          <div className="space-y-2">
            {Object.entries(statistics.byCategory)
              .sort(([, a], [, b]) => b.tiv - a.tiv)
              .map(([category, data]) => (
                <div key={category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">{category}</span>
                    <span className="text-white">
                      {formatTIVShort(data.tiv, currency)} ({data.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500"
                      style={{ width: `${data.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* By State */}
      {statistics.byState && Object.keys(statistics.byState).length > 0 && (
        <div className="bg-gray-700/50 p-3 rounded-lg">
          <div className="text-xs text-gray-400 mb-2 font-medium">TIV by State (Top 5)</div>
          <div className="space-y-1.5">
            {Object.entries(statistics.byState)
              .sort(([, a], [, b]) => b.tiv - a.tiv)
              .slice(0, 5)
              .map(([state, data]) => (
                <div key={state} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">{state}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">{data.count} loc</span>
                    <span className="text-purple-400 font-medium">
                      {formatTIVShort(data.tiv, currency)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
