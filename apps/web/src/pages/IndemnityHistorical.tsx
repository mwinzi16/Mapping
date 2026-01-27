import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useIndemnityStore } from '../stores/indemnityStore'
import { formatTIVShort } from '../utils/tivExcelUtils'
import { shouldUseChoropleth, renderChoropleth, removeChoropleth } from '../utils/choroplethUtils'
import { 
  fetchHistoricalEarthquakes, 
  fetchHistoricalHurricanes,
  type HistoricalEarthquake,
  type HistoricalHurricane,
  type LoadMode,
} from '../services/indemnityApi'
import TIVDataPanel from '../components/indemnity/TIVDataPanel'
import IndemnityFilterSection from '../components/indemnity/IndemnityFilterSection'
import IndemnityStatisticsSection from '../components/indemnity/IndemnityStatisticsSection'
import MapStyleSelector, {
  type MapStyleOption,
  generateRasterStyle, 
  generateNightLightsStyle,
  generate3DTerrainStyle,
} from '../components/parametric/MapStyleSelector'
import GranularitySelector from '../components/indemnity/GranularitySelector'
import { 
  BarChart3, 
  AlertTriangle, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
  Database,
  Star,
  RefreshCw,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface HistoricalEvent {
  id: string
  name: string
  type: 'earthquake' | 'hurricane'
  magnitude?: number
  category?: number
  lat: number
  lon: number
  date: string
  damage: number
  significance_score: number
}

// Get category color
function getCategoryColor(category: number | null): string {
  if (category === null) return '#6b7280' // gray for TD/TS
  if (category === 1) return '#22c55e' // green
  if (category === 2) return '#eab308' // yellow
  if (category === 3) return '#f97316' // orange
  if (category === 4) return '#ef4444' // red
  return '#9333ea' // purple for cat 5
}

export default function IndemnityHistorical() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const tivMarkersRef = useRef<maplibregl.Marker[]>([])
  const eventMarkersRef = useRef<maplibregl.Marker[]>([])
  const [isMapReady, setIsMapReady] = useState(false)
  const [mapStyle, setMapStyle] = useState('dark')
  const [showTIV, setShowTIV] = useState(true)
  const [showEvents, setShowEvents] = useState(true)
  const [isEventPanelExpanded, setIsEventPanelExpanded] = useState(true)
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [eventType, setEventType] = useState<'all' | 'earthquake' | 'hurricane'>('all')

  // NEW: State for loading historical events from API
  const [loadMode, setLoadMode] = useState<LoadMode>('significant')
  const [topEventsLimit, setTopEventsLimit] = useState<number>(30)
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [earthquakes, setEarthquakes] = useState<HistoricalEarthquake[]>([])
  const [hurricanes, setHurricanes] = useState<HistoricalHurricane[]>([])

  const {
    datasets,
    activeDatasetId,
    aggregatedData,
    granularity,
    setGranularity,
  } = useIndemnityStore()

  const activeDataset = datasets.find((d) => d.id === activeDatasetId)

  // Load historical events from API
  const loadHistoricalEvents = useCallback(async () => {
    setIsLoadingEvents(true)
    setLoadError(null)
    
    try {
      const effectiveLimit = loadMode === 'significant' ? topEventsLimit : 1000
      const [eqData, tcData] = await Promise.all([
        fetchHistoricalEarthquakes({ mode: loadMode, limit: effectiveLimit }),
        fetchHistoricalHurricanes({ mode: loadMode, limit: effectiveLimit }),
      ])
      
      setEarthquakes(eqData)
      setHurricanes(tcData)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load events')
      console.error('Failed to load historical events:', err)
    } finally {
      setIsLoadingEvents(false)
    }
  }, [loadMode, topEventsLimit])

  // Load events on mount and when loadMode/topEventsLimit changes
  useEffect(() => {
    loadHistoricalEvents()
  }, [loadHistoricalEvents])

  // Combine historical events for the list
  const allHistoricalEvents: HistoricalEvent[] = [
    ...earthquakes.map(eq => ({ 
      id: eq.id,
      name: eq.name,
      type: 'earthquake' as const,
      magnitude: eq.magnitude,
      lat: eq.lat,
      lon: eq.lon,
      date: eq.date,
      damage: eq.damage_usd || 0,
      significance_score: eq.significance_score,
    })),
    ...hurricanes.map(h => ({ 
      id: h.id,
      name: h.name, 
      type: 'hurricane' as const,
      category: h.max_category,
      lat: h.track.length > 0 ? h.track[Math.floor(h.track.length / 2)].lat : 0,
      lon: h.track.length > 0 ? h.track[Math.floor(h.track.length / 2)].lon : 0,
      date: h.track.length > 0 ? h.track[0].time.split('T')[0] : `${h.season}-01-01`,
      damage: h.damage_usd || 0,
      significance_score: h.significance_score,
    })),
  ].sort((a, b) => b.significance_score - a.significance_score)

  // Filter events
  const filteredEvents = allHistoricalEvents.filter(event => {
    if (eventType !== 'all' && event.type !== eventType) return false
    if (searchQuery && !event.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-95, 38],
      zoom: 4,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      setIsMapReady(true)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Clear TIV markers
  const clearTIVMarkers = useCallback(() => {
    tivMarkersRef.current.forEach((marker) => marker.remove())
    tivMarkersRef.current = []
  }, [])

  // Clear event markers
  const clearEventMarkers = useCallback(() => {
    eventMarkersRef.current.forEach((marker) => marker.remove())
    eventMarkersRef.current = []
  }, [])

  // Handle map style changes
  const handleStyleChange = useCallback((style: MapStyleOption) => {
    if (!mapRef.current) return

    setMapStyle(style.id)
    setIsMapReady(false)

    // Clear all visualizations before style change
    clearTIVMarkers()
    clearEventMarkers()
    removeChoropleth(mapRef.current)

    // Remove existing hurricane track layers
    const layerIds = ['hurricane-tracks', 'hurricane-track-points']
    layerIds.forEach((id) => {
      if (mapRef.current!.getLayer(id)) {
        mapRef.current!.removeLayer(id)
      }
    })
    if (mapRef.current.getSource('hurricane-tracks')) {
      mapRef.current.removeSource('hurricane-tracks')
    }

    mapRef.current.once('style.load', () => {
      setIsMapReady(true)
    })

    // Determine the style value
    let styleValue: maplibregl.StyleSpecification | string = style.url

    if (style.id === 'satellite' || style.id === 'osm') {
      styleValue = generateRasterStyle(style.url, style.id === 'satellite')
    } else if (style.id === 'night-lights') {
      styleValue = generateNightLightsStyle()
    } else if (style.id === 'terrain') {
      styleValue = generate3DTerrainStyle()
    }

    mapRef.current.setStyle(styleValue)
  }, [clearTIVMarkers, clearEventMarkers])

  // Get color based on TIV value
  const getTIVColor = (tiv: number, maxTIV: number): string => {
    const ratio = tiv / maxTIV
    if (ratio > 0.8) return '#a855f7'
    if (ratio > 0.6) return '#c084fc'
    if (ratio > 0.4) return '#d8b4fe'
    if (ratio > 0.2) return '#e9d5ff'
    return '#f3e8ff'
  }

  // Get marker size based on TIV
  const getMarkerSize = (tiv: number, maxTIV: number): number => {
    const ratio = tiv / maxTIV
    return Math.max(8, Math.min(24, 8 + ratio * 16))
  }

  // Render TIV visualization (markers for granular, choropleth for aggregated)
  const renderTIVVisualization = useCallback(async () => {
    if (!mapRef.current || !isMapReady || !showTIV) {
      clearTIVMarkers()
      if (mapRef.current) removeChoropleth(mapRef.current)
      return
    }

    clearTIVMarkers()
    
    const currency = activeDataset?.records[0]?.currency || 'USD'

    // Use choropleth for state/country granularity
    if (shouldUseChoropleth(granularity)) {
      await renderChoropleth(
        mapRef.current,
        aggregatedData,
        granularity,
        formatTIVShort,
        currency
      )
      return
    }

    // Remove any existing choropleth when switching to markers
    removeChoropleth(mapRef.current)

    const dataToRender = granularity === 'location' && activeDataset
      ? activeDataset.records
      : aggregatedData

    if (dataToRender.length === 0) return

    // Filter to only items with coordinates for marker rendering
    const dataWithCoords = dataToRender.filter((d: any) => {
      // For location granularity, check record coordinates
      if (granularity === 'location') {
        return d.latitude != null && d.longitude != null
      }
      // For aggregated data, check hasCoordinates flag or explicit lat/lon
      return d.hasCoordinates || (d.latitude != null && d.longitude != null)
    })

    if (dataWithCoords.length === 0) return

    const maxTIV = Math.max(...dataWithCoords.map((d: any) => d.totalTIV || d.tiv))

    dataWithCoords.forEach((point: any) => {
      const tiv = point.totalTIV || point.tiv
      const size = getMarkerSize(tiv, maxTIV)
      const color = getTIVColor(tiv, maxTIV)

      const el = document.createElement('div')
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.backgroundColor = color
      el.style.borderRadius = '50%'
      el.style.border = '2px solid rgba(168, 85, 247, 0.8)'
      el.style.cursor = 'pointer'
      el.style.opacity = '0.8'

      const name = point.name || point.address || point.id
      const count = point.recordCount || 1

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div style="padding: 8px; max-width: 200px;">
          <div style="font-weight: bold; margin-bottom: 4px; color: #333;">${name}</div>
          <div style="font-size: 12px; color: #666;">
            <div><strong>TIV:</strong> ${formatTIVShort(tiv, currency)}</div>
            ${count > 1 ? `<div><strong>Locations:</strong> ${count}</div>` : ''}
          </div>
        </div>
      `)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!)

      tivMarkersRef.current.push(marker)
    })
  }, [aggregatedData, activeDataset, granularity, isMapReady, showTIV, clearTIVMarkers])

  // Render historical event markers and hurricane tracks
  const renderEventMarkers = useCallback(() => {
    if (!mapRef.current || !isMapReady || !showEvents) {
      clearEventMarkers()
      // Remove track layers
      if (mapRef.current?.getLayer('hurricane-tracks')) {
        mapRef.current.removeLayer('hurricane-tracks')
      }
      if (mapRef.current?.getLayer('hurricane-track-points')) {
        mapRef.current.removeLayer('hurricane-track-points')
      }
      if (mapRef.current?.getSource('hurricane-tracks')) {
        mapRef.current.removeSource('hurricane-tracks')
      }
      return
    }

    clearEventMarkers()

    // Remove existing track layers
    if (mapRef.current.getLayer('hurricane-tracks')) {
      mapRef.current.removeLayer('hurricane-tracks')
    }
    if (mapRef.current.getLayer('hurricane-track-points')) {
      mapRef.current.removeLayer('hurricane-track-points')
    }
    if (mapRef.current.getSource('hurricane-tracks')) {
      mapRef.current.removeSource('hurricane-tracks')
    }

    const selectedHurricanes = hurricanes.filter(h => selectedEvents.includes(h.id))
    const selectedEarthquakes = earthquakes.filter(eq => selectedEvents.includes(eq.id))

    // Render earthquake markers
    selectedEarthquakes.forEach((eq) => {
      const el = document.createElement('div')
      const size = Math.max(20, eq.magnitude * 5)
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.backgroundColor = '#ef4444'
      el.style.borderRadius = '50%'
      el.style.border = '3px solid #fff'
      el.style.cursor = 'pointer'
      el.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.8)'

      const formattedDamage = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(eq.damage_usd || 0)

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div style="padding: 12px; max-width: 280px;">
          <div style="font-weight: bold; font-size: 16px; color: #ef4444; margin-bottom: 8px;">
            🌍 ${eq.name}
          </div>
          <div style="font-size: 13px; color: #333;">
            <div style="margin-bottom: 4px;"><strong>Date:</strong> ${new Date(eq.date).toLocaleDateString()}</div>
            <div style="margin-bottom: 4px;"><strong>Magnitude:</strong> M${eq.magnitude.toFixed(1)}</div>
            ${eq.depth_km ? `<div style="margin-bottom: 4px;"><strong>Depth:</strong> ${eq.depth_km.toFixed(0)} km</div>` : ''}
            <div><strong>Est. Damage:</strong> ${formattedDamage}</div>
          </div>
        </div>
      `)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([eq.lon, eq.lat])
        .setPopup(popup)
        .addTo(mapRef.current!)

      eventMarkersRef.current.push(marker)
    })

    // Render hurricane tracks with intensity-based segment coloring
    if (selectedHurricanes.length > 0) {
      const segmentFeatures: GeoJSON.Feature[] = []
      const pointFeatures: GeoJSON.Feature[] = []

      selectedHurricanes.forEach((hurricane) => {
        // Create individual line segments between track points, colored by category
        for (let i = 0; i < hurricane.track.length - 1; i++) {
          const pt = hurricane.track[i]
          const nextPt = hurricane.track[i + 1]
          
          segmentFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [pt.lon, pt.lat],
                [nextPt.lon, nextPt.lat],
              ],
            },
            properties: {
              name: hurricane.name,
              category: pt.category ?? 0,
              wind_mph: pt.wind_mph,
              color: getCategoryColor(pt.category ?? null),
            },
          })
        }

        // Create point features for each track point with detailed info
        hurricane.track.forEach((pt, idx) => {
          pointFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [pt.lon, pt.lat],
            },
            properties: {
              hurricaneName: hurricane.name,
              time: pt.time,
              wind_mph: pt.wind_mph,
              pressure_mb: pt.pressure_mb,
              category: pt.category,
              status: pt.status,
              color: getCategoryColor(pt.category ?? null),
              isLandfall: idx === hurricane.track.findIndex(p => p.category === hurricane.max_category),
            },
          })
        })
      })

      // Add source
      mapRef.current.addSource('hurricane-tracks', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [...segmentFeatures, ...pointFeatures],
        },
      })

      // Add track line layer with category-based coloring
      mapRef.current.addLayer({
        id: 'hurricane-tracks',
        type: 'line',
        source: 'hurricane-tracks',
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.9,
        },
      })

      // Add track point layer
      mapRef.current.addLayer({
        id: 'hurricane-track-points',
        type: 'circle',
        source: 'hurricane-tracks',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': [
            'case',
            ['get', 'isLandfall'], 12,
            8
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Add click handler for track points
      mapRef.current.on('click', 'hurricane-track-points', (e) => {
        if (!e.features || e.features.length === 0) return
        const props = e.features[0].properties
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates

        const time = new Date(props.time).toLocaleString()
        
        new maplibregl.Popup({ offset: 15 })
          .setLngLat(coords as [number, number])
          .setHTML(`
            <div style="padding: 12px; max-width: 280px;">
              <div style="font-weight: bold; font-size: 14px; color: ${props.color}; margin-bottom: 8px;">
                🌀 ${props.hurricaneName}
              </div>
              <div style="font-size: 12px; color: #333;">
                <div style="margin-bottom: 3px;"><strong>Time:</strong> ${time}</div>
                <div style="margin-bottom: 3px;"><strong>Status:</strong> ${props.status}</div>
                <div style="margin-bottom: 3px;"><strong>Category:</strong> ${props.category !== null ? props.category : 'N/A'}</div>
                <div style="margin-bottom: 3px;"><strong>Wind:</strong> ${props.wind_mph} mph</div>
                <div><strong>Pressure:</strong> ${props.pressure_mb} mb</div>
              </div>
            </div>
          `)
          .addTo(mapRef.current!)
      })

      // Change cursor on hover
      mapRef.current.on('mouseenter', 'hurricane-track-points', () => {
        if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'pointer'
      })
      mapRef.current.on('mouseleave', 'hurricane-track-points', () => {
        if (mapRef.current) mapRef.current.getCanvas().style.cursor = ''
      })
    }

    // Fit bounds to all selected events
    if (selectedEvents.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      
      // Add earthquake points
      selectedEarthquakes.forEach((eq) => {
        bounds.extend([eq.lon, eq.lat])
      })
      
      // Add all hurricane track points
      selectedHurricanes.forEach((h) => {
        h.track.forEach((pt) => {
          bounds.extend([pt.lon, pt.lat])
        })
      })

      // Also include TIV data if available
      if (activeDataset && activeDataset.records.length > 0) {
        activeDataset.records.forEach((record) => {
          bounds.extend([record.longitude, record.latitude])
        })
      }
      
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 8 })
    }
  }, [selectedEvents, isMapReady, showEvents, clearEventMarkers, activeDataset, earthquakes, hurricanes])

  // Toggle event selection
  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    )
  }

  // Select all filtered events
  const selectAllFiltered = () => {
    setSelectedEvents(filteredEvents.map(e => e.id))
  }

  // Clear all selected events
  const clearSelectedEvents = () => {
    setSelectedEvents([])
  }

  // Update visualization when data changes
  useEffect(() => {
    renderTIVVisualization()
  }, [renderTIVVisualization])

  useEffect(() => {
    renderEventMarkers()
  }, [renderEventMarkers])

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/80">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Indemnity - Historical</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Analyze TIV exposure against historical events
          </p>
        </div>

        {/* Historical Events Panel */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => setIsEventPanelExpanded(!isEventPanelExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-gray-200">Historical Events</span>
              <span className="text-xs text-blue-400">({selectedEvents.length} selected)</span>
            </div>
            {isEventPanelExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {isEventPanelExpanded && (
            <div className="px-4 pb-4 space-y-3">
              {/* Load Mode Toggle */}
              <div className="bg-gray-700/50 p-2 rounded-lg">
                <div className="text-xs text-gray-400 mb-2 font-medium">Display Events</div>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {[10, 20, 30, null].map((limit) => (
                    <button
                      key={limit ?? 'all'}
                      onClick={() => {
                        if (limit === null) {
                          setLoadMode('all')
                        } else {
                          setLoadMode('significant')
                          setTopEventsLimit(limit)
                        }
                      }}
                      disabled={isLoadingEvents}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50 ${
                        (loadMode === 'significant' && topEventsLimit === limit) || (loadMode === 'all' && limit === null)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      {limit ? (
                        <>
                          <Star className="w-3 h-3" />
                          {limit}
                        </>
                      ) : (
                        <>
                          <Database className="w-3 h-3" />
                          All
                        </>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {loadMode === 'significant' 
                      ? `Top ${topEventsLimit} significant events`
                      : `All events loaded`}
                    : {earthquakes.length} EQ + {hurricanes.length} TC
                  </span>
                  <button
                    onClick={loadHistoricalEvents}
                    disabled={isLoadingEvents}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-600 text-gray-300 hover:bg-gray-500 rounded transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
                {loadError && (
                  <div className="mt-2 text-xs text-red-400 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{loadError}</span>
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events..."
                  className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-500"
                />
              </div>

              {/* Filter by type */}
              <div className="flex space-x-1">
                {(['all', 'earthquake', 'hurricane'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setEventType(type)}
                    className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                      eventType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {type === 'all' ? 'All' : type === 'earthquake' ? '🌍 EQ' : '🌀 TC'}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={selectAllFiltered}
                  className="flex-1 px-2 py-1.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelectedEvents}
                  className="flex-1 px-2 py-1.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Loading State */}
              {isLoadingEvents && (
                <div className="flex items-center justify-center py-4 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Loading events...</span>
                </div>
              )}

              {/* Event List */}
              {!isLoadingEvents && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => toggleEventSelection(event.id)}
                    className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors ${
                      selectedEvents.includes(event.id)
                        ? event.type === 'earthquake'
                          ? 'bg-red-900/40 border border-red-700'
                          : 'bg-blue-900/40 border border-blue-700'
                        : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                    }`}
                  >
                    <div>
                      <div className="text-sm text-white font-medium">
                        {event.type === 'earthquake' ? '🌍' : '🌀'} {event.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(event.date).toLocaleDateString()} •
                        {event.type === 'earthquake' ? ` M${event.magnitude?.toFixed(1)}` : ` Cat ${event.category}`}
                      </div>
                    </div>
                    {selectedEvents.includes(event.id) && (
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
              )}
            </div>
          )}
        </div>

        {/* Layer Toggles */}
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="text-xs text-gray-400 mb-2 font-medium">Map Layers</div>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTIV}
                onChange={(e) => setShowTIV(e.target.checked)}
                className="rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-300">TIV Locations</span>
              <span className="text-xs text-purple-400">({activeDataset?.records.length || 0})</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showEvents}
                onChange={(e) => setShowEvents(e.target.checked)}
                className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">Historical Events</span>
              <span className="text-xs text-blue-400">({selectedEvents.length})</span>
            </label>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <TIVDataPanel />
          <IndemnityFilterSection />
          <IndemnityStatisticsSection />
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full" />

        {/* Map Controls */}
        <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
          {/* Map Style Selector */}
          <MapStyleSelector
            currentStyleId={mapStyle}
            onStyleChange={handleStyleChange}
          />

          {/* Granularity Selector */}
          <GranularitySelector
            currentGranularity={granularity}
            onGranularityChange={setGranularity}
          />
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur-sm p-3 rounded-lg border border-gray-700 z-10">
          <div className="text-xs text-gray-400 font-medium mb-2">Legend</div>
          <div className="space-y-1.5">
            {/* TIV Legend - changes based on granularity */}
            {shouldUseChoropleth(granularity) ? (
              <div className="space-y-1">
                <div className="text-xs text-gray-300 mb-1">TIV Concentration</div>
                <div className="flex items-center space-x-1">
                  <div className="h-3 w-24 rounded" style={{
                    background: 'linear-gradient(to right, #f3e8ff, #e9d5ff, #d8b4fe, #c084fc, #a855f7, #9333ea, #7e22ce)'
                  }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 border border-purple-300" />
                <span className="text-xs text-gray-300">TIV Location</span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
              <span className="text-xs text-gray-300">Historical Earthquake</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-blue-500" />
              <span className="text-xs text-gray-300">Hurricane Track</span>
            </div>
            <div className="flex items-center space-x-2 mt-1 pt-1 border-t border-gray-700">
              <span className="text-xs text-gray-500">Track Points by Category:</span>
            </div>
            <div className="flex items-center space-x-1 flex-wrap gap-y-1">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#808080' }} />
                <span className="text-xs text-gray-400">TD/TS</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00ff00' }} />
                <span className="text-xs text-gray-400">1</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ffff00' }} />
                <span className="text-xs text-gray-400">2</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ff8000' }} />
                <span className="text-xs text-gray-400">3</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ff0000' }} />
                <span className="text-xs text-gray-400">4</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ff00ff' }} />
                <span className="text-xs text-gray-400">5</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Events Summary */}
        {selectedEvents.length > 0 && activeDataset && (
          <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur-sm p-3 rounded-lg border border-gray-700 z-10 max-w-xs">
            <div className="text-xs text-gray-400 font-medium mb-2">Impact Analysis</div>
            <div className="text-sm text-white">
              Analyzing {activeDataset.records.length} TIV locations against{' '}
              {selectedEvents.length} historical event{selectedEvents.length !== 1 ? 's' : ''}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Use the Event Impact panel in Statistics to calculate exposure
            </p>
          </div>
        )}

        {/* No TIV Data Overlay */}
        {!activeDataset && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-yellow-700 z-10">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-300">Upload TIV data to analyze exposure</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
