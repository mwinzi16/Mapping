import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { useIndemnityStore } from '../stores/indemnityStore'
import { useEventStore } from '../stores/eventStore'
import { formatTIVShort } from '../utils/tivExcelUtils'
import { escapeHtml } from '../utils/sanitize'
import { shouldUseChoropleth, renderChoropleth, removeChoropleth } from '../utils/choroplethUtils'
import { getTIVColor, getMarkerSize, createMarkerElement, clearMarkers, getDefaultMapOptions } from '../utils/mapUtils'
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
import { Activity, AlertTriangle, Loader2 } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function IndemnityLiveCat() {
  useDocumentTitle('Live Cat Monitoring')
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const tivMarkersRef = useRef<maplibregl.Marker[]>([])
  const eventMarkersRef = useRef<maplibregl.Marker[]>([])
  const [isMapReady, setIsMapReady] = useState(false)
  const [showTIV, setShowTIV] = useState(true)
  const [showEvents, setShowEvents] = useState(true)
  const [mapStyle, setMapStyle] = useState('dark')

  const {
    datasets,
    activeDatasetId,
    aggregatedData,
    granularity,
    setGranularity,
  } = useIndemnityStore()

  const {
    earthquakes,
    hurricanes,
    wildfires,
    severeWeather,
    isLoading: eventsLoading,
    fetchAllEvents,
  } = useEventStore()

  const activeDataset = datasets.find((d) => d.id === activeDatasetId)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      ...getDefaultMapOptions(),
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

  // Fetch live events on mount
  useEffect(() => {
    fetchAllEvents()
  }, [fetchAllEvents])

  // Clear TIV markers
  const clearTIVMarkers = useCallback(() => {
    clearMarkers(tivMarkersRef.current)
  }, [])

  // Clear event markers
  const clearEventMarkers = useCallback(() => {
    clearMarkers(eventMarkersRef.current)
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

      const el = createMarkerElement(color, size, 'tiv-marker')

      const name = point.name || point.address || point.id
      const count = point.recordCount || 1

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div style="padding: 8px; max-width: 200px;">
          <div style="font-weight: bold; margin-bottom: 4px; color: #333;">${escapeHtml(name)}</div>
          <div style="font-size: 12px; color: #666;">
            <div><strong>TIV:</strong> ${escapeHtml(formatTIVShort(tiv, currency))}</div>
            ${count > 1 ? `<div><strong>Locations:</strong> ${escapeHtml(count)}</div>` : ''}
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

  // Render live event markers
  const renderEventMarkers = useCallback(() => {
    if (!mapRef.current || !isMapReady || !showEvents) {
      clearEventMarkers()
      return
    }

    clearEventMarkers()

    // Earthquakes
    earthquakes.forEach((eq) => {
      const el = document.createElement('div')
      const size = Math.max(12, Math.min(30, eq.magnitude * 4))
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.backgroundColor = '#ef4444'
      el.style.borderRadius = '50%'
      el.style.border = '2px solid #fff'
      el.style.cursor = 'pointer'
      el.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.6)'

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div style="padding: 8px;">
          <div style="font-weight: bold; color: #ef4444;">🌍 Earthquake</div>
          <div style="font-size: 12px; color: #666;">
            <div><strong>Magnitude:</strong> ${escapeHtml(eq.magnitude)}</div>
            <div><strong>Location:</strong> ${escapeHtml(eq.place)}</div>
            <div><strong>Depth:</strong> ${escapeHtml(eq.depth_km)} km</div>
          </div>
        </div>
      `)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([eq.longitude, eq.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!)

      eventMarkersRef.current.push(marker)
    })

    // Hurricanes
    hurricanes.forEach((h) => {
      const el = document.createElement('div')
      el.style.width = '24px'
      el.style.height = '24px'
      el.style.backgroundColor = '#3b82f6'
      el.style.borderRadius = '50%'
      el.style.border = '3px solid #fff'
      el.style.cursor = 'pointer'
      el.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.6)'

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div style="padding: 8px;">
          <div style="font-weight: bold; color: #3b82f6;">🌀 ${escapeHtml(h.name)}</div>
          <div style="font-size: 12px; color: #666;">
            <div><strong>Category:</strong> ${escapeHtml(h.category || 'N/A')}</div>
            <div><strong>Wind Speed:</strong> ${escapeHtml(h.max_wind_mph)} mph</div>
            <div><strong>Pressure:</strong> ${escapeHtml(h.min_pressure_mb || 'N/A')} mb</div>
          </div>
        </div>
      `)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([h.longitude, h.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!)

      eventMarkersRef.current.push(marker)
    })

    // Wildfires
    wildfires.slice(0, 100).forEach((fire) => {
      const el = document.createElement('div')
      el.style.width = '10px'
      el.style.height = '10px'
      el.style.backgroundColor = '#f97316'
      el.style.borderRadius = '50%'
      el.style.cursor = 'pointer'
      el.style.boxShadow = '0 0 6px rgba(249, 115, 22, 0.6)'

      const popup = new maplibregl.Popup({ offset: 10 }).setHTML(`
        <div style="padding: 8px;">
          <div style="font-weight: bold; color: #f97316;">🔥 Wildfire</div>
          <div style="font-size: 12px; color: #666;">
            <div><strong>Confidence:</strong> ${escapeHtml(fire.confidence || 'N/A')}%</div>
            <div><strong>FRP:</strong> ${escapeHtml(fire.frp || 'N/A')} MW</div>
          </div>
        </div>
      `)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([fire.longitude, fire.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!)

      eventMarkersRef.current.push(marker)
    })

    // Severe Weather
    severeWeather.forEach((sw) => {
      const el = document.createElement('div')
      el.style.width = '16px'
      el.style.height = '16px'
      el.style.backgroundColor = '#eab308'
      el.style.borderRadius = '4px'
      el.style.border = '2px solid #fff'
      el.style.cursor = 'pointer'

      const popup = new maplibregl.Popup({ offset: 10 }).setHTML(`
        <div style="padding: 8px;">
          <div style="font-weight: bold; color: #eab308;">⚠️ ${escapeHtml(sw.event_type)}</div>
          <div style="font-size: 12px; color: #666;">
            <div><strong>Severity:</strong> ${escapeHtml(sw.severity || 'N/A')}</div>
          </div>
        </div>
      `)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([sw.longitude, sw.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!)

      eventMarkersRef.current.push(marker)
    })
  }, [earthquakes, hurricanes, wildfires, severeWeather, isMapReady, showEvents, clearEventMarkers])

  // Update visualization when data changes
  useEffect(() => {
    renderTIVVisualization()
  }, [renderTIVVisualization])

  useEffect(() => {
    renderEventMarkers()
  }, [renderEventMarkers])

  const totalEvents = earthquakes.length + hurricanes.length + wildfires.length + severeWeather.length

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/80">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Indemnity - Live Cat</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Overlay TIV exposure with live catastrophe events
          </p>
        </div>

        {/* Live Events Status */}
        <div className="px-4 py-3 border-b border-gray-700 bg-green-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {eventsLoading ? (
                <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
              ) : (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
              <span className="text-sm text-green-400">Live Events</span>
            </div>
            <span className="text-sm text-white font-medium">{totalEvents}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
            <div className="text-center">
              <div className="text-red-400 font-medium">{earthquakes.length}</div>
              <div className="text-gray-500">EQ</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-medium">{hurricanes.length}</div>
              <div className="text-gray-500">TC</div>
            </div>
            <div className="text-center">
              <div className="text-orange-400 font-medium">{wildfires.length}</div>
              <div className="text-gray-500">Fire</div>
            </div>
            <div className="text-center">
              <div className="text-yellow-400 font-medium">{severeWeather.length}</div>
              <div className="text-gray-500">SW</div>
            </div>
          </div>
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
                className="rounded border-gray-600 bg-gray-700 text-green-500 focus:ring-green-500"
              />
              <span className="text-sm text-gray-300">Live Events</span>
              <span className="text-xs text-green-400">({totalEvents})</span>
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
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-gray-300">Earthquake</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-300">Hurricane</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-xs text-gray-300">Wildfire</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              <span className="text-xs text-gray-300">Severe Weather</span>
            </div>
          </div>
        </div>

        {/* No TIV Data Overlay */}
        {!activeDataset && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-yellow-700 z-10">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-300">Upload TIV data to see exposure overlay</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
