import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import MapGL, {
  Source,
  Layer,
  NavigationControl,
  ScaleControl,
  Popup,
} from 'react-map-gl/maplibre'
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEarthquakeParametricStore } from '../../stores/earthquakeParametricStore'
import { EarthquakeBoundingBox } from '../../types/parametric'
import { Mountain, Target, AlertTriangle, TrendingUp } from 'lucide-react'
import MapStyleSelector, {
  MAP_STYLES,
  MapStyleOption,
  MapStyleValue,
  generateRasterStyle,
  generateNightLightsStyle,
  generate3DTerrainStyle,
} from './MapStyleSelector'
import DrawingToolbar from './DrawingToolbar'

interface HoveredBox {
  id: string
  name: string
  lngLat: { lng: number; lat: number }
}

// Box hover content component
function BoxHoverContent({ boxId }: { boxId: string }) {
  const { boxes, statistics } = useEarthquakeParametricStore()
  const box = boxes.find(b => b.id === boxId)
  const stats = statistics[boxId]

  if (!box) return null

  return (
    <div className="bg-gray-800 text-white p-3 rounded-lg min-w-[200px] shadow-xl">
      <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-gray-700">
        <Mountain className="w-4 h-4 text-yellow-400" />
        <span className="font-semibold text-yellow-400">{box.name}</span>
      </div>
      
      {/* Trigger Criteria */}
      {box.trigger && (
        <div className="mb-2 pb-2 border-b border-gray-700">
          <div className="text-xs text-gray-400 mb-1 flex items-center">
            <Target className="w-3 h-3 mr-1" />
            Trigger Criteria
          </div>
          <div className="text-sm space-y-0.5">
            {box.trigger.min_magnitude !== undefined && (
              <div>Min Magnitude: <span className="text-yellow-400">M{box.trigger.min_magnitude}</span></div>
            )}
            {box.trigger.max_depth_km !== undefined && (
              <div>Max Depth: <span className="text-cyan-400">{box.trigger.max_depth_km} km</span></div>
            )}
            {box.trigger.min_depth_km !== undefined && (
              <div>Min Depth: <span className="text-cyan-400">{box.trigger.min_depth_km} km</span></div>
            )}
          </div>
        </div>
      )}
      
      {/* Statistics */}
      {stats ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              Trigger Probability
            </span>
            <span className="font-bold text-green-400">
              {(stats.trigger_probability * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 flex items-center">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Total Events
            </span>
            <span className="font-medium">{stats.total_earthquakes}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Qualifying</span>
            <span className="font-medium text-yellow-400">{stats.qualifying_earthquakes}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Max Magnitude</span>
            <span className="font-medium text-red-400">M{stats.max_magnitude.toFixed(1)}</span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-500 text-center py-2">
          Click "Analyze All" to see statistics
        </div>
      )}
      
      {/* Coordinates */}
      <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-500">
        {box.south.toFixed(2)}°N to {box.north.toFixed(2)}°N<br />
        {box.west.toFixed(2)}°E to {box.east.toFixed(2)}°E
      </div>
    </div>
  )
}

export default function EarthquakeMap() {
  const mapRef = useRef<MapRef>(null)
  const { 
    earthquakes, 
    boxes, 
    addBox,
    addBoxes,
    clearAllBoxes,
    selectedBoxId, 
    selectBox,
    statistics,
    stressTestConfig,
    getExtendedBoxes,
  } = useEarthquakeParametricStore()

  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 2,
  })

  // Map style state
  const [currentStyleId, setCurrentStyleId] = useState('dark')

  // Generate the map style based on selection
  const mapStyle: MapStyleValue = useMemo(() => {
    const style = MAP_STYLES.find((s) => s.id === currentStyleId) || MAP_STYLES[0]
    
    if (style.id === 'satellite') {
      return generateRasterStyle(style.url, false)
    } else if (style.id === 'night-lights') {
      return generateNightLightsStyle()
    } else if (style.id === 'terrain') {
      return generate3DTerrainStyle()
    } else if (style.id === 'osm') {
      return generateRasterStyle(style.url, false)
    }
    return style.url
  }, [currentStyleId])

  const handleStyleChange = useCallback((style: MapStyleOption) => {
    setCurrentStyleId(style.id)
    
    // For 3D terrain, we need to set pitch for proper 3D view
    if (style.terrain) {
      setViewState(prev => ({ ...prev, pitch: 45 }))
    } else {
      setViewState(prev => ({ ...prev, pitch: 0 }))
    }
  }, [])

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ lng: number; lat: number } | null>(
    null
  )
  const [drawCurrent, setDrawCurrent] = useState<{
    lng: number
    lat: number
  } | null>(null)

  // Hover state
  const [hoveredBox, setHoveredBox] = useState<HoveredBox | null>(null)

  // Handle file upload for GeoJSON zones
  const handleUploadZones = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string)
        const newBoxes: EarthquakeBoundingBox[] = []
        
        const features = geojson.features || [geojson]
        features.forEach((feature: any, index: number) => {
          if (feature.geometry?.type === 'Polygon') {
            const coords = feature.geometry.coordinates[0]
            const lngs = coords.map((c: number[]) => c[0])
            const lats = coords.map((c: number[]) => c[1])
            
            newBoxes.push({
              id: crypto.randomUUID(),
              name: feature.properties?.name || `Imported Zone ${boxes.length + index + 1}`,
              north: Math.max(...lats),
              south: Math.min(...lats),
              east: Math.max(...lngs),
              west: Math.min(...lngs),
              color: feature.properties?.color || `hsl(${(boxes.length + index) * 60}, 70%, 50%)`,
              trigger: feature.properties?.trigger,
              payout: feature.properties?.payout,
            })
          }
        })
        
        if (newBoxes.length > 0) {
          addBoxes(newBoxes)
        }
      } catch (err) {
        console.error('Failed to parse GeoJSON:', err)
      }
    }
    reader.readAsText(file)
  }, [boxes.length, addBoxes])

  // Get extended boxes if stress test is enabled
  const displayBoxes = stressTestConfig.enabled ? getExtendedBoxes() : boxes

  // Generate GeoJSON for earthquake points
  const earthquakePointsGeoJSON = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: earthquakes.map((eq) => ({
        type: 'Feature' as const,
        properties: {
          event_id: eq.event_id,
          magnitude: eq.magnitude,
          place: eq.place,
          depth_km: eq.depth_km,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [eq.longitude, eq.latitude],
        },
      })),
    }
  }, [earthquakes])

  // Generate GeoJSON for bounding boxes
  const boxesGeoJSON = useMemo(() => {
    const allBoxes = [...displayBoxes]

    // Add drawing preview
    if (isDrawing && drawStart && drawCurrent) {
      const previewBox: EarthquakeBoundingBox = {
        id: 'drawing-preview',
        name: 'Drawing...',
        north: Math.max(drawStart.lat, drawCurrent.lat),
        south: Math.min(drawStart.lat, drawCurrent.lat),
        east: Math.max(drawStart.lng, drawCurrent.lng),
        west: Math.min(drawStart.lng, drawCurrent.lng),
        color: '#eab308',
      }
      allBoxes.push(previewBox)
    }

    return {
      type: 'FeatureCollection' as const,
      features: allBoxes.map((box) => {
        const stats = statistics[box.id]
        // Check if box is extended (stress test mode)
        const extendedBox = box as typeof box & { 
          _isExtended?: boolean
          _originalBounds?: { north: number; south: number; east: number; west: number }
        }
        return {
          type: 'Feature' as const,
          properties: {
            id: box.id,
            name: box.name,
            color: box.color || '#eab308',
            isSelected: box.id === selectedBoxId,
            isExtended: extendedBox._isExtended || false,
            // Include trigger criteria for hover display
            minMagnitude: box.trigger?.min_magnitude,
            maxDepth: box.trigger?.max_depth_km,
            minDepth: box.trigger?.min_depth_km,
            // Include stats for hover display
            totalEvents: stats?.total_earthquakes ?? null,
            qualifyingEvents: stats?.qualifying_earthquakes ?? null,
            triggerProbability: stats?.trigger_probability ?? null,
            maxMagnitude: stats?.max_magnitude ?? null,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [box.west, box.north],
                [box.east, box.north],
                [box.east, box.south],
                [box.west, box.south],
                [box.west, box.north],
              ],
            ],
          },
        }
      }),
    }
  }, [displayBoxes, selectedBoxId, isDrawing, drawStart, drawCurrent, statistics])

  // Generate GeoJSON for original box boundaries when stress testing is enabled
  const originalBoundsGeoJSON = useMemo(() => {
    if (!stressTestConfig.enabled) return { type: 'FeatureCollection' as const, features: [] }

    const extendedBoxes = displayBoxes.filter((box) => {
      const extBox = box as typeof box & { _isExtended?: boolean }
      return extBox._isExtended
    })

    return {
      type: 'FeatureCollection' as const,
      features: extendedBoxes.map((box) => {
        const extBox = box as typeof box & { 
          _originalBounds?: { north: number; south: number; east: number; west: number }
        }
        const orig = extBox._originalBounds || { north: box.north, south: box.south, east: box.east, west: box.west }
        return {
          type: 'Feature' as const,
          properties: {
            id: box.id,
            color: box.color || '#eab308',
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [orig.west, orig.north],
                [orig.east, orig.north],
                [orig.east, orig.south],
                [orig.west, orig.south],
                [orig.west, orig.north],
              ],
            ],
          },
        }
      }),
    }
  }, [displayBoxes, stressTestConfig.enabled])

  // Handle map click for box selection
  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!isDrawing) {
        // Check if clicking on a box
        const features = e.features
        if (features && features.length > 0) {
          const boxFeature = features.find((f) => f.layer?.id === 'eq-boxes-fill')
          if (boxFeature && boxFeature.properties?.id) {
            selectBox(boxFeature.properties.id)
            return
          }
        }
        selectBox(null)
      }
    },
    [isDrawing, selectBox]
  )

  // Handle hover for box details popup
  const handleBoxHover = useCallback(
    (e: MapLayerMouseEvent) => {
      if (isDrawing) {
        setHoveredBox(null)
        return
      }
      
      const features = e.features
      if (features && features.length > 0) {
        const boxFeature = features.find((f) => f.layer?.id === 'eq-boxes-fill')
        if (boxFeature && boxFeature.properties?.id && boxFeature.properties.id !== 'drawing-preview') {
          setHoveredBox({
            id: boxFeature.properties.id,
            name: boxFeature.properties.name || 'Zone',
            lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat },
          })
          return
        }
      }
      setHoveredBox(null)
    },
    [isDrawing]
  )

  const handleMouseDown = useCallback((e: MapLayerMouseEvent) => {
    if (e.originalEvent.shiftKey) {
      setIsDrawing(true)
      setHoveredBox(null)
      setDrawStart({ lng: e.lngLat.lng, lat: e.lngLat.lat })
      setDrawCurrent({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      if (isDrawing) {
        setDrawCurrent({ lng: e.lngLat.lng, lat: e.lngLat.lat })
      }
    },
    [isDrawing]
  )

  const handleMouseUp = useCallback(() => {
    if (isDrawing && drawStart && drawCurrent) {
      const newBox: EarthquakeBoundingBox = {
        id: `eq-box-${Date.now()}`,
        name: `Zone ${boxes.length + 1}`,
        north: Math.max(drawStart.lat, drawCurrent.lat),
        south: Math.min(drawStart.lat, drawCurrent.lat),
        east: Math.max(drawStart.lng, drawCurrent.lng),
        west: Math.min(drawStart.lng, drawCurrent.lng),
        color: `hsl(${Math.random() * 60 + 30}, 70%, 50%)`, // Yellow-orange range
      }

      // Only add if the box has some size
      if (
        Math.abs(newBox.north - newBox.south) > 0.1 &&
        Math.abs(newBox.east - newBox.west) > 0.1
      ) {
        addBox(newBox)
      }
    }

    setIsDrawing(false)
    setDrawStart(null)
    setDrawCurrent(null)
  }, [isDrawing, drawStart, drawCurrent, boxes.length, addBox])

  // Disable map drag when drawing
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (map) {
      if (isDrawing) {
        map.dragPan.disable()
      } else {
        map.dragPan.enable()
      }
    }
  }, [isDrawing])

  return (
    <MapGL
      ref={mapRef}
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
      onClick={handleMapClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleBoxHover}
      onMouseLeave={() => setHoveredBox(null)}
      interactiveLayerIds={['eq-boxes-fill']}
      cursor={isDrawing ? 'crosshair' : hoveredBox ? 'pointer' : 'grab'}
    >
      <NavigationControl position="top-right" />
      <ScaleControl position="bottom-right" />

      {/* Map Style Selector */}
      <div className="absolute top-4 left-4 z-10">
        <MapStyleSelector
          currentStyleId={currentStyleId}
          onStyleChange={handleStyleChange}
        />
      </div>

      {/* Drawing Toolbar */}
      <div className="absolute bottom-4 left-4 z-10">
        <DrawingToolbar
          isDrawing={isDrawing}
          onStartDrawing={() => setIsDrawing(true)}
          onStopDrawing={() => setIsDrawing(false)}
          onUploadZones={handleUploadZones}
          onClearAllZones={clearAllBoxes}
          zoneCount={boxes.length}
          perilType="earthquake"
        />
      </div>

      {/* Hover Popup for Box Details */}
      {hoveredBox && (
        <Popup
          longitude={hoveredBox.lngLat.lng}
          latitude={hoveredBox.lngLat.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={10}
          className="box-hover-popup"
        >
          <BoxHoverContent boxId={hoveredBox.id} />
        </Popup>
      )}

      {/* Earthquake points layer */}
      <Source id="earthquake-points" type="geojson" data={earthquakePointsGeoJSON}>
        <Layer
          id="earthquake-circles"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'magnitude'],
              4,
              3,
              5,
              5,
              6,
              8,
              7,
              12,
              8,
              18,
              9,
              25,
            ],
            'circle-color': [
              'interpolate',
              ['linear'],
              ['get', 'magnitude'],
              4,
              '#22c55e',
              5,
              '#eab308',
              6,
              '#ea580c',
              7,
              '#dc2626',
              8,
              '#7c3aed',
            ],
            'circle-opacity': 0.7,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.5,
          }}
        />
      </Source>

      {/* Bounding boxes layer */}
      <Source id="eq-boxes" type="geojson" data={boxesGeoJSON}>
        {/* Box fill */}
        <Layer
          id="eq-boxes-fill"
          type="fill"
          paint={{
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'case',
              ['==', ['get', 'isSelected'], true],
              0.3,
              ['==', ['get', 'isExtended'], true],
              0.2,
              0.15,
            ],
          }}
        />
        {/* Box outline - solid for regular boxes */}
        <Layer
          id="eq-boxes-outline"
          type="line"
          filter={['!=', ['get', 'isExtended'], true]}
          paint={{
            'line-color': ['get', 'color'],
            'line-width': [
              'case',
              ['==', ['get', 'isSelected'], true],
              3,
              2,
            ],
            'line-opacity': 0.8,
          }}
        />
        {/* Box outline - dashed for extended boxes */}
        <Layer
          id="eq-boxes-outline-extended"
          type="line"
          filter={['==', ['get', 'isExtended'], true]}
          paint={{
            'line-color': ['get', 'color'],
            'line-width': [
              'case',
              ['==', ['get', 'isSelected'], true],
              3,
              2.5,
            ],
            'line-opacity': 0.9,
            'line-dasharray': [4, 2],
          }}
        />
      </Source>

      {/* Original box boundaries layer (shown when stress testing is enabled) */}
      {stressTestConfig.enabled && (
        <Source id="eq-original-bounds" type="geojson" data={originalBoundsGeoJSON}>
          {/* Only show outline, no fill to avoid click interference */}
          <Layer
            id="eq-original-bounds-outline"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 1.5,
              'line-opacity': 0.7,
            }}
          />
        </Source>
      )}

      {/* Extended boundary indicator */}
      {stressTestConfig.enabled && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-purple-600/90 px-4 py-2 rounded-lg text-white text-sm font-medium shadow-lg flex items-center space-x-2">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-white"></span>
          <span>Stress Test Active: Dashed = Extended Boundaries, Solid = Original</span>
        </div>
      )}

      {/* Drawing mode banner */}
      {isDrawing && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-green-600/90 px-4 py-2 rounded-lg text-white font-medium shadow-lg">
          Click and drag to draw a trigger zone
        </div>
      )}
    </MapGL>
  )
}
