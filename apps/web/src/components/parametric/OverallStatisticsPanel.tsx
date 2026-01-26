import { useState } from 'react'
import {
  BarChart3,
  DollarSign,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingUp,
  Layers,
  Settings,
} from 'lucide-react'
import { useEarthquakeParametricStore } from '../../stores/earthquakeParametricStore'
import type { PayoutAggregationOptions } from '../../types/parametric'

interface OverallStatisticsPanelProps {
  embedded?: boolean
}

export default function OverallStatisticsPanel({ embedded = false }: OverallStatisticsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const {
    overallStatistics,
    payoutAggregationOptions,
    setPayoutAggregationOptions,
    boxes,
    statistics,
  } = useEarthquakeParametricStore()

  const hasStats = Object.keys(statistics).length > 0

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`
    }
    return `$${amount.toFixed(0)}`
  }

  const aggregationModeLabels: Record<PayoutAggregationOptions['mode'], string> = {
    worst_only: 'Worst Event Only (each event counts once)',
    capped_100: 'Capped at 100% (sum capped at limit)',
    sum_all: 'Sum All (no cap)',
  }

  const aggregationModeDescriptions: Record<PayoutAggregationOptions['mode'], string> = {
    worst_only: 'Each event triggers only its highest-paying box',
    capped_100: 'Event payouts across boxes are summed but capped at the maximum limit',
    sum_all: 'All triggered payouts are summed without any cap',
  }

  // Content to render (shared between embedded and standalone modes)
  const renderContent = () => {
    if (!hasStats) {
      return (
        <p className="text-xs text-gray-500 text-center py-2">
          Click "Analyze All" to calculate statistics
        </p>
      )
    }

    return (
      <>
        {/* Aggregation Mode Selector */}
        <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center space-x-2 text-sm text-gray-300 mb-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <span>Payout Aggregation Mode</span>
          </div>
          
          <div className="space-y-1">
            {(['worst_only', 'capped_100', 'sum_all'] as PayoutAggregationOptions['mode'][]).map((mode) => (
              <button
                key={mode}
                onClick={() => setPayoutAggregationOptions({ mode })}
                className={`w-full px-3 py-2 text-left rounded transition-colors ${
                  payoutAggregationOptions.mode === mode
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="text-xs font-medium">
                  {aggregationModeLabels[mode]}
                </div>
                <div className="text-xs opacity-70 mt-0.5">
                  {aggregationModeDescriptions[mode]}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Overall Stats Display */}
        {overallStatistics && (
          <div className="space-y-3">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center space-x-1 text-xs text-gray-400 mb-1">
                  <Layers className="w-3 h-3" />
                  <span>Total Boxes</span>
                </div>
                <div className="text-lg font-bold text-white">
                  {overallStatistics.totalBoxes}
                </div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center space-x-1 text-xs text-gray-400 mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Qualifying Events</span>
                </div>
                <div className="text-lg font-bold text-yellow-400">
                  {overallStatistics.totalQualifyingEvents}
                </div>
              </div>
            </div>

            {/* Trigger Probability */}
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1 text-xs text-gray-400">
                  <TrendingUp className="w-3 h-3" />
                  <span>Overall Trigger Probability</span>
                </div>
                <span className="text-lg font-bold text-green-400">
                  {(overallStatistics.overallTriggerProbability * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${Math.min(100, overallStatistics.overallTriggerProbability * 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {overallStatistics.overallAnnualFrequency.toFixed(2)} events/year on average
              </div>
            </div>

            {/* Payout Summary */}
            <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center space-x-1 text-xs text-gray-400 mb-2">
                <DollarSign className="w-3 h-3" />
                <span>Payout Analysis ({aggregationModeLabels[overallStatistics.aggregationMode].split(' (')[0]})</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-400">Expected Annual:</span>
                  <span className="block text-green-400 font-medium">
                    {formatCurrency(overallStatistics.expectedAnnualPayout)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Max Single Event:</span>
                  <span className="block text-red-400 font-medium">
                    {formatCurrency(overallStatistics.maxSingleEventPayout)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Total Historical:</span>
                  <span className="block text-white font-medium">
                    {formatCurrency(overallStatistics.totalHistoricalPayouts)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Avg Per Event:</span>
                  <span className="block text-white font-medium">
                    {formatCurrency(overallStatistics.avgPayoutPerEvent)}
                  </span>
                </div>
              </div>
            </div>

            {/* Multi-box Events */}
            {overallStatistics.eventsWithMultipleBoxes > 0 && (
              <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-3">
                <div className="text-xs text-orange-400 mb-1">
                  ⚠️ Multi-Box Events
                </div>
                <div className="text-sm text-white">
                  <span className="font-medium">{overallStatistics.eventsWithMultipleBoxes}</span> events triggered multiple boxes
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Average of {overallStatistics.avgBoxesPerEvent.toFixed(1)} boxes per event
                </div>
              </div>
            )}

            {/* Per-Box Statistics Summary */}
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2">Per-Box Statistics</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {boxes.map((box) => {
                  const stats = statistics[box.id]
                  return (
                    <div
                      key={box.id}
                      className="flex items-center justify-between py-1 px-2 bg-gray-800/50 rounded text-xs"
                    >
                      <span className="text-gray-300 truncate flex-1">{box.name}</span>
                      <div className="flex items-center space-x-3">
                        <span className="text-yellow-400">
                          {stats?.qualifying_earthquakes ?? '-'} events
                        </span>
                        <span className="text-green-400 font-medium w-16 text-right">
                          {stats ? `${(stats.trigger_probability * 100).toFixed(1)}%` : '-'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Embedded mode - just show content without header
  if (embedded) {
    return (
      <div className="px-4 pb-4 space-y-4">
        {renderContent()}
      </div>
    )
  }

  // Standalone mode with collapsible header
  return (
    <div className="border-t border-gray-700">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-green-400" />
          <span className="text-sm font-semibold text-gray-200">Overall Statistics</span>
        </div>
        <div className="flex items-center space-x-2">
          {overallStatistics && (
            <span className="text-xs text-gray-400">
              {overallStatistics.totalQualifyingEvents} events
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {renderContent()}
        </div>
      )}
    </div>
  )
}
