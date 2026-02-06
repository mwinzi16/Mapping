import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import MapGL, { Source, Layer, NavigationControl, ScaleControl, Popup } from 'react-map-gl/maplibre'
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useParametricStore } from '../../stores/parametricStore'
import { BoundingBox } from '../../types/parametric'
import { Waves, Target, AlertTriangle, TrendingUp, Wind } from 'lucide-react'
import MapStyleSelector, {
  MAP_STYLES,
  MapStyleOption,
  MapStyleValue,
  generateRasterStyle,
  generateNightLightsStyle,
  generate3DTerrainStyle,
} from './MapStyleSelector'
import DrawingToolbar from './DrawingToolbar'

// Colors for hurricane categories
const CATEGORY_COLORS: Record<number, string> = {
  0: '#74b9ff',  // Tropical Storm
  1: '#00b894',  // Cat 1
  2: '#fdcb6e',  // Cat 2
  3: '#e17055',  // Cat 3
  4: '#d63031',  // Cat 4
  5: '#6c5ce7',  // Cat 5
}

interface HoveredBox {
  id: string
  name: string
  lngLat: { lng: number; lat: number }
}

// Box hover content component
function BoxHoverContent({ boxId }: { boxId: string }) {
  const { boxes, statistics } = useParametricStore()
  const box = boxes.find(b => b.id === boxId)
  const stats = statistics[boxId]

  if (!box) return null

  return (
    <div className="bg-gray-800 text-white p-3 rounded-lg min-w-[200px] shadow-xl">
      <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-gray-700">
        <Waves className="w-4 h-4 text-blue-400" />
        <span className="font-semibold text-blue-400">{box.name}</span>
      </div>
      
      {/* Trigger Criteria */}
      {box.trigger && (
        <div className="mb-2 pb-2 border-b border-gray-700">
          <div className="text-xs text-gray-400 mb-1 flex items-center">
            <Target className="w-3 h-3 mr-1" />
            Trigger Criteria
          </div>
          <div className="text-sm space-y-0.5">
            {box.trigger.min_category !== undefined && (
              <div>Min Category: <span className="text-blue-400">Cat {box.trigger.min_category}</span></div>
            )}
            {box.trigger.min_wind_knots !== undefined && (
              <div>Min Wind: <span className="text-cyan-400">{box.trigger.min_wind_knots} kt</span></div>
            )}
            {box.trigger.max_pressure_mb !== undefined && (
              <div>Max Pressure: <span className="text-cyan-400">{box.trigger.max_pressure_mb} mb</span></div>
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
              Total Hurricanes
            </span>
            <span className="font-medium">{stats.total_hurricanes}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Qualifying</span>
            <span className="font-medium text-blue-400">{stats.qualifying_hurricanes}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 flex items-center">
              <Wind className="w-3 h-3 mr-1" />
              Max Intensity
            </span>
            <span className="font-medium text-red-400">{stats.max_intensity_knots} kt</span>
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

export default function ParametricMap() {
  const mapRef = useRef<MapRef>(null)
  const { hurricanes, boxes, addBox, addBoxes, clearAllBoxes, selectedBoxId, selectBox, statistics } = useParametricStore()
  
  const [viewState, setViewState] = useState({
    longitude: -60,
    latitude: 25,
    zoom: 3,
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
  const [drawStart, setDrawStart] = useState<{ lng: number; lat: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ lng: number; lat: number } | null>(null)
  
  // Hover state
  const [hoveredBox, setHoveredBox] = useState<HoveredBox | null>(null)

  // Handle file upload for GeoJSON zones
  const handleUploadZones = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string)
        const newBoxes: BoundingBox[] = []
        
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
  
  // Generate GeoJSON for hurricane tracks with intensity-based segments
  const hurricaneTracksGeoJSON = useMemo(() => {
    const features: GeoJSON.Feature[] = []
    
    hurricanes.forEach((hurricane) => {
      // Create individual segments between track points, colored by category
      for (let i = 0; i < hurricane.track.length - 1; i++) {
        const point = hurricane.track[i]
        const nextPoint = hurricane.track[i + 1]
        
        features.push({
          type: 'Feature' as const,
          properties: {
            storm_id: hurricane.storm_id,
            name: hurricane.name,
            year: hurricane.year,
            category: point.category,
            wind_knots: point.wind_knots,
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [point.longitude, point.latitude],
              [nextPoint.longitude, nextPoint.latitude],
            ],
          },
        })
      }
      
      // Add point markers at each track position
      hurricane.track.forEach((point) => {
        features.push({
          type: 'Feature' as const,
          properties: {
            storm_id: hurricane.storm_id,
            name: hurricane.name,
            year: hurricane.year,
            category: point.category,
            wind_knots: point.wind_knots,
            pressure_mb: point.pressure_mb,
            timestamp: point.timestamp,
            status: point.status,
            isPoint: true,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [point.longitude, point.latitude],
          },
        })
      })
    })
    
    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [hurricanes])
  
  // Generate GeoJSON for bounding boxes
  const boxesGeoJSON = useMemo(() => {
    const allBoxes = [...boxes]
    
    // Add drawing preview
    if (isDrawing && drawStart && drawCurrent) {
      const previewBox: BoundingBox = {
        id: 'drawing-preview',
        name: 'Drawing...',
        north: Math.max(drawStart.lat, drawCurrent.lat),
        south: Math.min(drawStart.lat, drawCurrent.lat),
        east: Math.max(drawStart.lng, drawCurrent.lng),
        west: Math.min(drawStart.lng, drawCurrent.lng),
        color: '#3b82f6',
      }
      allBoxes.push(previewBox)
    }
    
    return {
      type: 'FeatureCollection' as const,
      features: allBoxes.map((box) => {
        const stats = statistics[box.id]
        return {
          type: 'Feature' as const,
          properties: {
            id: box.id,
            name: box.name,
            color: box.color || '#3b82f6',
            isSelected: box.id === selectedBoxId,
            // Include stats for hover display
            totalHurricanes: stats?.total_hurricanes ?? null,
            qualifyingHurricanes: stats?.qualifying_hurricanes ?? null,
            triggerProbability: stats?.trigger_probability ?? null,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[
              [box.west, box.north],
              [box.east, box.north],
              [box.east, box.south],
              [box.west, box.south],
              [box.west, box.north],
            ]],
          },
        }
      }),
    }
  }, [boxes, selectedBoxId, isDrawing, drawStart, drawCurrent, statistics])
  
  // Handle map click for box drawing
  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    if (!isDrawing) {
      // Check if clicking on a box
      const features = e.features
      if (features && features.length > 0) {
        const boxFeature = features.find(f => f.layer?.id === 'boxes-fill')
        if (boxFeature && boxFeature.properties?.id) {
          selectBox(boxFeature.properties.id)
          return
        }
      }
      selectBox(null)
    }
  }, [isDrawing, selectBox])
  
  // Handle hover for box details popup
  const handleBoxHover = useCallback(
    (e: MapLayerMouseEvent) => {
      if (isDrawing) {
        setHoveredBox(null)
        return
      }
      
      const features = e.features
      if (features && features.length > 0) {
        const boxFeature = features.find((f) => f.layer?.id === 'boxes-fill')
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
  
  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    if (isDrawing) {
      setDrawCurrent({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    }
  }, [isDrawing])
  
  const handleMouseUp = useCallback(() => {
    if (isDrawing && drawStart && drawCurrent) {
      const newBox: BoundingBox = {
        id: `box-${Date.now()}`,
        name: `Zone ${boxes.length + 1}`,
        north: Math.max(drawStart.lat, drawCurrent.lat),
        south: Math.min(drawStart.lat, drawCurrent.lat),
        east: Math.max(drawStart.lng, drawCurrent.lng),
        west: Math.min(drawStart.lng, drawCurrent.lng),
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      }
      
      // Only add if the box has some size
      if (Math.abs(newBox.north - newBox.south) > 0.1 && Math.abs(newBox.east - newBox.west) > 0.1) {
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
      onMove={evt => setViewState(evt.viewState)}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
      onClick={handleMapClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleBoxHover}
      onMouseLeave={() => setHoveredBox(null)}
      interactiveLayerIds={['boxes-fill']}
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
          perilType="hurricane"
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
      
      {/* Hurricane tracks layer - intensity colored segments */}
      <Source id="hurricane-tracks" type="geojson" data={hurricaneTracksGeoJSON}>
        {/* Track line segments colored by category */}
        <Layer
          id="hurricane-tracks-line"
          type="line"
          filter={['==', '$type', 'LineString']}
          paint={{
            'line-color': [
              'match',
              ['get', 'category'],
              0, CATEGORY_COLORS[0],
              1, CATEGORY_COLORS[1],
              2, CATEGORY_COLORS[2],
              3, CATEGORY_COLORS[3],
              4, CATEGORY_COLORS[4],
              5, CATEGORY_COLORS[5],
              '#74b9ff'
            ],
            'line-width': 2.5,
            'line-opacity': 0.85,
          }}
        />
        {/* Track point markers */}
        <Layer
          id="hurricane-tracks-points"
          type="circle"
          filter={['==', '$type', 'Point']}
          paint={{
            'circle-radius': 4,
            'circle-color': [
              'match',
              ['get', 'category'],
              0, CATEGORY_COLORS[0],
              1, CATEGORY_COLORS[1],
              2, CATEGORY_COLORS[2],
              3, CATEGORY_COLORS[3],
              4, CATEGORY_COLORS[4],
              5, CATEGORY_COLORS[5],
              '#74b9ff'
            ],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          }}
        />
      </Source>
      
      {/* Bounding boxes layer */}
      <Source id="boxes" type="geojson" data={boxesGeoJSON}>
        <Layer
          id="boxes-fill"
          type="fill"
          paint={{
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'case',
              ['get', 'isSelected'],
              0.4,
              0.2
            ],
          }}
        />
        <Layer
          id="boxes-outline"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': [
              'case',
              ['get', 'isSelected'],
              3,
              2
            ],
          }}
        />
        <Layer
          id="boxes-labels"
          type="symbol"
          layout={{
            'text-field': ['get', 'name'],
            'text-size': 14,
            'text-anchor': 'center',
          }}
          paint={{
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1,
          }}
        />
      </Source>

      {/* Drawing mode banner */}
      {isDrawing && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-green-600/90 px-4 py-2 rounded-lg text-white font-medium shadow-lg">
          Click and drag to draw a trigger zone
        </div>
      )}
      
      {/* Category legend */}
      <div className="absolute bottom-4 right-4 bg-gray-800/90 px-4 py-3 rounded-lg">
        <div className="text-xs text-gray-400 mb-2">Hurricane Category</div>
        <div className="flex space-x-3">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <div key={cat} className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-300">{cat === '0' ? 'TS' : `${cat}`}</span>
            </div>
          ))}
        </div>
      </div>
    </MapGL>
  )
}
