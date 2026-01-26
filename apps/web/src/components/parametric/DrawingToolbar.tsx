import { useState } from 'react'
import { PenTool, Square, Upload, X, MousePointer, Trash2, Info } from 'lucide-react'

export type DrawingMode = 'select' | 'draw' | 'none'

interface DrawingToolbarProps {
  isDrawing: boolean
  onStartDrawing: () => void
  onStopDrawing: () => void
  onUploadZones: (file: File) => void
  onClearAllZones?: () => void
  zoneCount: number
  className?: string
  perilType: 'earthquake' | 'hurricane'
}

export default function DrawingToolbar({
  isDrawing,
  onStartDrawing,
  onStopDrawing,
  onUploadZones,
  onClearAllZones,
  zoneCount,
  className = '',
  perilType,
}: DrawingToolbarProps) {
  const [showHelp, setShowHelp] = useState(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUploadZones(file)
      e.target.value = '' // Reset input
    }
  }

  return (
    <div className={`bg-gray-800/95 rounded-lg shadow-xl border border-gray-700 ${className}`}>
      {/* Main toolbar */}
      <div className="flex items-center p-2 space-x-1">
        {/* Select mode button */}
        <button
          onClick={onStopDrawing}
          className={`p-2 rounded-lg transition-colors ${
            !isDrawing
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
          title="Select mode (click zones)"
        >
          <MousePointer className="w-5 h-5" />
        </button>

        {/* Draw mode button */}
        <button
          onClick={onStartDrawing}
          className={`p-2 rounded-lg transition-colors ${
            isDrawing
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
          title="Draw trigger zone"
        >
          <Square className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Upload button */}
        <label
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white cursor-pointer transition-colors"
          title="Upload GeoJSON zones"
        >
          <Upload className="w-5 h-5" />
          <input
            type="file"
            accept=".json,.geojson"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Clear all button */}
        {onClearAllZones && zoneCount > 0 && (
          <button
            onClick={onClearAllZones}
            className="p-2 rounded-lg text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
            title="Clear all zones"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Help button */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          className={`p-2 rounded-lg transition-colors ${
            showHelp
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
          title="Show help"
        >
          <Info className="w-5 h-5" />
        </button>

        {/* Zone count badge */}
        <div className="pl-2 text-sm text-gray-400">
          <span className="text-white font-medium">{zoneCount}</span> zone{zoneCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Drawing mode indicator */}
      {isDrawing && (
        <div className="px-3 py-2 bg-green-600/20 border-t border-gray-700 flex items-center justify-between">
          <div className="flex items-center text-green-400 text-sm">
            <PenTool className="w-4 h-4 mr-2" />
            <span>Drawing mode active - Click and drag to create zone</span>
          </div>
          <button
            onClick={onStopDrawing}
            className="text-green-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Help panel */}
      {showHelp && (
        <div className="px-3 py-3 border-t border-gray-700 text-sm">
          <div className="text-gray-300 font-medium mb-2">Drawing Trigger Zones</div>
          <ul className="text-gray-400 space-y-1.5">
            <li className="flex items-start">
              <Square className="w-4 h-4 mr-2 mt-0.5 text-green-400" />
              Click the draw button or hold <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs mx-1">Shift</kbd> + drag on map
            </li>
            <li className="flex items-start">
              <MousePointer className="w-4 h-4 mr-2 mt-0.5 text-blue-400" />
              Click a zone to select and edit its properties
            </li>
            <li className="flex items-start">
              <Upload className="w-4 h-4 mr-2 mt-0.5 text-gray-400" />
              Upload GeoJSON file with polygon features
            </li>
          </ul>
          {perilType === 'earthquake' && (
            <div className="mt-3 pt-2 border-t border-gray-700">
              <div className="text-yellow-400 text-xs">
                Earthquake zones can have magnitude and depth triggers
              </div>
            </div>
          )}
          {perilType === 'hurricane' && (
            <div className="mt-3 pt-2 border-t border-gray-700">
              <div className="text-blue-400 text-xs">
                Hurricane zones can have category and wind speed triggers
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
