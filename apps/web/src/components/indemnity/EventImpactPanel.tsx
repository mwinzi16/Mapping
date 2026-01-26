import { useState } from 'react'
import { useIndemnityStore } from '../../stores/indemnityStore'
import { AlertTriangle, Play, Loader2, Trash2, Plus } from 'lucide-react'
import { formatTIVShort } from '../../utils/tivExcelUtils'
import { EventPath } from '../../types/indemnity'

export default function EventImpactPanel() {
  const [showAddForm, setShowAddForm] = useState(false)
  const [bufferRadius, setBufferRadius] = useState('100')
  
  const {
    datasets,
    activeDatasetId,
    selectedEventPaths,
    impactAnalyses,
    isAnalyzingImpact,
    addEventPath,
    removeEventPath,
    clearEventPaths,
    analyzeImpact,
    statistics,
  } = useIndemnityStore()

  const activeDataset = datasets.find(d => d.id === activeDatasetId)
  const hasData = activeDataset !== null

  // For demo purposes, create a sample event path
  const addSampleHurricanePath = () => {
    const samplePath: EventPath = {
      eventId: `event-${Date.now()}`,
      eventName: 'Sample Hurricane Track',
      eventType: 'hurricane',
      pathPoints: [
        { latitude: 25.0, longitude: -80.0 },
        { latitude: 26.0, longitude: -81.0 },
        { latitude: 27.5, longitude: -82.0 },
        { latitude: 29.0, longitude: -83.5 },
        { latitude: 30.5, longitude: -85.0 },
      ],
      bufferRadiusKm: parseInt(bufferRadius) || 100,
    }
    addEventPath(samplePath)
    setShowAddForm(false)
  }

  const addSampleEarthquakePath = () => {
    const samplePath: EventPath = {
      eventId: `event-${Date.now()}`,
      eventName: 'Sample Earthquake Epicenter',
      eventType: 'earthquake',
      pathPoints: [
        { latitude: 34.0522, longitude: -118.2437, intensity: 6.5 },
      ],
      bufferRadiusKm: parseInt(bufferRadius) || 50,
    }
    addEventPath(samplePath)
    setShowAddForm(false)
  }

  if (!hasData) {
    return (
      <div className="px-4 pb-4">
        <p className="text-sm text-gray-500 text-center py-4">
          Upload TIV data to analyze event impact
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Info */}
      <div className="flex items-start space-x-2 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300">
          Define event paths (hurricane tracks, earthquake epicenters) to calculate 
          TIV exposure within the affected area.
        </p>
      </div>

      {/* Add Event Path */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Event Paths</span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-gray-700 rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showAddForm && (
        <div className="p-3 bg-gray-700/50 rounded-lg space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Buffer Radius (km)</label>
            <input
              type="number"
              value={bufferRadius}
              onChange={(e) => setBufferRadius(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
              placeholder="100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Radius around event path to consider for TIV exposure
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={addSampleHurricanePath}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
            >
              Add Hurricane Track
            </button>
            <button
              onClick={addSampleEarthquakePath}
              className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs"
            >
              Add Earthquake
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Note: In production, event paths would come from real event data or be drawn on the map.
          </p>
        </div>
      )}

      {/* Event Path List */}
      {selectedEventPaths.length > 0 && (
        <div className="space-y-2">
          {selectedEventPaths.map((path) => (
            <div
              key={path.eventId}
              className="p-3 bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium text-sm">{path.eventName}</span>
                <button
                  onClick={() => removeEventPath(path.eventId)}
                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-xs text-gray-400">
                <span className="capitalize">{path.eventType}</span>
                <span className="mx-2">•</span>
                <span>{path.pathPoints.length} point{path.pathPoints.length !== 1 ? 's' : ''}</span>
                <span className="mx-2">•</span>
                <span>{path.bufferRadiusKm}km buffer</span>
              </div>
            </div>
          ))}

          {/* Analyze Button */}
          <button
            onClick={analyzeImpact}
            disabled={isAnalyzingImpact}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isAnalyzingImpact ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Analyze TIV Impact</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Impact Results */}
      {impactAnalyses.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400 font-medium">Impact Analysis Results</div>
          {impactAnalyses.map((analysis) => (
            <div
              key={analysis.eventPath.eventId}
              className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-white font-medium text-sm">{analysis.eventPath.eventName}</span>
                <span className="text-red-400 font-bold">
                  {analysis.percentageOfPortfolio.toFixed(1)}%
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-400">
                  Affected TIV: <span className="text-red-400 font-medium">
                    {formatTIVShort(analysis.totalAffectedTIV, statistics?.currency || 'USD')}
                  </span>
                </div>
                <div className="text-gray-400">
                  Locations: <span className="text-white font-medium">
                    {analysis.affectedCount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* By Category */}
              {Object.keys(analysis.byCategory).length > 0 && (
                <div className="pt-2 border-t border-red-700/30">
                  <div className="text-xs text-gray-500 mb-1">By Category:</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(analysis.byCategory).map(([cat, data]) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 bg-red-900/50 rounded text-xs text-red-300"
                      >
                        {cat}: {formatTIVShort(data.tiv, statistics?.currency || 'USD')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Clear Results */}
          <button
            onClick={clearEventPaths}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
          >
            Clear All Events
          </button>
        </div>
      )}

      {selectedEventPaths.length === 0 && impactAnalyses.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-4">
          Add event paths to analyze TIV exposure in affected areas
        </p>
      )}
    </div>
  )
}
