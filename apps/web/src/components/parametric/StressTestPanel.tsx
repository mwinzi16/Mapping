import { useState } from 'react'
import {
  FlaskConical,
  Expand,
  Settings,
  ChevronDown,
  ChevronUp,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Layers,
  BarChart3,
} from 'lucide-react'
import { useEarthquakeParametricStore } from '../../stores/earthquakeParametricStore'

interface StressTestPanelProps {
  embedded?: boolean
}

export default function StressTestPanel({ embedded = false }: StressTestPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const {
    stressTestConfig,
    setStressTestConfig,
    boxes,
    selectedBoxId,
    stressTestResults,
    stressTestComparison,
    isRunningStressTest,
    runStressTest,
    runOverallStressTest,
    overallStatistics,
  } = useEarthquakeParametricStore()

  const selectedResults = selectedBoxId ? stressTestResults[selectedBoxId] : null

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`
    return `$${amount.toFixed(0)}`
  }

  const formatChange = (value: number, isPercent = true) => {
    const sign = value > 0 ? '+' : ''
    return isPercent ? `${sign}${value.toFixed(1)}%` : `${sign}${value.toFixed(0)}`
  }

  // Content to render (shared between embedded and standalone modes)
  const renderContent = () => (
    <div className="px-4 pb-4 space-y-4">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Enable Stress Test</span>
        <button
          onClick={() => setStressTestConfig({ enabled: !stressTestConfig.enabled })}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            stressTestConfig.enabled ? 'bg-purple-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              stressTestConfig.enabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {stressTestConfig.enabled && (
        <>
          {/* Boundary Extension Settings */}
          <div className="bg-gray-700/50 rounded-lg p-3 space-y-3">
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <Expand className="w-4 h-4 text-cyan-400" />
              <span>Boundary Extension</span>
            </div>

            {/* Extension Type Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-600">
              <button
                onClick={() => setStressTestConfig({ usePerecentageExtension: false })}
                className={`flex-1 px-3 py-1.5 text-xs transition-colors ${
                  !stressTestConfig.usePerecentageExtension
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                Fixed (km)
              </button>
              <button
                onClick={() => setStressTestConfig({ usePerecentageExtension: true })}
                className={`flex-1 px-3 py-1.5 text-xs transition-colors ${
                  stressTestConfig.usePerecentageExtension
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                Percentage (%)
              </button>
            </div>

            {/* Extension Value */}
            {stressTestConfig.usePerecentageExtension ? (
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Extension: {stressTestConfig.boundaryExtensionPercent}%
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={stressTestConfig.boundaryExtensionPercent}
                  onChange={(e) =>
                    setStressTestConfig({
                      boundaryExtensionPercent: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5%</span>
                  <span>50%</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Extension: {stressTestConfig.boundaryExtensionKm} km
                </label>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={stressTestConfig.boundaryExtensionKm}
                  onChange={(e) =>
                    setStressTestConfig({
                      boundaryExtensionKm: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>10 km</span>
                  <span>200 km</span>
                </div>
              </div>
            )}

            {/* Cluster Mode */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-600">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-gray-300">Cluster Extension Only</span>
              </div>
              <button
                onClick={() =>
                  setStressTestConfig({
                    extendClusterOnly: !stressTestConfig.extendClusterOnly,
                  })
                }
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  stressTestConfig.extendClusterOnly ? 'bg-orange-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    stressTestConfig.extendClusterOnly ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              When enabled, only extends the outer boundaries of clustered boxes
            </p>
          </div>

          {/* Run Overall Stress Test Button */}
          {boxes.length > 0 && overallStatistics && (
            <button
              onClick={() => runOverallStressTest()}
              disabled={isRunningStressTest}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isRunningStressTest ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running Overall Comparison...</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  <span>Compare Overall Statistics</span>
                </>
              )}
            </button>
          )}

          {/* Overall Stress Test Comparison */}
          {stressTestComparison && (
            <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-3 space-y-3">
              <div className="flex items-center space-x-2 text-sm text-purple-300">
                <BarChart3 className="w-4 h-4" />
                <span>Overall Comparison: Baseline vs Extended</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                {/* Trigger Probability */}
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 mb-1">Trigger Probability</div>
                  <div className="flex items-center justify-between">
                    <span className="text-white">
                      {(stressTestComparison.baseline.overallTriggerProbability * 100).toFixed(1)}%
                    </span>
                    <span className="text-gray-500">→</span>
                    <span className="text-purple-400 font-medium">
                      {(stressTestComparison.extended.overallTriggerProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className={`text-center mt-1 ${
                    stressTestComparison.triggerProbabilityChange > 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {formatChange(stressTestComparison.triggerProbabilityChange)}
                  </div>
                </div>
                
                {/* Expected Payout */}
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 mb-1">Expected Payout</div>
                  <div className="flex items-center justify-between">
                    <span className="text-white">
                      {formatCurrency(stressTestComparison.baseline.expectedAnnualPayout)}
                    </span>
                    <span className="text-gray-500">→</span>
                    <span className="text-purple-400 font-medium">
                      {formatCurrency(stressTestComparison.extended.expectedAnnualPayout)}
                    </span>
                  </div>
                  <div className={`text-center mt-1 ${
                    stressTestComparison.expectedPayoutChange > 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {formatChange(stressTestComparison.expectedPayoutChange)}
                  </div>
                </div>
                
                {/* Qualifying Events */}
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 mb-1">Qualifying Events</div>
                  <div className="flex items-center justify-between">
                    <span className="text-white">
                      {stressTestComparison.baseline.totalQualifyingEvents}
                    </span>
                    <span className="text-gray-500">→</span>
                    <span className="text-purple-400 font-medium">
                      {stressTestComparison.extended.totalQualifyingEvents}
                    </span>
                  </div>
                  <div className={`text-center mt-1 ${
                    stressTestComparison.qualifyingEventsChange > 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {formatChange(stressTestComparison.qualifyingEventsChange)}
                  </div>
                </div>
              </div>
              
              {/* Summary */}
              <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-700">
                Extended boundaries add{' '}
                <span className="text-purple-400 font-medium">
                  {stressTestComparison.qualifyingEventsDelta}
                </span>{' '}
                additional qualifying events
              </div>
            </div>
          )}

          {/* Run Individual Zone Stress Test */}
          {boxes.length > 0 && selectedBoxId && (
            <button
              onClick={() => runStressTest(selectedBoxId)}
              disabled={isRunningStressTest}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isRunningStressTest ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running Tests...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Test Selected Zone</span>
                </>
              )}
            </button>
          )}

          {/* Stress Test Results */}
          {selectedResults && selectedResults.length > 0 && (
            <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center space-x-2 text-sm text-gray-300 mb-3">
                <Settings className="w-4 h-4 text-green-400" />
                <span>Individual Zone Results</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1">
                {selectedResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2 bg-gray-800/50 rounded text-xs"
                  >
                    <span className="text-gray-300 flex-1">{result.scenarioName}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">
                        {(result.triggerProbability * 100).toFixed(1)}%
                      </span>
                      <span
                        className={`flex items-center ${
                          result.percentageChange > 5
                            ? 'text-red-400'
                            : result.percentageChange < -5
                            ? 'text-green-400'
                            : 'text-gray-500'
                        }`}
                      >
                        {result.percentageChange > 5 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : result.percentageChange < -5 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                        <span className="ml-1">
                          {result.percentageChange > 0 ? '+' : ''}
                          {result.percentageChange.toFixed(0)}%
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!overallStatistics && boxes.length > 0 && (
            <p className="text-xs text-gray-500 text-center py-2">
              Calculate statistics first to enable stress testing
            </p>
          )}
        </>
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
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <FlaskConical className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-gray-200">Stress Testing</span>
        </div>
        <div className="flex items-center space-x-2">
          {stressTestConfig.enabled && (
            <span className="text-xs text-purple-400">Active</span>
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
