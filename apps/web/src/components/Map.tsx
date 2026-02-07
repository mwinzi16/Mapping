import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import MapGL, { Marker, Popup, NavigationControl, ScaleControl, Source, Layer } from 'react-map-gl/maplibre'
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre'
import { useEventStore } from '../stores/eventStore'
import { useTriggerZoneStore, TriggerZone } from '../stores/triggerZoneStore'
import { getMagnitudeColor, getCategoryColor, getWildfireColor, getTornadoColor, getFloodingColor, getHailColor } from '../utils/colors'
import type { Earthquake, Hurricane, Wildfire, SevereWeather } from '../types'
import MapStyleSelector, {
  MAP_STYLES,
  MapStyleOption,
  MapStyleValue,
  generateRasterStyle,
  generateNightLightsStyle,
  generate3DTerrainStyle,
} from './parametric/MapStyleSelector'
import DrawingToolbar from './parametric/DrawingToolbar'

interface UploadedGeoJSONFeature {
  type?: string
  geometry?: {
    type: string
    coordinates: number[][][]
  }
  properties?: {
    name?: string
    color?: string
    trigger?: TriggerZone['trigger']
    payout?: TriggerZone['payout']
  }
}

type AnyEvent = Earthquake | Hurricane | Wildfire | SevereWeather

