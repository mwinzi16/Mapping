import { useIndemnityStore } from '../../stores/indemnityStore'
import { AlertTriangle, MapPin } from 'lucide-react'
import { formatTIVShort } from '../../utils/tivExcelUtils'

export default function TIVConcentrationPanel() {
  const { statistics } = useIndemnityStore()

  if (!statistics) {
    return (
      <div className="px-4 pb-4">
        <p className="text-sm text-gray-500 text-center py-4">
          Calculate statistics to see concentration risk analysis
        </p>
      </div>
    )
  }

  const { concentrationRisk, totalTIV, currency } = statistics
  const top10 = concentrationRisk.top10Locations

  // Calculate concentration metrics
  const top10TIV = top10.reduce((sum, loc) => sum + loc.tiv, 0)
  const top10Percentage = (top10TIV / totalTIV) * 100

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Concentration Warning */}
      {top10Percentage > 50 && (
        <div className="flex items-start space-x-2 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-yellow-300 font-medium">High Concentration Risk</p>
            <p className="text-xs text-yellow-400/80 mt-1">
              Top 10 locations represent {top10Percentage.toFixed(1)}% of total TIV
            </p>
          </div>
        </div>
      )}

      {/* Concentration Summary */}
      <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 p-3 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Top 10 Concentration</span>
          <span className={`text-lg font-bold ${
            top10Percentage > 50 ? 'text-yellow-400' : 
            top10Percentage > 30 ? 'text-orange-400' : 'text-green-400'
          }`}>
            {top10Percentage.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
          <div
            className={`h-full ${
              top10Percentage > 50 ? 'bg-yellow-500' :
              top10Percentage > 30 ? 'bg-orange-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(top10Percentage, 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {formatTIVShort(top10TIV, currency)} of {formatTIVShort(totalTIV, currency)}
        </div>
      </div>

      {/* Top 10 Locations */}
      <div className="bg-gray-700/50 p-3 rounded-lg">
        <div className="flex items-center space-x-2 mb-3">
          <MapPin className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs text-gray-400 font-medium">Top 10 Locations by TIV</span>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {top10.map((location, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <span className="text-gray-500 w-4">{index + 1}.</span>
                <span className="text-gray-300 truncate">{location.name}</span>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                <span className="text-yellow-400 font-medium">
                  {formatTIVShort(location.tiv, currency)}
                </span>
                <span className="text-gray-500 text-[10px]">
                  ({location.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Thresholds */}
      <div className="bg-gray-700/50 p-3 rounded-lg">
        <div className="text-xs text-gray-400 mb-2 font-medium">Concentration Thresholds</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-400">&lt; 30%</span>
            <span className="text-green-400">Low concentration</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-gray-400">30-50%</span>
            <span className="text-orange-400">Moderate concentration</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-400">&gt; 50%</span>
            <span className="text-yellow-400">High concentration</span>
          </div>
        </div>
      </div>
    </div>
  )
}
