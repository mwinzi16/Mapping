import { useState } from 'react'
import {
  Expand,
  Settings,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Layers,
} from 'lucide-react'
import { useParametricStore } from '../../stores/parametricStore'
import { BoundingBox, StressTestConfig, StressTestResult } from '../../types/parametric'
import { parametricApi } from '../../services/parametricApi'

// Local stress test state
const DEFAULT_STRESS_TEST_CONFIG: StressTestConfig = {
  boundaryExtensionKm: 50,
  boundaryExtensionPercent: 10,
  usePerecentageExtension: false,
  extendClusterOnly: true,
  enabled: false,
}

// Extend box boundaries helper
function extendBox(box: BoundingBox, extensionKm: number): BoundingBox {
  const latExtension = extensionKm / 111
  const avgLat = (box.north + box.south) / 2
  const lngExtension = extensionKm / (111 * Math.cos((avgLat * Math.PI) / 180))

  return {
    ...box,
    north: Math.min(90, box.north + latExtension),
    south: Math.max(-90, box.south - latExtension),
    east: box.east + lngExtension,
    west: box.west - lngExtension,
  }
}

export default function TropicalCycloneStressTestSection() {
  const [config, setConfig] = useState<StressTestConfig>(DEFAULT_STRESS_TEST_CONFIG)
  const [results, setResults] = useState<Record<string, StressTestResult[]>>({})
  const [isRunning, setIsRunning] = useState(false)

  const { boxes, selectedBoxId, filters, statistics } = useParametricStore()

  const selectedResults = selectedBoxId ? results[selectedBoxId] : null
  const hasStats = Object.keys(statistics).length > 0

  const updateConfig = (updates: Partial<StressTestConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }))
  }

  const runStressTest = async () => {
    if (!selectedBoxId) return
    const box = boxes.find((b) => b.id === selectedBoxId)
    if (!box) return

    setIsRunning(true)

    try {
      // Define stress test scenarios
      const categoryVariations = [-1, 0, 1]
      const boundaryVariations = [0, 25, 50, 100]

      const testResults: StressTestResult[] = []

      // Get baseline first
      const baselineStats = await parametricApi.calculateBoxStatistics(box, filters)
      const baseline = baselineStats.trigger_probability

      for (const catDelta of categoryVariations) {
        for (const boundaryKm of boundaryVariations) {
          // Create modified box
          const modifiedBox = boundaryKm > 0 ? extendBox(box, boundaryKm) : box

          // Create modified trigger criteria
          const baseCategory = box.trigger?.min_category ?? 1
          const newCategory = Math.max(0, Math.min(5, baseCategory + catDelta))
          const modifiedTrigger = {
            ...box.trigger,
            min_category: newCategory,
          }

          const testBox = { ...modifiedBox, trigger: modifiedTrigger }
          const stats = await parametricApi.calculateBoxStatistics(testBox, filters)

          testResults.push({
            scenarioName: `Cat ${newCategory}+, +${boundaryKm}km`,
            parameterAdjustments: { category: catDelta },
            boundaryExtensionKm: boundaryKm,
            triggerProbability: stats.trigger_probability,
            qualifyingEvents: stats.qualifying_hurricanes,
            totalEvents: stats.total_hurricanes,
            percentageChange: baseline > 0 ? ((stats.trigger_probability - baseline) / baseline) * 100 : 0,
          })
        }
      }

      setResults((prev) => ({ ...prev, [selectedBoxId]: testResults }))
    } catch (error) {
      console.error('Stress test failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Prerequisites message */}
      {!hasStats && (
        <p className="text-xs text-gray-500 text-center py-2">
          Calculate statistics first to enable stress testing
        </p>
      )}

      {hasStats && (
        <>
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Enable Stress Test</span>
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.enabled ? 'bg-purple-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  config.enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {config.enabled && (
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
                    onClick={() => updateConfig({ usePerecentageExtension: false })}
                    className={`flex-1 px-3 py-1.5 text-xs transition-colors ${
                      !config.usePerecentageExtension
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    Fixed (km)
                  </button>
                  <button
                    onClick={() => updateConfig({ usePerecentageExtension: true })}
                    className={`flex-1 px-3 py-1.5 text-xs transition-colors ${
                      config.usePerecentageExtension
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    Percentage (%)
                  </button>
                </div>

                {/* Extension Value */}
                {config.usePerecentageExtension ? (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      Extension: {config.boundaryExtensionPercent}%
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={config.boundaryExtensionPercent}
                      onChange={(e) =>
                        updateConfig({
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
                      Extension: {config.boundaryExtensionKm} km
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      step="10"
                      value={config.boundaryExtensionKm}
                      onChange={(e) =>
                        updateConfig({
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
                      updateConfig({
                        extendClusterOnly: !config.extendClusterOnly,
                      })
                    }
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      config.extendClusterOnly ? 'bg-orange-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        config.extendClusterOnly ? 'translate-x-4' : ''
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  When enabled, only extends the outer boundaries of clustered boxes
                </p>
              </div>

              {/* Run Stress Test Button */}
              {boxes.length > 0 && selectedBoxId && (
                <button
                  onClick={runStressTest}
                  disabled={isRunning}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Running Tests...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Run Stress Test on Selected Zone</span>
                    </>
                  )}
                </button>
              )}

              {/* Stress Test Results */}
              {selectedResults && selectedResults.length > 0 && (
                <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-300 mb-3">
                    <Settings className="w-4 h-4 text-green-400" />
                    <span>Stress Test Results</span>
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

              {!selectedBoxId && boxes.length > 0 && (
                <p className="text-xs text-gray-500 text-center py-2">
                  Select a zone to run stress tests
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