export default function Map() {
  const mapRef = useRef<MapRef>(null)
  const { earthquakes, hurricanes, wildfires, severeWeather, setSelectedEvent } = useEventStore()
  const {
    zones,
    addZone,
    addZones,
    clearAllZones,
    selectedZoneId,
    calculations,
    setSelectedEvent: setTriggerSelectedEvent,
  } = useTriggerZoneStore()
  
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 2,
    pitch: 0,
  })
  
  const [popupInfo, setPopupInfo] = useState<AnyEvent | null>(null)
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ lng: number; lat: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ lng: number; lat: number } | null>(null)
  
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
  
  const handleMarkerClick = useCallback((event: AnyEvent) => {
    setSelectedEvent(event)
    setTriggerSelectedEvent(event)
    setPopupInfo(event)
  }, [setSelectedEvent, setTriggerSelectedEvent])
  
  // Handle file upload for GeoJSON zones
  const handleUploadZones = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string)
        const newZones: TriggerZone[] = []
        
        const features = geojson.features || [geojson]
        features.forEach((feature: UploadedGeoJSONFeature, index: number) => {
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
  }, [zones.length, addZones])
  
  // Generate GeoJSON for trigger zones
  const zonesGeoJSON = useMemo(() => {
    const features = zones.map((zone) => {
      const calc = calculations.find(c => c.zoneId === zone.id)
      return {
        type: 'Feature' as const,
        properties: {
          id: zone.id,
          name: zone.name,
          color: zone.color || '#3b82f6',
          isSelected: zone.id === selectedZoneId,
          isTriggered: calc?.triggered || false,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [zone.west, zone.south],
            [zone.east, zone.south],
            [zone.east, zone.north],
            [zone.west, zone.north],
            [zone.west, zone.south],
          ]],
        },
      }
    })
    
    // Add drawing preview if active
    if (isDrawing && drawStart && drawCurrent) {
      features.push({
        type: 'Feature',
        properties: {
          id: 'drawing',
          name: 'Drawing...',
          color: '#fbbf24',
          isSelected: false,
          isTriggered: false,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [Math.min(drawStart.lng, drawCurrent.lng), Math.min(drawStart.lat, drawCurrent.lat)],
            [Math.max(drawStart.lng, drawCurrent.lng), Math.min(drawStart.lat, drawCurrent.lat)],
            [Math.max(drawStart.lng, drawCurrent.lng), Math.max(drawStart.lat, drawCurrent.lat)],
            [Math.min(drawStart.lng, drawCurrent.lng), Math.max(drawStart.lat, drawCurrent.lat)],
            [Math.min(drawStart.lng, drawCurrent.lng), Math.min(drawStart.lat, drawCurrent.lat)],
          ]],
        },
      })
    }
    
    return { type: 'FeatureCollection' as const, features }
  }, [zones, selectedZoneId, calculations, isDrawing, drawStart, drawCurrent])
  
  // Drawing handlers
  const handleMouseDown = useCallback((e: MapLayerMouseEvent) => {
    if (isDrawing || e.originalEvent.shiftKey) {
      setDrawStart({ lng: e.lngLat.lng, lat: e.lngLat.lat })
      setDrawCurrent({ lng: e.lngLat.lng, lat: e.lngLat.lat })
      setIsDrawing(true)
    }
  }, [isDrawing])
  
  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    if (isDrawing && drawStart) {
      setDrawCurrent({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    }
  }, [isDrawing, drawStart])
  
  const handleMouseUp = useCallback(() => {
    if (isDrawing && drawStart && drawCurrent) {
      const north = Math.max(drawStart.lat, drawCurrent.lat)
      const south = Math.min(drawStart.lat, drawCurrent.lat)
      const east = Math.max(drawStart.lng, drawCurrent.lng)
      const west = Math.min(drawStart.lng, drawCurrent.lng)
      
      // Only create zone if it has some size
      if (Math.abs(north - south) > 0.01 && Math.abs(east - west) > 0.01) {
        const newZone: TriggerZone = {
          id: crypto.randomUUID(),
          name: `Zone ${zones.length + 1}`,
          north,
          south,
          east,
          west,
          color: `hsl(${zones.length * 60}, 70%, 50%)`,
        }
        addZone(newZone)
      }
      
      setDrawStart(null)
      setDrawCurrent(null)
      setIsDrawing(false)
    }
  }, [isDrawing, drawStart, drawCurrent, zones.length, addZone])
  
  // Prevent map panning while drawing
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
  
  const getEventColor = (event: SevereWeather) => {
    switch (event.event_type) {
      case 'tornado': return getTornadoColor(event.tornado_scale)
      case 'flooding': return getFloodingColor(event.flood_severity)
      case 'hail': return getHailColor(event.hail_size_inches)
      default: return '#8b5cf6'
    }
  }
  
  const getEventEmoji = (event: SevereWeather) => {
    switch (event.event_type) {
      case 'tornado': return '🌪️'
      case 'flooding': return '🌊'
      case 'hail': return '🧊'
      default: return '⚡'
    }
  }
  
  return (
    <MapGL
      ref={mapRef}
      {...viewState}
      onMove={evt => setViewState(evt.viewState)}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
      cursor={isDrawing ? 'crosshair' : 'grab'}
    >
      {/* Navigation controls */}
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
          onClearAllZones={clearAllZones}
          zoneCount={zones.length}
          perilType="earthquake"
        />
      </div>

      {/* Drawing mode banner */}
      {isDrawing && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-green-600/90 px-4 py-2 rounded-lg text-white font-medium shadow-lg z-20">
          Click and drag to draw a trigger zone
        </div>
      )}

      {/* Trigger zones layer */}
      <Source id="trigger-zones" type="geojson" data={zonesGeoJSON}>
        <Layer
          id="zones-fill"
          type="fill"
          paint={{
            'fill-color': [
              'case',
              ['==', ['get', 'isTriggered'], true],
              '#22c55e',
              ['get', 'color'],
            ],
            'fill-opacity': [
              'case',
              ['==', ['get', 'isSelected'], true],
              0.4,
              0.2,
            ],
          }}
        />
        <Layer
          id="zones-outline"
          type="line"
          paint={{
            'line-color': [
              'case',
              ['==', ['get', 'isTriggered'], true],
              '#22c55e',
              ['get', 'color'],
            ],
            'line-width': [
              'case',
              ['==', ['get', 'isSelected'], true],
              3,
              2,
            ],
            'line-opacity': 0.8,
          }}
        />
        <Layer
          id="zones-label"
          type="symbol"
          layout={{
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-anchor': 'center',
          }}
          paint={{
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1,
          }}
        />
      </Source>
      
      {/* Earthquake markers */}
      {earthquakes.map((eq) => (
        <Marker
          key={eq.usgs_id}
          longitude={eq.longitude}
          latitude={eq.latitude}
          anchor="center"
          onClick={() => handleMarkerClick(eq)}
        >
          <div
            className="rounded-full cursor-pointer transition-transform hover:scale-110"
            style={{
              width: `${Math.max(8, eq.magnitude * 4)}px`,
              height: `${Math.max(8, eq.magnitude * 4)}px`,
              backgroundColor: getMagnitudeColor(eq.magnitude),
              border: '2px solid white',
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
            }}
          />
        </Marker>
      ))}
      
      {/* Hurricane markers */}
      {hurricanes.map((hurricane) => (
        <Marker
          key={hurricane.storm_id}
          longitude={hurricane.longitude}
          latitude={hurricane.latitude}
          anchor="center"
          onClick={() => handleMarkerClick(hurricane)}
        >
          <div
            className="hurricane-rotate cursor-pointer"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill={getCategoryColor(hurricane.category)}
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
        </Marker>
      ))}
      
      {/* Wildfire markers */}
      {wildfires.map((fire) => (
        <Marker
          key={fire.source_id}
          longitude={fire.longitude}
          latitude={fire.latitude}
          anchor="center"
          onClick={() => handleMarkerClick(fire)}
        >
          <div
            className="cursor-pointer transition-transform hover:scale-110 flex items-center justify-center rounded-full"
            style={{
              width: '24px',
              height: '24px',
              backgroundColor: getWildfireColor(fire.confidence, fire.frp),
              border: '2px solid white',
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
              fontSize: '14px',
            }}
          >
            🔥
          </div>
        </Marker>
      ))}
      
      {/* Severe weather markers */}
      {severeWeather.map((event) => (
        <Marker
          key={event.source_id}
          longitude={event.longitude}
          latitude={event.latitude}
          anchor="center"
          onClick={() => handleMarkerClick(event)}
        >
          <div
            className="cursor-pointer transition-transform hover:scale-110 flex items-center justify-center rounded-full"
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: getEventColor(event),
              border: '2px solid white',
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
              fontSize: '16px',
            }}
          >
            {getEventEmoji(event)}
          </div>
        </Marker>
      ))}
      
      {/* Popup */}
      {popupInfo && (
        <Popup
          longitude={popupInfo.longitude}
          latitude={popupInfo.latitude}
          anchor="bottom"
          onClose={() => setPopupInfo(null)}
          closeButton={true}
          closeOnClick={false}
          className="text-gray-900"
        >
          {'magnitude' in popupInfo ? (
            // Earthquake popup
            <div className="p-2">
              <h3 className="font-bold text-lg">M{popupInfo.magnitude.toFixed(1)}</h3>
              <p className="text-sm">{popupInfo.place}</p>
              <p className="text-xs text-gray-500">Depth: {popupInfo.depth_km.toFixed(1)} km</p>
            </div>
          ) : 'storm_id' in popupInfo ? (
            // Hurricane popup
            <div className="p-2">
              <h3 className="font-bold text-lg">{popupInfo.name}</h3>
              <p className="text-sm">{popupInfo.classification}</p>
              <p className="text-xs text-gray-500">Max winds: {popupInfo.max_wind_mph} mph</p>
            </div>
          ) : 'source_id' in popupInfo && !('event_type' in popupInfo) ? (
            // Wildfire popup
            <div className="p-2">
              <h3 className="font-bold text-lg">🔥 {(popupInfo as Wildfire).name || 'Active Fire'}</h3>
              {(popupInfo as Wildfire).frp && <p className="text-sm">FRP: {(popupInfo as Wildfire).frp!.toFixed(1)} MW</p>}
              {(popupInfo as Wildfire).confidence && <p className="text-xs text-gray-500">Confidence: {(popupInfo as Wildfire).confidence}%</p>}
            </div>
          ) : (
            // Severe weather popup
            <div className="p-2">
              <h3 className="font-bold text-lg capitalize">{(popupInfo as SevereWeather).event_type}</h3>
              <p className="text-sm">{(popupInfo as SevereWeather).location || 'Location unknown'}</p>
              {(popupInfo as SevereWeather).severity && <p className="text-xs text-gray-500">Severity: {(popupInfo as SevereWeather).severity}</p>}
              {(popupInfo as SevereWeather).description && <p className="text-xs text-gray-500 mt-1">{(popupInfo as SevereWeather).description}</p>}
            </div>
          )}
        </Popup>
      )}
    </MapGL>
  )
}
