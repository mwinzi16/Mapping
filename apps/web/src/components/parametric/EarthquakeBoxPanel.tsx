import { useState, useRef } from 'react'
import {
  Plus,
  Trash2,
  MapPin,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  Layers,
  FileSpreadsheet,
} from 'lucide-react'
import { useEarthquakeParametricStore } from '../../stores/earthquakeParametricStore'
import { EarthquakeBoundingBox, EarthquakeTriggerCriteria } from '../../types/parametric'
import { downloadEarthquakeZoneTemplate, parseEarthquakeExcelFile, exportEarthquakeBoxesToExcel } from '../../utils/earthquakeExcelUtils'

export default function EarthquakeBoxPanel() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const {
    boxes,
    addBox,
    addBoxes,
    updateBox,
    removeBox,
    selectedBoxId,
    selectBox,
    calculateStatistics,
    clearAllBoxes,
  } = useEarthquakeParametricStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // New box form state
  const [newBox, setNewBox] = useState({
    name: '',
    north: '',
    south: '',
    east: '',
    west: '',
    minMagnitude: '',
    maxDepthKm: '',
    minDepthKm: '',
  })

  const handleAddBox = () => {
    // Build trigger criteria if any are specified
    const trigger: EarthquakeTriggerCriteria | undefined =
      newBox.minMagnitude || newBox.maxDepthKm || newBox.minDepthKm
        ? {
            min_magnitude: newBox.minMagnitude
              ? parseFloat(newBox.minMagnitude)
              : undefined,
            max_depth_km: newBox.maxDepthKm
              ? parseFloat(newBox.maxDepthKm)
              : undefined,
            min_depth_km: newBox.minDepthKm
              ? parseFloat(newBox.minDepthKm)
              : undefined,
          }
        : undefined

    const box: EarthquakeBoundingBox = {
      id: `eq-box-${Date.now()}`,
      name: newBox.name || `Zone ${boxes.length + 1}`,
      north: parseFloat(newBox.north),
      south: parseFloat(newBox.south),
      east: parseFloat(newBox.east),
      west: parseFloat(newBox.west),
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      trigger,
    }

    if (
      isNaN(box.north) ||
      isNaN(box.south) ||
      isNaN(box.east) ||
      isNaN(box.west)
    ) {
      alert('Please enter valid coordinates')
      return
    }

    addBox(box)
    setShowAddForm(false)
    setNewBox({
      name: '',
      north: '',
      south: '',
      east: '',
      west: '',
      minMagnitude: '',
      maxDepthKm: '',
      minDepthKm: '',
    })
  }

  const handleCalculateStats = async (boxId: string) => {
    await calculateStatistics(boxId)
  }

  // Upload zones from Excel file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsUploading(true)
    setUploadError(null)
    
    try {
      const newBoxes = await parseEarthquakeExcelFile(file)
      addBoxes(newBoxes)
      setUploadError(null)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to parse file')
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="border-t border-gray-700">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold text-gray-200">Trigger Zones</span>
        </div>
        <div className="flex items-center space-x-2">
          {boxes.length > 0 && (
            <span className="text-xs text-gray-400">{boxes.length} zone{boxes.length !== 1 ? 's' : ''}</span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Toolbar */}
          <div className="flex items-center justify-end mb-3 space-x-1">
            {/* Download Excel template */}
            <button
              onClick={() => downloadEarthquakeZoneTemplate()}
              className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded-lg transition-colors"
              title="Download Excel template"
            >
              <Download className="w-4 h-4" />
            </button>
            
            {/* Upload Excel file */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-purple-400 hover:text-purple-300 hover:bg-gray-700 rounded-lg transition-colors"
              title="Upload Excel file"
              disabled={isUploading}
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {/* Export to Excel */}
            {boxes.length > 0 && (
              <button
                onClick={() => exportEarthquakeBoxesToExcel(boxes)}
                className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-gray-700 rounded-lg transition-colors"
                title="Export zones to Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
            )}
            
            {/* Clear all */}
            {boxes.length > 0 && (
              <button
                onClick={clearAllBoxes}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-lg transition-colors"
                title="Clear all zones"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            
            {/* Add manually */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-lg transition-colors"
              title="Add zone manually"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Upload error message */}
          {uploadError && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {uploadError}
              <button
                onClick={() => setUploadError(null)}
                className="ml-2 text-red-400 hover:text-red-300"
              >
                ×
              </button>
            </div>
          )}

          {/* Upload progress indicator */}
          {isUploading && (
            <div className="mb-4 p-3 bg-blue-900/50 border border-blue-700 rounded-lg text-blue-300 text-sm">
              Uploading and parsing Excel file...
            </div>
          )}

      {/* Add Box Form */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-gray-700/50 rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Zone Name"
            value={newBox.name}
            onChange={(e) => setNewBox({ ...newBox, name: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">North (Lat)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 40.0"
                value={newBox.north}
                onChange={(e) => setNewBox({ ...newBox, north: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">South (Lat)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 30.0"
                value={newBox.south}
                onChange={(e) => setNewBox({ ...newBox, south: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">East (Lon)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 140.0"
                value={newBox.east}
                onChange={(e) => setNewBox({ ...newBox, east: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">West (Lon)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 130.0"
                value={newBox.west}
                onChange={(e) => setNewBox({ ...newBox, west: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
              />
            </div>
          </div>

          {/* Trigger Criteria Section */}
          <div className="border-t border-gray-600 pt-3 mt-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">
              Trigger Criteria (Optional)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-400">Min Magnitude</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 6.0"
                  value={newBox.minMagnitude}
                  onChange={(e) =>
                    setNewBox({ ...newBox, minMagnitude: e.target.value })
                  }
                  className="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Max Depth (km)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="e.g., 70"
                  value={newBox.maxDepthKm}
                  onChange={(e) =>
                    setNewBox({ ...newBox, maxDepthKm: e.target.value })
                  }
                  className="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Min Depth (km)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="e.g., 0"
                  value={newBox.minDepthKm}
                  onChange={(e) =>
                    setNewBox({ ...newBox, minDepthKm: e.target.value })
                  }
                  className="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Shallow earthquakes (&lt;70km) are typically more damaging
            </p>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleAddBox}
              className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors text-sm"
            >
              Add Zone
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Box List */}
      {boxes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No trigger zones defined</p>
          <p className="text-xs mt-1">
            Draw on the map (Shift+Drag) or add coordinates above
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {boxes.map((box) => (
            <EarthquakeBoxItem
              key={box.id}
              box={box}
              isSelected={box.id === selectedBoxId}
              isEditing={box.id === editingId}
              onSelect={() => selectBox(box.id)}
              onEdit={() => setEditingId(box.id)}
              onCancelEdit={() => setEditingId(null)}
              onUpdate={(updates) => {
                updateBox(box.id, updates)
                setEditingId(null)
              }}
              onDelete={() => removeBox(box.id)}
              onCalculateStats={() => handleCalculateStats(box.id)}
            />
          ))}
        </div>
      )}
        </div>
      )}
    </div>
  )
}

interface EarthquakeBoxItemProps {
  box: EarthquakeBoundingBox
  isSelected: boolean
  isEditing: boolean
  onSelect: () => void
  onEdit: () => void
  onCancelEdit: () => void
  onUpdate: (updates: Partial<EarthquakeBoundingBox>) => void
  onDelete: () => void
  onCalculateStats: () => void
}

function EarthquakeBoxItem({
  box,
  isSelected,
  isEditing,
  onSelect,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onCalculateStats,
}: EarthquakeBoxItemProps) {
  const [editName, setEditName] = useState(box.name)
  const [editTrigger, setEditTrigger] = useState({
    minMagnitude: box.trigger?.min_magnitude?.toString() || '',
    maxDepthKm: box.trigger?.max_depth_km?.toString() || '',
    minDepthKm: box.trigger?.min_depth_km?.toString() || '',
  })
  const [showTriggerEdit, setShowTriggerEdit] = useState(false)

  const handleSave = () => {
    const trigger: EarthquakeTriggerCriteria | undefined =
      editTrigger.minMagnitude || editTrigger.maxDepthKm || editTrigger.minDepthKm
        ? {
            min_magnitude: editTrigger.minMagnitude
              ? parseFloat(editTrigger.minMagnitude)
              : undefined,
            max_depth_km: editTrigger.maxDepthKm
              ? parseFloat(editTrigger.maxDepthKm)
              : undefined,
            min_depth_km: editTrigger.minDepthKm
              ? parseFloat(editTrigger.minDepthKm)
              : undefined,
          }
        : undefined

    onUpdate({ name: editName, trigger })
  }

  if (isEditing) {
    return (
      <div className="p-3 bg-gray-700 rounded-lg space-y-2">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
          autoFocus
        />

        {/* Trigger Criteria Editor */}
        <button
          onClick={() => setShowTriggerEdit(!showTriggerEdit)}
          className="flex items-center space-x-1 text-xs text-gray-400 hover:text-gray-300"
        >
          {showTriggerEdit ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          <span>Trigger Criteria</span>
        </button>

        {showTriggerEdit && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div>
              <label className="text-xs text-gray-400">Min Mag</label>
              <input
                type="number"
                step="0.1"
                value={editTrigger.minMagnitude}
                onChange={(e) =>
                  setEditTrigger({ ...editTrigger, minMagnitude: e.target.value })
                }
                className="w-full px-1 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs"
                placeholder="M"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Max Depth</label>
              <input
                type="number"
                value={editTrigger.maxDepthKm}
                onChange={(e) =>
                  setEditTrigger({ ...editTrigger, maxDepthKm: e.target.value })
                }
                className="w-full px-1 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs"
                placeholder="km"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Min Depth</label>
              <input
                type="number"
                value={editTrigger.minDepthKm}
                onChange={(e) =>
                  setEditTrigger({ ...editTrigger, minDepthKm: e.target.value })
                }
                className="w-full px-1 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs"
                placeholder="km"
              />
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
          >
            <Check className="w-4 h-4" />
            <span>Save</span>
          </button>
          <button
            onClick={onCancelEdit}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    )
  }

  // Format trigger criteria for display
  const triggerDisplay = box.trigger
    ? [
        box.trigger.min_magnitude !== undefined &&
          `M${box.trigger.min_magnitude}+`,
        box.trigger.max_depth_km !== undefined &&
          `≤${box.trigger.max_depth_km}km`,
        box.trigger.min_depth_km !== undefined &&
          `≥${box.trigger.min_depth_km}km`,
      ]
        .filter(Boolean)
        .join(', ')
    : null

  return (
    <div
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-yellow-900/50 border border-yellow-500'
          : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: box.color }}
          />
          <span className="text-white font-medium text-sm">{box.name}</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-400 grid grid-cols-2 gap-1">
        <span>N: {box.north.toFixed(2)}°</span>
        <span>E: {box.east.toFixed(2)}°</span>
        <span>S: {box.south.toFixed(2)}°</span>
        <span>W: {box.west.toFixed(2)}°</span>
      </div>

      {/* Display trigger criteria if set */}
      {triggerDisplay && (
        <div className="mt-2 px-2 py-1 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-300">
          <span className="font-medium">Trigger: </span>
          {triggerDisplay}
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation()
          onCalculateStats()
        }}
        className="mt-2 w-full px-3 py-1 bg-yellow-600/50 hover:bg-yellow-600 text-white text-xs rounded transition-colors"
      >
        Calculate Statistics
      </button>
    </div>
  )
}
