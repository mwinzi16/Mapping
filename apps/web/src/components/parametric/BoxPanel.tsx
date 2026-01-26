import { useState, useRef } from 'react'
import { Plus, Trash2, MapPin, Edit2, Check, X, ChevronDown, ChevronUp, Download, Upload, FileSpreadsheet } from 'lucide-react'
import { useParametricStore } from '../../stores/parametricStore'
import { BoundingBox, TriggerCriteria } from '../../types/parametric'
import { downloadTriggerZoneTemplate, parseExcelFile, exportBoxesToExcel } from '../../utils/excelUtils'

export default function BoxPanel() {
  const { boxes, addBox, updateBox, removeBox, selectedBoxId, selectBox, calculateStatistics } = useParametricStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // New box form state
  const [newBox, setNewBox] = useState({
    name: '',
    north: '',
    south: '',
    east: '',
    west: '',
    minCategory: '',
    minWindKnots: '',
    maxPressureMb: '',
  })
  
  const handleAddBox = () => {
    // Build trigger criteria if any are specified
    const trigger: TriggerCriteria | undefined = 
      (newBox.minCategory || newBox.minWindKnots || newBox.maxPressureMb)
        ? {
            min_category: newBox.minCategory ? parseInt(newBox.minCategory) : undefined,
            min_wind_knots: newBox.minWindKnots ? parseInt(newBox.minWindKnots) : undefined,
            max_pressure_mb: newBox.maxPressureMb ? parseInt(newBox.maxPressureMb) : undefined,
          }
        : undefined
    
    const box: BoundingBox = {
      id: `box-${Date.now()}`,
      name: newBox.name || `Zone ${boxes.length + 1}`,
      north: parseFloat(newBox.north),
      south: parseFloat(newBox.south),
      east: parseFloat(newBox.east),
      west: parseFloat(newBox.west),
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      trigger,
    }
    
    if (isNaN(box.north) || isNaN(box.south) || isNaN(box.east) || isNaN(box.west)) {
      alert('Please enter valid coordinates')
      return
    }
    
    addBox(box)
    setShowAddForm(false)
    setNewBox({ name: '', north: '', south: '', east: '', west: '', minCategory: '', minWindKnots: '', maxPressureMb: '' })
  }
  
  const handleCalculateStats = async (boxId: string) => {
    await calculateStatistics(boxId)
  }
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    setIsUploading(true)
    setUploadError(null)
    
    try {
      const newBoxes = await parseExcelFile(file)
      newBoxes.forEach((box) => addBox(box))
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
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Trigger Zones
        </h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => downloadTriggerZoneTemplate()}
            className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded-lg transition-colors"
            title="Download Excel template"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-purple-400 hover:text-purple-300 hover:bg-gray-700 rounded-lg transition-colors"
            title="Upload Excel file"
            disabled={isUploading}
          >
            <Upload className="w-4 h-4" />
          </button>
          {boxes.length > 0 && (
            <button
              onClick={() => exportBoxesToExcel(boxes)}
              className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-gray-700 rounded-lg transition-colors"
              title="Export zones to Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-lg transition-colors"
            title="Add zone manually"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Hidden file input for Excel upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />
      
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
      
      {/* Upload success indicator */}
      {isUploading && (
        <div className="mb-4 p-3 bg-blue-900/50 border border-blue-700 rounded-lg text-blue-300 text-sm">
          Processing Excel file...
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
                placeholder="e.g., 30.0"
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
                placeholder="e.g., 20.0"
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
                placeholder="e.g., -70.0"
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
                placeholder="e.g., -90.0"
                value={newBox.west}
                onChange={(e) => setNewBox({ ...newBox, west: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
              />
            </div>
          </div>
          
          {/* Trigger Criteria Section */}
          <div className="border-t border-gray-600 pt-3 mt-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">Trigger Criteria (Optional)</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-400">Min Category</label>
                <select
                  value={newBox.minCategory}
                  onChange={(e) => setNewBox({ ...newBox, minCategory: e.target.value })}
                  className="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                >
                  <option value="">Any</option>
                  <option value="1">Cat 1+</option>
                  <option value="2">Cat 2+</option>
                  <option value="3">Cat 3+</option>
                  <option value="4">Cat 4+</option>
                  <option value="5">Cat 5</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Min Wind (kt)</label>
                <input
                  type="number"
                  placeholder="e.g., 100"
                  value={newBox.minWindKnots}
                  onChange={(e) => setNewBox({ ...newBox, minWindKnots: e.target.value })}
                  className="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Max Press (mb)</label>
                <input
                  type="number"
                  placeholder="e.g., 950"
                  value={newBox.maxPressureMb}
                  onChange={(e) => setNewBox({ ...newBox, maxPressureMb: e.target.value })}
                  className="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleAddBox}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors text-sm"
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
            <BoxItem
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
  )
}

interface BoxItemProps {
  box: BoundingBox
  isSelected: boolean
  isEditing: boolean
  onSelect: () => void
  onEdit: () => void
  onCancelEdit: () => void
  onUpdate: (updates: Partial<BoundingBox>) => void
  onDelete: () => void
  onCalculateStats: () => void
}

function BoxItem({
  box,
  isSelected,
  isEditing,
  onSelect,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onCalculateStats,
}: BoxItemProps) {
  const [editName, setEditName] = useState(box.name)
  const [editTrigger, setEditTrigger] = useState({
    minCategory: box.trigger?.min_category?.toString() || '',
    minWindKnots: box.trigger?.min_wind_knots?.toString() || '',
    maxPressureMb: box.trigger?.max_pressure_mb?.toString() || '',
  })
  const [showTriggerEdit, setShowTriggerEdit] = useState(false)
  
  const handleSave = () => {
    const trigger: TriggerCriteria | undefined = 
      (editTrigger.minCategory || editTrigger.minWindKnots || editTrigger.maxPressureMb)
        ? {
            min_category: editTrigger.minCategory ? parseInt(editTrigger.minCategory) : undefined,
            min_wind_knots: editTrigger.minWindKnots ? parseInt(editTrigger.minWindKnots) : undefined,
            max_pressure_mb: editTrigger.maxPressureMb ? parseInt(editTrigger.maxPressureMb) : undefined,
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
          {showTriggerEdit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span>Trigger Criteria</span>
        </button>
        
        {showTriggerEdit && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div>
              <label className="text-xs text-gray-400">Min Cat</label>
              <select
                value={editTrigger.minCategory}
                onChange={(e) => setEditTrigger({ ...editTrigger, minCategory: e.target.value })}
                className="w-full px-1 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs"
              >
                <option value="">Any</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="5">5</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Min Wind</label>
              <input
                type="number"
                value={editTrigger.minWindKnots}
                onChange={(e) => setEditTrigger({ ...editTrigger, minWindKnots: e.target.value })}
                className="w-full px-1 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs"
                placeholder="kt"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Max Press</label>
              <input
                type="number"
                value={editTrigger.maxPressureMb}
                onChange={(e) => setEditTrigger({ ...editTrigger, maxPressureMb: e.target.value })}
                className="w-full px-1 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs"
                placeholder="mb"
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
        box.trigger.min_category !== undefined && `Cat ${box.trigger.min_category}+`,
        box.trigger.min_wind_knots !== undefined && `≥${box.trigger.min_wind_knots}kt`,
        box.trigger.max_pressure_mb !== undefined && `≤${box.trigger.max_pressure_mb}mb`,
      ].filter(Boolean).join(', ')
    : null
  
  return (
    <div
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-900/50 border border-blue-500'
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
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
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
        <div className="mt-2 px-2 py-1 bg-amber-900/30 border border-amber-700/50 rounded text-xs text-amber-300">
          <span className="font-medium">Trigger: </span>
          {triggerDisplay}
        </div>
      )}
      
      <button
        onClick={(e) => { e.stopPropagation(); onCalculateStats() }}
        className="mt-2 w-full px-3 py-1 bg-blue-600/50 hover:bg-blue-600 text-white text-xs rounded transition-colors"
      >
        Calculate Statistics
      </button>
    </div>
  )
}
