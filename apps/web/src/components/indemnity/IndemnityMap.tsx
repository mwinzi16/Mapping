import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useIndemnityStore } from '../../stores/indemnityStore'
import { AggregatedTIV, TIVRecord } from '../../types/indemnity'
import { formatTIVShort } from '../../utils/tivExcelUtils'

export default function IndemnityMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [isMapReady, setIsMapReady] = useState(false)

  const {
    datasets,
    activeDatasetId,
    aggregatedData,
    granularity,
    filters,
    selectedEventPaths,
  } = useIndemnityStore()

  const activeDataset = datasets.find((d) => d.id === activeDatasetId)

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

  // Clear existing markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []
  }, [])

  // Get color based on TIV value
  const getTIVColor = (tiv: number, maxTIV: number): string => {
    const ratio = tiv / maxTIV
    if (ratio > 0.8) return '#dc2626' // red-600
    if (ratio > 0.6) return '#ea580c' // orange-600
    if (ratio > 0.4) return '#ca8a04' // yellow-600
    if (ratio > 0.2) return '#65a30d' // lime-600
    return '#22c55e' // green-500
  }

  // Get marker size based on TIV
  const getMarkerSize = (tiv: number, maxTIV: number): number => {
    const ratio = tiv / maxTIV
    return Math.max(12, Math.min(40, 12 + ratio * 28))
  }

  // Render aggregated data markers
  const renderAggregatedMarkers = useCallback(() => {
    if (!mapRef.current || !isMapReady) return

    clearMarkers()

    const dataToRender = aggregatedData.length > 0 ? aggregatedData : []
    if (dataToRender.length === 0) return

    const maxTIV = Math.max(...dataToRender.map((d) => d.totalTIV))
    const currency = activeDataset?.records[0]?.currency || 'USD'

    dataToRender.forEach((point: AggregatedTIV) => {
      const size = getMarkerSize(point.totalTIV, maxTIV)
      const color = getTIVColor(point.totalTIV, maxTIV)

      // Create marker element
      const el = document.createElement('div')
      el.className = 'tiv-marker'
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.backgroundColor = color
      el.style.borderRadius = '50%'
      el.style.border = '2px solid rgba(255, 255, 255, 0.5)'
      el.style.cursor = 'pointer'
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)'

      // Add count label for aggregated points
      if (point.recordCount > 1) {
        el.innerHTML = `<span style="color: white; font-size: 10px; font-weight: bold;">${point.recordCount}</span>`
      }

      // Create popup
      const averageTIV = point.totalTIV / point.recordCount
      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div style="padding: 8px; max-width: 250px;">
          <div style="font-weight: bold; margin-bottom: 4px; color: #333;">${point.name}</div>
          <div style="font-size: 12px; color: #666;">
            <div><strong>TIV:</strong> ${formatTIVShort(point.totalTIV, currency)}</div>
            <div><strong>Locations:</strong> ${point.recordCount.toLocaleString()}</div>
            ${point.recordCount > 1 ? `<div><strong>Avg TIV:</strong> ${formatTIVShort(averageTIV, currency)}</div>` : ''}
          </div>
        </div>
      `)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!)

      markersRef.current.push(marker)
    })

    // Fit bounds to show all markers
    if (dataToRender.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      dataToRender.forEach((point) => {
        bounds.extend([point.longitude, point.latitude])
      })
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 10 })
    }
  }, [aggregatedData, activeDataset, isMapReady, clearMarkers])

  // Render individual location markers (when granularity is 'location')
  const renderLocationMarkers = useCallback(() => {
    if (!mapRef.current || !isMapReady || !activeDataset) return
    if (granularity !== 'location') return

    clearMarkers()

    let records = activeDataset.records

    // Apply filters
    if (filters.minTIV !== undefined) {
      records = records.filter((r) => r.tiv >= filters.minTIV!)
    }
    if (filters.maxTIV !== undefined) {
      records = records.filter((r) => r.tiv <= filters.maxTIV!)
    }
    if (filters.categories && filters.categories.length > 0) {
      records = records.filter((r) => !r.category || filters.categories!.includes(r.category))
    }
    if (filters.states && filters.states.length > 0) {
      records = records.filter((r) => !r.state || filters.states!.includes(r.state))
    }

    if (records.length === 0) return

    const maxTIV = Math.max(...records.map((r) => r.tiv))
    const currency = records[0]?.currency || 'USD'

    records.forEach((record: TIVRecord) => {
      const size = getMarkerSize(record.tiv, maxTIV)
      const color = getTIVColor(record.tiv, maxTIV)

      const el = document.createElement('div')
      el.className = 'tiv-marker'
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.backgroundColor = color
      el.style.borderRadius = '50%'
      el.style.border = '2px solid rgba(255, 255, 255, 0.5)'
      el.style.cursor = 'pointer'
      el.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)'

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div style="padding: 8px; max-width: 250px;">
          <div style="font-weight: bold; margin-bottom: 4px; color: #333;">
            ${record.address || record.id}
          </div>
          <div style="font-size: 12px; color: #666;">
            <div><strong>TIV:</strong> ${formatTIVShort(record.tiv, currency)}</div>
            ${record.city ? `<div><strong>City:</strong> ${record.city}</div>` : ''}
            ${record.state ? `<div><strong>State:</strong> ${record.state}</div>` : ''}
            ${record.category ? `<div><strong>Category:</strong> ${record.category}</div>` : ''}
            ${record.constructionType ? `<div><strong>Construction:</strong> ${record.constructionType}</div>` : ''}
            ${record.yearBuilt ? `<div><strong>Year Built:</strong> ${record.yearBuilt}</div>` : ''}
          </div>
        </div>
      `)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([record.longitude, record.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!)

      markersRef.current.push(marker)
    })

    // Fit bounds
    const bounds = new maplibregl.LngLatBounds()
    records.forEach((record) => {
      bounds.extend([record.longitude, record.latitude])
    })
    mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 10 })
  }, [activeDataset, granularity, filters, isMapReady, clearMarkers])

  // Render event paths
  const renderEventPaths = useCallback(() => {
    if (!mapRef.current || !isMapReady) return

    // Remove existing path layers
    const layerIds = ['event-path-line', 'event-path-buffer', 'event-path-points']
    layerIds.forEach((id) => {
      if (mapRef.current!.getLayer(id)) {
        mapRef.current!.removeLayer(id)
      }
    })
    if (mapRef.current.getSource('event-path')) {
      mapRef.current.removeSource('event-path')
    }

    if (selectedEventPaths.length === 0) return

    // Create GeoJSON for event paths
    const features: GeoJSON.Feature[] = []

    selectedEventPaths.forEach((path) => {
      if (path.pathPoints.length === 1) {
        // Point (earthquake epicenter)
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [path.pathPoints[0].longitude, path.pathPoints[0].latitude],
          },
          properties: {
            name: path.eventName,
            type: path.eventType,
            radius: path.bufferRadiusKm,
          },
        })
      } else {
        // Line (hurricane track)
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: path.pathPoints.map((p) => [p.longitude, p.latitude]),
          },
          properties: {
            name: path.eventName,
            type: path.eventType,
            radius: path.bufferRadiusKm,
          },
        })
      }
    })

    mapRef.current.addSource('event-path', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features,
      },
    })

    // Add line layer
    mapRef.current.addLayer({
      id: 'event-path-line',
      type: 'line',
      source: 'event-path',
      filter: ['==', '$type', 'LineString'],
      paint: {
        'line-color': '#ef4444',
        'line-width': 3,
        'line-dasharray': [2, 2],
      },
    })

    // Add point layer
    mapRef.current.addLayer({
      id: 'event-path-points',
      type: 'circle',
      source: 'event-path',
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-radius': 10,
        'circle-color': '#ef4444',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    })
  }, [selectedEventPaths, isMapReady])

  // Update markers when data changes
  useEffect(() => {
    if (granularity === 'location') {
      renderLocationMarkers()
    } else {
      renderAggregatedMarkers()
    }
  }, [granularity, renderAggregatedMarkers, renderLocationMarkers])

  // Update event paths
  useEffect(() => {
    renderEventPaths()
  }, [renderEventPaths])

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Legend */}
      {activeDataset && (
        <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur-sm p-3 rounded-lg border border-gray-700 z-10">
          <div className="text-xs text-gray-400 font-medium mb-2">TIV Legend</div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-600" />
              <span className="text-xs text-gray-300">High (&gt;80%)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-orange-600" />
              <span className="text-xs text-gray-300">Medium-High (60-80%)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-600" />
              <span className="text-xs text-gray-300">Medium (40-60%)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-lime-600" />
              <span className="text-xs text-gray-300">Low-Medium (20-40%)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-gray-300">Low (&lt;20%)</span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 mt-2">
            Granularity: {granularity}
          </div>
        </div>
      )}

      {/* No Data Overlay */}
      {!activeDataset && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
          <div className="text-center">
            <p className="text-gray-400">Upload TIV data to visualize locations</p>
          </div>
        </div>
      )}
    </div>
  )
}
