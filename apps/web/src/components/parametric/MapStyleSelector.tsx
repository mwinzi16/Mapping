import { useState } from 'react'
import { Map, Layers, Sun, Moon, Globe, Mountain, ChevronDown, Lightbulb } from 'lucide-react'
import type { StyleSpecification } from 'maplibre-gl'

export interface MapStyleOption {
  id: string
  name: string
  url: string
  icon: React.ReactNode
  is3D?: boolean
  terrain?: boolean
  description?: string
}

export type MapStyleValue = string | StyleSpecification

// Free map style options
export const MAP_STYLES: MapStyleOption[] = [
  {
    id: 'dark',
    name: 'Dark',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    icon: <Moon className="w-4 h-4" />,
    description: 'Dark theme for night viewing',
  },
  {
    id: 'light',
    name: 'Light',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    icon: <Sun className="w-4 h-4" />,
    description: 'Light theme for day viewing',
  },
  {
    id: 'voyager',
    name: 'Voyager',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    icon: <Map className="w-4 h-4" />,
    description: 'Colorful detailed map',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    icon: <Globe className="w-4 h-4" />,
    description: 'ESRI World Imagery',
  },
  {
    id: 'night-lights',
    name: 'Night Lights',
    url: 'night-lights',
    icon: <Lightbulb className="w-4 h-4" />,
    description: 'Earth at night - population density',
  },
  {
    id: 'terrain',
    name: '3D Terrain',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    icon: <Mountain className="w-4 h-4" />,
    is3D: true,
    terrain: true,
    description: '3D terrain with elevation',
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    icon: <Layers className="w-4 h-4" />,
    description: 'Standard OSM tiles',
  },
]

// Generate a proper MapLibre style for raster tiles
export function generateRasterStyle(tileUrl: string, isDark: boolean = false): StyleSpecification {
  return {
    version: 8,
    sources: {
      'raster-tiles': {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        attribution: '© ESRI, OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'raster-layer',
        type: 'raster',
        source: 'raster-tiles',
        paint: {
          'raster-opacity': 1,
          'raster-brightness-min': isDark ? 0 : 0,
          'raster-brightness-max': isDark ? 0.6 : 1,
          'raster-saturation': isDark ? -0.3 : 0,
        },
      },
    ],
  }
}

// Generate style for NASA Earth at Night (Black Marble) - shows city lights
export function generateNightLightsStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      // NASA Black Marble - Earth at Night composite
      'black-marble': {
        type: 'raster',
        tiles: [
          'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/2012-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
        ],
        tileSize: 256,
        maxzoom: 8,
        attribution: '© NASA Earth Observatory',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#000000',
        },
      },
      {
        id: 'black-marble-layer',
        type: 'raster',
        source: 'black-marble',
        paint: {
          'raster-opacity': 1,
          'raster-brightness-min': 0.1,
          'raster-brightness-max': 1,
          'raster-contrast': 0.4,
          'raster-saturation': 0.3,
        },
      },
    ],
  }
}

// Generate 3D terrain style with proper hillshading and 3D buildings - day theme
export function generate3DTerrainStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'carto-voyager': {
        type: 'raster',
        tiles: [
          'https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© CARTO, OpenStreetMap contributors',
      },
      'terrain-dem': {
        type: 'raster-dem',
        tiles: [
          'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 15,
        encoding: 'terrarium',
        attribution: '© Mapzen, AWS Terrain Tiles',
      },
      'hillshade-source': {
        type: 'raster-dem',
        tiles: [
          'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 15,
        encoding: 'terrarium',
      },
      // OpenMapTiles vector source for buildings
      'openmaptiles': {
        type: 'vector',
        url: 'https://api.maptiler.com/tiles/v3/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
        attribution: '© MapTiler, OpenStreetMap contributors',
      },
    },
    terrain: {
      source: 'terrain-dem',
      exaggeration: 1.5,
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#e8e0d8',
        },
      },
      {
        id: 'base-map',
        type: 'raster',
        source: 'carto-voyager',
        paint: {
          'raster-opacity': 0.9,
        },
      },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'hillshade-source',
        paint: {
          'hillshade-exaggeration': 0.5,
          'hillshade-shadow-color': '#000000',
          'hillshade-highlight-color': '#ffffff',
          'hillshade-accent-color': '#4a90d9',
        },
      },
      // 3D Buildings layer
      {
        id: 'building-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 1,
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'render_height'],
            0, '#d4c4b0',
            50, '#c9b8a3',
            100, '#bfad97',
            200, '#b5a28b',
          ],
          'fill-extrusion-height': ['get', 'render_height'],
          'fill-extrusion-base': ['get', 'render_min_height'],
          'fill-extrusion-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1, 0.5,
            10, 0.7,
            14, 0.85,
          ],
        },
      },
    ],
  }
}

interface MapStyleSelectorProps {
  currentStyleId: string
  onStyleChange: (style: MapStyleOption) => void
  className?: string
}

export default function MapStyleSelector({
  currentStyleId,
  onStyleChange,
  className = '',
}: MapStyleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentStyle = MAP_STYLES.find((s) => s.id === currentStyleId) || MAP_STYLES[0]

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg shadow-lg transition-colors"
      >
        {currentStyle.icon}
        <span className="text-sm font-medium">{currentStyle.name}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden z-20">
            <div className="py-1">
              {MAP_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => {
                    onStyleChange(style)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-left transition-colors ${
                    style.id === currentStyleId
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span
                    className={
                      style.id === currentStyleId ? 'text-white' : 'text-gray-400'
                    }
                  >
                    {style.icon}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{style.name}</div>
                    {style.description && (
                      <div
                        className={`text-xs ${
                          style.id === currentStyleId
                            ? 'text-blue-200'
                            : 'text-gray-500'
                        }`}
                      >
                        {style.description}
                      </div>
                    )}
                  </div>
                  {style.is3D && (
                    <span className="text-xs px-1.5 py-0.5 bg-purple-600 text-white rounded">
                      3D
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
