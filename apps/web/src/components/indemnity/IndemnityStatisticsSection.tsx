import { useState } from 'react'
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Layers,
  Target,
  AlertTriangle,
  Loader2,
  Play,
} from 'lucide-react'
import TIVStatisticsPanel from './TIVStatisticsPanel'
import TIVConcentrationPanel from './TIVConcentrationPanel'
import EventImpactPanel from './EventImpactPanel'
import { useIndemnityStore } from '../../stores/indemnityStore'

type StatisticsSubSection = 'overview' | 'concentration' | 'event-impact'

export default function IndemnityStatisticsSection() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedSubSection, setExpandedSubSection] = useState<StatisticsSubSection | null>(null)

  const {
    activeDatasetId,
    isCalculatingStats,
    calculateStatistics,
    statistics,
  } = useIndemnityStore()

  const hasData = activeDatasetId !== null
  const hasStats = statistics !== null

  const toggleSubSection = (section: StatisticsSubSection) => {
    setExpandedSubSection((prev) => (prev === section ? null : section))
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
          {hasData && (
            <div className="px-4 py-3 border-b border-gray-700/50">
              <button
                onClick={() => calculateStatistics()}
                disabled={isCalculatingStats}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isCalculatingStats ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Calculating...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>{hasStats ? 'Recalculate Statistics' : 'Calculate Statistics'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {!hasData && (
            <div className="px-4 py-3 border-b border-gray-700/50">
              <p className="text-xs text-gray-500 text-center">
                Upload TIV data to calculate statistics
              </p>
            </div>
          )}

          {/* TIV Overview Sub-section */}
          <div className="border-b border-gray-700/50">
            <button
              onClick={() => toggleSubSection('overview')}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-700/20 transition-colors"
            >
              <div className="flex items-center space-x-2 pl-2">
                <Layers className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-medium text-gray-300">TIV Overview</span>
              </div>
              {expandedSubSection === 'overview' ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>
            {expandedSubSection === 'overview' && <TIVStatisticsPanel />}
          </div>

          {/* Concentration Risk Sub-section */}
          <div className="border-b border-gray-700/50">
            <button
              onClick={() => toggleSubSection('concentration')}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-700/20 transition-colors"
            >
              <div className="flex items-center space-x-2 pl-2">
                <Target className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-medium text-gray-300">Concentration Risk</span>
              </div>
              {expandedSubSection === 'concentration' ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>
            {expandedSubSection === 'concentration' && <TIVConcentrationPanel />}
          </div>

          {/* Event Impact Sub-section */}
          <div>
            <button
              onClick={() => toggleSubSection('event-impact')}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-700/20 transition-colors"
            >
              <div className="flex items-center space-x-2 pl-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-medium text-gray-300">Event Impact</span>
              </div>
              {expandedSubSection === 'event-impact' ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>
            {expandedSubSection === 'event-impact' && <EventImpactPanel />}
          </div>
        </div>
      )}
    </div>
  )
}
