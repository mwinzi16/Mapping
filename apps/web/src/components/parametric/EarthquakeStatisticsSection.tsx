import { useState } from 'react'
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Layers,
  Target,
  FlaskConical,
  Loader2,
  Play,
} from 'lucide-react'
import EarthquakeStatisticsPanel from './EarthquakeStatisticsPanel'
import OverallStatisticsPanel from './OverallStatisticsPanel'
import StressTestPanel from './StressTestPanel'
import { useEarthquakeParametricStore } from '../../stores/earthquakeParametricStore'

type StatisticsSubSection = 'overall' | 'by-zone' | 'stress-testing'

export default function EarthquakeStatisticsSection() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedSubSection, setExpandedSubSection] = useState<StatisticsSubSection | null>(null)
  
  const {
    boxes,
    isLoadingStats,
    calculateAllStatistics,
    statistics,
  } = useEarthquakeParametricStore()
  
  const hasBoxes = boxes.length > 0
  const hasStats = Object.keys(statistics).length > 0

  const toggleSubSection = (section: StatisticsSubSection) => {
    setExpandedSubSection(prev => prev === section ? null : section)
  }

  return (
    <div className="border-t border-gray-700">
      {/* Main Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-gray-200">Statistics</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-700/50">
          {/* Calculate Statistics Button */}
          {hasBoxes && (
            <div className="px-4 py-3 border-b border-gray-700/50">
              <button
                onClick={() => calculateAllStatistics()}
                disabled={isLoadingStats}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isLoadingStats ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Calculating...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>{hasStats ? 'Recalculate All Statistics' : 'Calculate All Statistics'}</span>
                  </>
                )}
              </button>
            </div>
          )}
          
          {!hasBoxes && (
            <div className="px-4 py-3 border-b border-gray-700/50">
              <p className="text-xs text-gray-500 text-center">
                Add trigger zones to calculate statistics
              </p>
            </div>
          )}

          {/* Overall Statistics Sub-section */}
          <div className="border-b border-gray-700/50">
            <button
              onClick={() => toggleSubSection('overall')}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-700/20 transition-colors"
            >
              <div className="flex items-center space-x-2 pl-2">
                <Layers className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-medium text-gray-300">Overall</span>
              </div>
              {expandedSubSection === 'overall' ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>
            {expandedSubSection === 'overall' && (
              <OverallStatisticsPanel embedded />
            )}
          </div>

          {/* By Trigger Zone Sub-section */}
          <div className="border-b border-gray-700/50">
            <button
              onClick={() => toggleSubSection('by-zone')}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-700/20 transition-colors"
            >
              <div className="flex items-center space-x-2 pl-2">
                <Target className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-medium text-gray-300">By Trigger Zone</span>
              </div>
              {expandedSubSection === 'by-zone' ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>
            {expandedSubSection === 'by-zone' && (
              <EarthquakeStatisticsPanel embedded />
            )}
          </div>

          {/* Stress Testing Sub-section */}
          <div>
            <button
              onClick={() => toggleSubSection('stress-testing')}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-700/20 transition-colors"
            >
              <div className="flex items-center space-x-2 pl-2">
                <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-medium text-gray-300">Stress Testing</span>
              </div>
              {expandedSubSection === 'stress-testing' ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>
            {expandedSubSection === 'stress-testing' && (
              <StressTestPanel embedded />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
