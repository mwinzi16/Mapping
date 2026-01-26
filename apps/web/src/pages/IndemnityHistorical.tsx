import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useIndemnityStore } from '../stores/indemnityStore'
import { formatTIVShort } from '../utils/tivExcelUtils'
import { shouldUseChoropleth, renderChoropleth, removeChoropleth } from '../utils/choroplethUtils'
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
} from 'lucide-react'

// Historical earthquake data
const HISTORICAL_EARTHQUAKES = [
  { id: 'eq1', name: 'Northridge 1994', magnitude: 6.7, lat: 34.213, lon: -118.537, date: '1994-01-17', deaths: 57, damage: 20000000000 },
  { id: 'eq2', name: 'Loma Prieta 1989', magnitude: 6.9, lat: 37.04, lon: -121.88, date: '1989-10-17', deaths: 63, damage: 6000000000 },
  { id: 'eq3', name: 'San Fernando 1971', magnitude: 6.6, lat: 34.416, lon: -118.4, date: '1971-02-09', deaths: 65, damage: 500000000 },
  { id: 'eq4', name: 'Ridgecrest 2019', magnitude: 7.1, lat: 35.77, lon: -117.6, date: '2019-07-06', deaths: 0, damage: 1000000000 },
  { id: 'eq5', name: 'Napa 2014', magnitude: 6.0, lat: 38.22, lon: -122.31, date: '2014-08-24', deaths: 1, damage: 500000000 },
]

// Historical hurricanes with FULL TRACK DATA
interface HurricaneTrackPoint {
  lat: number
  lon: number
  time: string
  wind_mph: number
  pressure_mb: number
  category: number | null
  status: string // 'TD' | 'TS' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5'
}

interface HistoricalHurricane {
  id: string
  name: string
  season: number
  maxCategory: number
  maxWindMph: number
  minPressureMb: number
  damage: number
  deaths: number
  track: HurricaneTrackPoint[]
}

