import { useState, useCallback } from 'react'
import {
  Target,
  Upload,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  DollarSign,
  MapPin,
} from 'lucide-react'
import { useTriggerZoneStore, TriggerZone } from '../stores/triggerZoneStore'
import { useEventStore } from '../stores/eventStore'
import PayoutConfigPanel from './parametric/PayoutConfigPanel'

export default function TriggerZonePanel() {
  const {
    zones,
    selectedZoneId,
    selectedEvent,
    calculations,
    addZones,
    updateZone,
    removeZone,
    clearAllZones,
    selectZone,
    setSelectedEvent,
  } = useTriggerZoneStore()
  
  const { earthquakes, hurricanes, wildfires, severeWeather } = useEventStore()
  
  const [isExpanded, setIsExpanded] = useState(true)
  const [showEventPicker, setShowEventPicker] = useState(false)
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
  
  // Handle file upload for GeoJSON zones
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const geojson = JSON.parse(evt.target?.result as string)
        const newZones: TriggerZone[] = []
        
        const features = geojson.features || [geojson]
        features.forEach((feature: any, index: number) => {
          if (feature.geometry?.type === 'Polygon') {
            const coords = feature.geometry.coordinates[0]
            const lngs = coords.map((c: number[]) => c[0])
            const lats = coords.map((c: number[]) => c[1])
            
            newZones.push({
              id: crypto.randomUUID(),
              name: feature.properties?.name || `Zone ${zones.length + index + 1}`,
              north: Math.max(...lats),
              south: Math.min(...lats),
              east: Math.max(...lngs),
              west: Math.min(...lngs),
              color: feature.properties?.color || `hsl(${(zones.length + index) * 60}, 70%, 50%)`,
              trigger: feature.properties?.trigger,
              payout: feature.properties?.payout,
            })
          }
        })
        
        if (newZones.length > 0) {
          addZones(newZones)
        }
      } catch (err) {
        console.error('Failed to parse GeoJSON:', err)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [zones.length, addZones])
  
  // Download zones as GeoJSON (consistent with analysis upload/download format)
  const handleDownloadZones = useCallback(() => {
    if (zones.length === 0) return
    
    const geojson = {
      type: 'FeatureCollection',
      features: zones.map((zone) => ({
        type: 'Feature',
        properties: {
          name: zone.name,
          color: zone.color,
          trigger: zone.trigger,
          payout: zone.payout,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [zone.west, zone.north],
            [zone.east, zone.north],
            [zone.east, zone.south],
            [zone.west, zone.south],
            [zone.west, zone.north],
          ]],
        },
      })),
    }
    
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'trigger-zones.geojson'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [zones])
  
  // All events combined for picker
  const allEvents = [
    ...earthquakes.map(e => ({ ...e, _type: 'earthquake' as const })),
    ...hurricanes.map(h => ({ ...h, _type: 'hurricane' as const })),
    ...wildfires.map(w => ({ ...w, _type: 'wildfire' as const })),
    ...severeWeather.map(s => ({ ...s, _type: 'severe' as const })),
  ]
  
  const getEventLabel = (event: any) => {
    if ('magnitude' in event) {
      return `M${event.magnitude.toFixed(1)} - ${event.place}`
    }
    if ('storm_id' in event) {
      return `${event.name} (Cat ${event.category || 'TS'})`
    }
    if ('brightness' in event) {
      return `Fire - ${event.satellite || 'Unknown'}`
    }
    if ('event_type' in event) {
      return `${event.event_type} - ${event.location || 'Unknown'}`
    }
    return 'Unknown Event'
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  }
  
  const totalPayout = calculations
    .filter(c => c.triggered && c.payoutAmount)
    .reduce((sum, c) => sum + (c.payoutAmount || 0), 0)
  
  const triggeredCount = calculations.filter(c => c.triggered).length
  
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <Target className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white">Trigger Zone Analysis</span>
          <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
            {zones.length} zone{zones.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      
      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Event Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Selected Event</label>
            <div className="relative">
              <button
                onClick={() => setShowEventPicker(!showEventPicker)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-left hover:border-gray-500 transition-colors"
              >
                {selectedEvent ? (
                  <div className="flex items-center justify-between">
                    <span className="text-white">{getEventLabel(selectedEvent)}</span>
                    <MapPin className="w-4 h-4 text-blue-400" />
                  </div>
                ) : (
                  <span className="text-gray-400">Select an event to analyze...</span>
                )}
              </button>
              
              {showEventPicker && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowEventPicker(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
                    {allEvents.length === 0 ? (
                      <div className="p-4 text-gray-400 text-center">
                        No events available
                      </div>
                    ) : (
                      allEvents.map((event, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedEvent(event)
                            setShowEventPicker(false)
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-600 text-white text-sm"
                        >
                          {getEventLabel(event)}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Zone Upload/Download */}
          <div className="flex items-center space-x-2">
            <label className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-700 border border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-650 hover:border-gray-500 transition-colors">
              <Upload className="w-4 h-4 mr-2 text-gray-400" />
              <span className="text-sm text-gray-300">Upload GeoJSON Zones</span>
              <input
                type="file"
                accept=".json,.geojson"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {zones.length > 0 && (
              <>
                <button
                  onClick={handleDownloadZones}
                  className="px-3 py-2 bg-green-600/20 border border-green-600/50 rounded-lg text-green-400 hover:bg-green-600/30 transition-colors"
                  title="Download zones as GeoJSON"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={clearAllZones}
                  className="px-3 py-2 bg-red-600/20 border border-red-600/50 rounded-lg text-red-400 hover:bg-red-600/30 transition-colors"
                  title="Clear all zones"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          
          {/* Results Summary */}
          {selectedEvent && zones.length > 0 && (
            <div className="p-3 bg-gray-750 rounded-lg border border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Analysis Results</span>
                {triggeredCount > 0 ? (
                  <span className="flex items-center text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {triggeredCount} Triggered
                  </span>
                ) : (
                  <span className="flex items-center text-gray-400 text-sm">
                    <XCircle className="w-4 h-4 mr-1" />
                    No Triggers
                  </span>
                )}
              </div>
              {totalPayout > 0 && (
                <div className="flex items-center text-green-400">
                  <DollarSign className="w-5 h-5 mr-1" />
                  <span className="text-lg font-semibold">{formatCurrency(totalPayout)}</span>
                  <span className="text-sm text-gray-400 ml-2">Total Payout</span>
                </div>
              )}
            </div>
          )}
          
          {/* Zone List */}
          {zones.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-gray-400">Trigger Zones</div>
              {zones.map((zone) => {
                const calc = calculations.find(c => c.zoneId === zone.id)
                const isEditing = editingZoneId === zone.id
                
                return (
                  <div
                    key={zone.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      calc?.triggered
                        ? 'bg-green-900/30 border-green-600'
                        : 'bg-gray-750 border-gray-600'
                    } ${selectedZoneId === zone.id ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => selectZone(zone.id === selectedZoneId ? null : zone.id)}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: zone.color || '#3b82f6' }}
                        />
                        <span className="font-medium text-white">{zone.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {calc?.triggered ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : calc ? (
                          <XCircle className="w-4 h-4 text-gray-500" />
                        ) : null}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingZoneId(isEditing ? null : zone.id)
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isEditing ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeZone(zone.id)
                          }}
                          className="text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Calculation result */}
                    {calc && (
                      <div className="mt-2 pt-2 border-t border-gray-600 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">
                            {calc.eventInZone ? 'Event in zone' : 'Event outside zone'}
                          </span>
                          {calc.payoutAmount && (
                            <span className="text-green-400 font-medium">
                              {formatCurrency(calc.payoutAmount)}
                            </span>
                          )}
                        </div>
                        {calc.payoutTier && (
                          <div className="text-xs text-gray-500">
                            Tier: {calc.payoutTier}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Expanded zone editor */}
                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-gray-600 space-y-3">
                        {/* Zone name */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Name</label>
                          <input
                            type="text"
                            value={zone.name}
                            onChange={(e) => updateZone(zone.id, { name: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                          />
                        </div>
                        
                        {/* Trigger criteria */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Trigger Criteria</label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-xs text-gray-500">Min Magnitude</span>
                              <input
                                type="number"
                                value={zone.trigger?.min_magnitude ?? ''}
                                onChange={(e) => updateZone(zone.id, {
                                  trigger: {
                                    ...zone.trigger,
                                    min_magnitude: e.target.value ? Number(e.target.value) : undefined,
                                  },
                                })}
                                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                step={0.1}
                                min={0}
                                max={10}
                              />
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">Min Category</span>
                              <input
                                type="number"
                                value={zone.trigger?.min_category ?? ''}
                                onChange={(e) => updateZone(zone.id, {
                                  trigger: {
                                    ...zone.trigger,
                                    min_category: e.target.value ? Number(e.target.value) : undefined,
                                  },
                                })}
                                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                step={1}
                                min={0}
                                max={5}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Payout config */}
                        <PayoutConfigPanel
                          payout={zone.payout}
                          onChange={(payout) => updateZone(zone.id, { payout })}
                          perilType="earthquake"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          
          {/* Empty state */}
          {zones.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Upload GeoJSON zones to analyze</p>
              <p className="text-xs text-gray-500 mt-1">
                Or draw zones directly on the map
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