const HISTORICAL_HURRICANES: HistoricalHurricane[] = [
  {
    id: 'h1',
    name: 'Hurricane Andrew',
    season: 1992,
    maxCategory: 5,
    maxWindMph: 175,
    minPressureMb: 922,
    damage: 27000000000,
    deaths: 65,
    track: [
      { lat: 12.3, lon: -42.0, time: '1992-08-17T00:00Z', wind_mph: 40, pressure_mb: 1010, category: null, status: 'TS' },
      { lat: 13.8, lon: -48.5, time: '1992-08-18T00:00Z', wind_mph: 50, pressure_mb: 1005, category: null, status: 'TS' },
      { lat: 15.5, lon: -54.0, time: '1992-08-19T00:00Z', wind_mph: 65, pressure_mb: 998, category: null, status: 'TS' },
      { lat: 17.2, lon: -59.5, time: '1992-08-20T00:00Z', wind_mph: 80, pressure_mb: 990, category: 1, status: 'H1' },
      { lat: 18.8, lon: -64.0, time: '1992-08-21T00:00Z', wind_mph: 110, pressure_mb: 970, category: 2, status: 'H2' },
      { lat: 20.5, lon: -68.5, time: '1992-08-22T00:00Z', wind_mph: 130, pressure_mb: 950, category: 4, status: 'H4' },
      { lat: 23.5, lon: -74.0, time: '1992-08-23T00:00Z', wind_mph: 165, pressure_mb: 928, category: 5, status: 'H5' },
      { lat: 25.5, lon: -80.2, time: '1992-08-24T06:00Z', wind_mph: 175, pressure_mb: 922, category: 5, status: 'H5' },
      { lat: 26.1, lon: -83.0, time: '1992-08-25T00:00Z', wind_mph: 140, pressure_mb: 945, category: 4, status: 'H4' },
      { lat: 27.5, lon: -88.0, time: '1992-08-26T00:00Z', wind_mph: 145, pressure_mb: 940, category: 4, status: 'H4' },
      { lat: 29.6, lon: -91.5, time: '1992-08-26T12:00Z', wind_mph: 115, pressure_mb: 960, category: 3, status: 'H3' },
    ],
  },
  {
    id: 'h2',
    name: 'Hurricane Katrina',
    season: 2005,
    maxCategory: 5,
    maxWindMph: 175,
    minPressureMb: 902,
    damage: 125000000000,
    deaths: 1836,
    track: [
      { lat: 23.2, lon: -75.5, time: '2005-08-24T00:00Z', wind_mph: 40, pressure_mb: 1008, category: null, status: 'TD' },
      { lat: 24.5, lon: -76.5, time: '2005-08-24T18:00Z', wind_mph: 50, pressure_mb: 1003, category: null, status: 'TS' },
      { lat: 25.4, lon: -78.4, time: '2005-08-25T12:00Z', wind_mph: 75, pressure_mb: 988, category: 1, status: 'H1' },
      { lat: 26.0, lon: -80.3, time: '2005-08-25T22:00Z', wind_mph: 80, pressure_mb: 984, category: 1, status: 'H1' },
      { lat: 25.9, lon: -83.3, time: '2005-08-26T18:00Z', wind_mph: 100, pressure_mb: 970, category: 2, status: 'H2' },
      { lat: 24.9, lon: -85.3, time: '2005-08-27T12:00Z', wind_mph: 115, pressure_mb: 955, category: 3, status: 'H3' },
      { lat: 25.7, lon: -87.0, time: '2005-08-28T06:00Z', wind_mph: 160, pressure_mb: 915, category: 5, status: 'H5' },
      { lat: 26.3, lon: -88.6, time: '2005-08-28T18:00Z', wind_mph: 175, pressure_mb: 902, category: 5, status: 'H5' },
      { lat: 28.2, lon: -89.2, time: '2005-08-29T06:00Z', wind_mph: 145, pressure_mb: 920, category: 4, status: 'H4' },
      { lat: 29.3, lon: -89.6, time: '2005-08-29T12:00Z', wind_mph: 125, pressure_mb: 928, category: 3, status: 'H3' },
      { lat: 31.1, lon: -89.6, time: '2005-08-29T18:00Z', wind_mph: 80, pressure_mb: 960, category: 1, status: 'H1' },
      { lat: 34.1, lon: -88.1, time: '2005-08-30T12:00Z', wind_mph: 45, pressure_mb: 985, category: null, status: 'TS' },
    ],
  },
  {
    id: 'h3',
    name: 'Hurricane Harvey',
    season: 2017,
    maxCategory: 4,
    maxWindMph: 130,
    minPressureMb: 937,
    damage: 125000000000,
    deaths: 107,
    track: [
      { lat: 13.4, lon: -35.0, time: '2017-08-17T00:00Z', wind_mph: 40, pressure_mb: 1007, category: null, status: 'TS' },
      { lat: 14.0, lon: -45.0, time: '2017-08-19T00:00Z', wind_mph: 50, pressure_mb: 1003, category: null, status: 'TS' },
      { lat: 15.5, lon: -60.0, time: '2017-08-21T00:00Z', wind_mph: 40, pressure_mb: 1006, category: null, status: 'TD' },
      { lat: 21.5, lon: -85.0, time: '2017-08-23T12:00Z', wind_mph: 45, pressure_mb: 1003, category: null, status: 'TS' },
      { lat: 23.0, lon: -90.0, time: '2017-08-24T12:00Z', wind_mph: 65, pressure_mb: 995, category: null, status: 'TS' },
      { lat: 24.5, lon: -93.5, time: '2017-08-25T06:00Z', wind_mph: 110, pressure_mb: 960, category: 2, status: 'H2' },
      { lat: 26.0, lon: -95.5, time: '2017-08-25T18:00Z', wind_mph: 130, pressure_mb: 937, category: 4, status: 'H4' },
      { lat: 27.8, lon: -97.0, time: '2017-08-26T03:00Z', wind_mph: 130, pressure_mb: 938, category: 4, status: 'H4' },
      { lat: 28.5, lon: -97.2, time: '2017-08-26T12:00Z', wind_mph: 90, pressure_mb: 965, category: 1, status: 'H1' },
      { lat: 29.0, lon: -96.5, time: '2017-08-27T00:00Z', wind_mph: 50, pressure_mb: 990, category: null, status: 'TS' },
      { lat: 29.5, lon: -95.5, time: '2017-08-28T00:00Z', wind_mph: 45, pressure_mb: 995, category: null, status: 'TS' },
      { lat: 29.8, lon: -93.8, time: '2017-08-30T00:00Z', wind_mph: 50, pressure_mb: 992, category: null, status: 'TS' },
    ],
  },
  {
    id: 'h4',
    name: 'Hurricane Ian',
    season: 2022,
    maxCategory: 5,
    maxWindMph: 160,
    minPressureMb: 937,
    damage: 110000000000,
    deaths: 150,
    track: [
      { lat: 14.3, lon: -61.4, time: '2022-09-23T18:00Z', wind_mph: 40, pressure_mb: 1004, category: null, status: 'TS' },
      { lat: 15.2, lon: -68.5, time: '2022-09-25T00:00Z', wind_mph: 50, pressure_mb: 999, category: null, status: 'TS' },
      { lat: 16.0, lon: -75.0, time: '2022-09-26T00:00Z', wind_mph: 75, pressure_mb: 985, category: 1, status: 'H1' },
      { lat: 18.5, lon: -79.5, time: '2022-09-26T18:00Z', wind_mph: 105, pressure_mb: 965, category: 2, status: 'H2' },
      { lat: 20.5, lon: -82.5, time: '2022-09-27T06:00Z', wind_mph: 125, pressure_mb: 950, category: 3, status: 'H3' },
      { lat: 22.0, lon: -83.5, time: '2022-09-27T18:00Z', wind_mph: 125, pressure_mb: 950, category: 3, status: 'H3' },
      { lat: 23.8, lon: -83.2, time: '2022-09-28T06:00Z', wind_mph: 155, pressure_mb: 937, category: 4, status: 'H4' },
      { lat: 26.7, lon: -82.2, time: '2022-09-28T19:00Z', wind_mph: 150, pressure_mb: 940, category: 4, status: 'H4' },
      { lat: 27.5, lon: -81.5, time: '2022-09-29T00:00Z', wind_mph: 100, pressure_mb: 965, category: 2, status: 'H2' },
      { lat: 28.8, lon: -81.0, time: '2022-09-29T06:00Z', wind_mph: 70, pressure_mb: 980, category: 1, status: 'H1' },
      { lat: 30.5, lon: -80.0, time: '2022-09-30T06:00Z', wind_mph: 85, pressure_mb: 975, category: 1, status: 'H1' },
      { lat: 32.9, lon: -79.4, time: '2022-09-30T18:00Z', wind_mph: 85, pressure_mb: 976, category: 1, status: 'H1' },
    ],
  },
  {
    id: 'h5',
    name: 'Hurricane Sandy',
    season: 2012,
    maxCategory: 3,
    maxWindMph: 115,
    minPressureMb: 940,
    damage: 70000000000,
    deaths: 233,
    track: [
      { lat: 14.3, lon: -77.6, time: '2012-10-22T12:00Z', wind_mph: 45, pressure_mb: 1002, category: null, status: 'TS' },
      { lat: 15.0, lon: -77.8, time: '2012-10-23T00:00Z', wind_mph: 65, pressure_mb: 992, category: null, status: 'TS' },
      { lat: 16.0, lon: -77.8, time: '2012-10-24T00:00Z', wind_mph: 80, pressure_mb: 975, category: 1, status: 'H1' },
      { lat: 17.8, lon: -76.8, time: '2012-10-24T18:00Z', wind_mph: 105, pressure_mb: 955, category: 2, status: 'H2' },
      { lat: 19.5, lon: -75.8, time: '2012-10-25T12:00Z', wind_mph: 115, pressure_mb: 940, category: 3, status: 'H3' },
      { lat: 22.0, lon: -76.0, time: '2012-10-26T06:00Z', wind_mph: 105, pressure_mb: 950, category: 2, status: 'H2' },
      { lat: 24.0, lon: -76.5, time: '2012-10-26T18:00Z', wind_mph: 80, pressure_mb: 965, category: 1, status: 'H1' },
      { lat: 27.2, lon: -77.5, time: '2012-10-27T12:00Z', wind_mph: 80, pressure_mb: 960, category: 1, status: 'H1' },
      { lat: 30.5, lon: -76.0, time: '2012-10-28T12:00Z', wind_mph: 75, pressure_mb: 958, category: 1, status: 'H1' },
      { lat: 34.5, lon: -73.5, time: '2012-10-29T06:00Z', wind_mph: 90, pressure_mb: 943, category: 1, status: 'H1' },
      { lat: 38.0, lon: -71.5, time: '2012-10-29T18:00Z', wind_mph: 90, pressure_mb: 945, category: 1, status: 'H1' },
      { lat: 39.5, lon: -74.4, time: '2012-10-30T00:00Z', wind_mph: 80, pressure_mb: 946, category: null, status: 'Post-Tropical' },
    ],
  },
  {
    id: 'h6',
    name: 'Hurricane Michael',
    season: 2018,
    maxCategory: 5,
    maxWindMph: 160,
    minPressureMb: 919,
    damage: 25000000000,
    deaths: 74,
    track: [
      { lat: 18.0, lon: -86.6, time: '2018-10-07T12:00Z', wind_mph: 50, pressure_mb: 1004, category: null, status: 'TS' },
      { lat: 19.5, lon: -86.0, time: '2018-10-08T00:00Z', wind_mph: 65, pressure_mb: 994, category: null, status: 'TS' },
      { lat: 21.0, lon: -86.0, time: '2018-10-08T12:00Z', wind_mph: 80, pressure_mb: 982, category: 1, status: 'H1' },
      { lat: 22.7, lon: -86.2, time: '2018-10-09T00:00Z', wind_mph: 105, pressure_mb: 965, category: 2, status: 'H2' },
      { lat: 25.0, lon: -86.5, time: '2018-10-09T18:00Z', wind_mph: 130, pressure_mb: 945, category: 4, status: 'H4' },
      { lat: 28.0, lon: -86.0, time: '2018-10-10T12:00Z', wind_mph: 155, pressure_mb: 923, category: 4, status: 'H4' },
      { lat: 30.2, lon: -85.4, time: '2018-10-10T17:00Z', wind_mph: 160, pressure_mb: 919, category: 5, status: 'H5' },
      { lat: 31.5, lon: -84.8, time: '2018-10-10T23:00Z', wind_mph: 100, pressure_mb: 955, category: 2, status: 'H2' },
      { lat: 33.5, lon: -83.5, time: '2018-10-11T12:00Z', wind_mph: 60, pressure_mb: 980, category: null, status: 'TS' },
    ],
  },
]

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

  const {
    datasets,
    activeDatasetId,
    aggregatedData,
    granularity,
    setGranularity,
  } = useIndemnityStore()

  const activeDataset = datasets.find((d) => d.id === activeDatasetId)

  // Combine historical events for the list (using first track point for hurricanes)
  const allHistoricalEvents: HistoricalEvent[] = [
    ...HISTORICAL_EARTHQUAKES.map(eq => ({ 
      ...eq, 
      type: 'earthquake' as const,
      date: eq.date,
    })),
    ...HISTORICAL_HURRICANES.map(h => ({ 
      id: h.id,
      name: h.name, 
      type: 'hurricane' as const,
      category: h.maxCategory,
      lat: h.track[Math.floor(h.track.length / 2)].lat, // midpoint of track
      lon: h.track[Math.floor(h.track.length / 2)].lon,
      date: h.track[0].time.split('T')[0],
      damage: h.damage,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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

    const maxTIV = Math.max(...dataToRender.map((d: any) => d.totalTIV || d.tiv))

    dataToRender.forEach((point: any) => {
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

    const selectedHurricanes = HISTORICAL_HURRICANES.filter(h => selectedEvents.includes(h.id))
    const selectedEarthquakes = HISTORICAL_EARTHQUAKES.filter(eq => selectedEvents.includes(eq.id))

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
      }).format(eq.damage)

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div style="padding: 12px; max-width: 280px;">
          <div style="font-weight: bold; font-size: 16px; color: #ef4444; margin-bottom: 8px;">
            🌍 ${eq.name}
          </div>
          <div style="font-size: 13px; color: #333;">
            <div style="margin-bottom: 4px;"><strong>Date:</strong> ${new Date(eq.date).toLocaleDateString()}</div>
            <div style="margin-bottom: 4px;"><strong>Magnitude:</strong> ${eq.magnitude}</div>
            <div style="margin-bottom: 4px;"><strong>Deaths:</strong> ${eq.deaths}</div>
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

    // Render hurricane tracks with GeoJSON
    if (selectedHurricanes.length > 0) {
      const trackFeatures: GeoJSON.Feature[] = []
      const pointFeatures: GeoJSON.Feature[] = []

      selectedHurricanes.forEach((hurricane) => {
        // Create line feature for the track
        const coordinates = hurricane.track.map(pt => [pt.lon, pt.lat])
        
        trackFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates,
          },
          properties: {
            name: hurricane.name,
            maxCategory: hurricane.maxCategory,
          },
        })

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
              color: getCategoryColor(pt.category),
              isLandfall: idx === hurricane.track.findIndex(p => p.category === hurricane.maxCategory),
            },
          })
        })
      })

      // Add source
      mapRef.current.addSource('hurricane-tracks', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [...trackFeatures, ...pointFeatures],
        },
      })

      // Add track line layer
      mapRef.current.addLayer({
        id: 'hurricane-tracks',
        type: 'line',
        source: 'hurricane-tracks',
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.8,
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
  }, [selectedEvents, isMapReady, showEvents, clearEventMarkers, activeDataset])

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

              {/* Event List */}
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
                        {event.type === 'earthquake' ? ` M${event.magnitude}` : ` Cat ${event.category}`}
                      </div>
                    </div>
                    {selectedEvents.includes(event.id) && (
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
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
