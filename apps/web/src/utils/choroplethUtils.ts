/**
 * Choropleth visualization utilities for TIV data at state/country granularity.
 * Uses publicly available GeoJSON boundary data.
 */
import maplibregl from 'maplibre-gl'
import type { AggregatedTIV, TIVGranularity } from '../types/indemnity'

// Public GeoJSON sources for boundaries
const BOUNDARY_SOURCES = {
  // Natural Earth countries (simplified for performance)
  countries: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
  // US states from public domain source
  usStates: 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
}

// Cache for loaded boundary data
const boundaryCache: Record<string, any> = {}

// Store active popup reference
let activePopup: maplibregl.Popup | null = null

// Color stops for data-driven styling (from low to high TIV)
const COLOR_STOPS: [number, string][] = [
  [0, '#f3e8ff'],     // purple-100
  [0.1, '#e9d5ff'],   // purple-200
  [0.25, '#d8b4fe'],  // purple-300
  [0.4, '#c084fc'],   // purple-400
  [0.6, '#a855f7'],   // purple-500
  [0.8, '#9333ea'],   // purple-600
  [0.95, '#7e22ce'],  // purple-700
]

/**
 * Determines if a granularity level should use choropleth visualization
 */
export function shouldUseChoropleth(granularity: TIVGranularity): boolean {
  return granularity === 'state' || granularity === 'country'
}

/**
 * Load boundary GeoJSON data
 */
async function loadBoundaries(type: 'countries' | 'usStates'): Promise<any> {
  if (boundaryCache[type]) {
    return boundaryCache[type]
  }

  try {
    console.log(`Loading ${type} boundaries from:`, BOUNDARY_SOURCES[type])
    const response = await fetch(BOUNDARY_SOURCES[type])
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const data = await response.json()
    console.log(`Loaded ${type} boundaries:`, data.features?.length, 'features')
    boundaryCache[type] = data
    return data
  } catch (error) {
    console.error(`Failed to load ${type} boundaries:`, error)
    return null
  }
}

/**
 * Get interpolated color based on TIV ratio
 */
function getColorForRatio(ratio: number): string {
  for (let i = COLOR_STOPS.length - 1; i >= 0; i--) {
    if (ratio >= COLOR_STOPS[i][0]) {
      return COLOR_STOPS[i][1]
    }
  }
  return COLOR_STOPS[0][1]
}

/**
 * Match aggregated data to boundary features and enrich with TIV data
 */
function matchDataToBoundaries(
  boundaries: any,
  aggregatedData: AggregatedTIV[],
  granularity: TIVGranularity
): any {
  if (!boundaries || !boundaries.features) {
    console.warn('No boundaries or features found')
    return null
  }

  const maxTIV = Math.max(...aggregatedData.map(d => d.totalTIV), 1)
  console.log('Max TIV for color scaling:', maxTIV)
  
  // Create lookup map for aggregated data (multiple key formats for matching)
  const dataLookup = new Map<string, AggregatedTIV>()
  aggregatedData.forEach(item => {
    const normalizedKey = item.name.toLowerCase().trim()
    dataLookup.set(normalizedKey, item)
    // Also add common abbreviation mappings for US states
    const stateAbbrevs: Record<string, string> = {
      'alabama': 'al', 'alaska': 'ak', 'arizona': 'az', 'arkansas': 'ar', 'california': 'ca',
      'colorado': 'co', 'connecticut': 'ct', 'delaware': 'de', 'florida': 'fl', 'georgia': 'ga',
      'hawaii': 'hi', 'idaho': 'id', 'illinois': 'il', 'indiana': 'in', 'iowa': 'ia',
      'kansas': 'ks', 'kentucky': 'ky', 'louisiana': 'la', 'maine': 'me', 'maryland': 'md',
      'massachusetts': 'ma', 'michigan': 'mi', 'minnesota': 'mn', 'mississippi': 'ms', 'missouri': 'mo',
      'montana': 'mt', 'nebraska': 'ne', 'nevada': 'nv', 'new hampshire': 'nh', 'new jersey': 'nj',
      'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', 'ohio': 'oh',
      'oklahoma': 'ok', 'oregon': 'or', 'pennsylvania': 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
      'south dakota': 'sd', 'tennessee': 'tn', 'texas': 'tx', 'utah': 'ut', 'vermont': 'vt',
      'virginia': 'va', 'washington': 'wa', 'west virginia': 'wv', 'wisconsin': 'wi', 'wyoming': 'wy'
    }
    // Add reverse mapping
    if (stateAbbrevs[normalizedKey]) {
      dataLookup.set(stateAbbrevs[normalizedKey], item)
    }
  })

  console.log('Data lookup keys:', Array.from(dataLookup.keys()))

  // Enrich features with TIV data
  const enrichedFeatures = boundaries.features.map((feature: any) => {
    let matchKey = ''
    let displayName = ''
    
    if (granularity === 'country') {
      displayName = feature.properties.ADMIN || feature.properties.name || feature.properties.NAME || 'Unknown'
      matchKey = displayName.toLowerCase().trim()
    } else if (granularity === 'state') {
      displayName = feature.properties.name || feature.properties.NAME || feature.properties.state || 'Unknown'
      matchKey = displayName.toLowerCase().trim()
    }

    const matchedData = dataLookup.get(matchKey)
    const tiv = matchedData?.totalTIV || 0
    const ratio = maxTIV > 0 ? tiv / maxTIV : 0
    const recordCount = matchedData?.recordCount || 0
    const color = tiv > 0 ? getColorForRatio(ratio) : '#808080'

    return {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        name: displayName,
        tiv: tiv,
        tivRatio: ratio,
        recordCount: recordCount,
        hasData: tiv > 0,
        fillColor: color,
      }
    }
  })

  const featuresWithData = enrichedFeatures.filter((f: any) => f.properties.hasData)
  console.log(`Matched ${featuresWithData.length} of ${enrichedFeatures.length} features with TIV data`)

  return {
    type: 'FeatureCollection',
    features: enrichedFeatures,
  }
}

/**
 * Remove choropleth layers from the map
 */
export function removeChoropleth(map: maplibregl.Map): void {
  // Remove popup
  if (activePopup) {
    activePopup.remove()
    activePopup = null
  }

  const layerIds = ['tiv-choropleth-fill', 'tiv-choropleth-outline']
  
  layerIds.forEach(id => {
    if (map.getLayer(id)) {
      map.removeLayer(id)
    }
  })

  if (map.getSource('tiv-choropleth')) {
    map.removeSource('tiv-choropleth')
  }
}

/**
 * Add or update choropleth layer on the map
 */
export async function renderChoropleth(
  map: maplibregl.Map,
  aggregatedData: AggregatedTIV[],
  granularity: TIVGranularity,
  formatTIV: (tiv: number, currency: string) => string,
  currency: string = 'USD'
): Promise<void> {
  console.log('renderChoropleth called with', aggregatedData.length, 'data points, granularity:', granularity)
  
  // Remove existing choropleth layers first
  removeChoropleth(map)

  if (!shouldUseChoropleth(granularity)) {
    console.log('Granularity does not require choropleth')
    return
  }
  
  if (aggregatedData.length === 0) {
    console.log('No aggregated data to render')
    return
  }

  // Load appropriate boundary data
  const boundaryType = granularity === 'country' ? 'countries' : 'usStates'
  const boundaries = await loadBoundaries(boundaryType)
  
  if (!boundaries) {
    console.warn('Failed to load boundary data for choropleth')
    return
  }

  // Match data to boundaries
  const enrichedData = matchDataToBoundaries(boundaries, aggregatedData, granularity)
  if (!enrichedData) {
    console.warn('Failed to match data to boundaries')
    return
  }

  try {
    // Add source
    map.addSource('tiv-choropleth', {
      type: 'geojson',
      data: enrichedData,
    })

    // Add fill layer - use step expression for color based on tivRatio
    map.addLayer({
      id: 'tiv-choropleth-fill',
      type: 'fill',
      source: 'tiv-choropleth',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'hasData'], true],
          [
            'step',
            ['get', 'tivRatio'],
            '#f3e8ff',  // default (0-0.1)
            0.1, '#e9d5ff',
            0.25, '#d8b4fe',
            0.4, '#c084fc',
            0.6, '#a855f7',
            0.8, '#9333ea',
            0.95, '#7e22ce'
          ],
          'rgba(128, 128, 128, 0.2)'  // no data color
        ],
        'fill-opacity': [
          'case',
          ['==', ['get', 'hasData'], true],
          0.7,
          0.1
        ],
      },
    })

    // Add outline layer
    map.addLayer({
      id: 'tiv-choropleth-outline',
      type: 'line',
      source: 'tiv-choropleth',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'hasData'], true],
          '#9333ea',
          '#666666'
        ],
        'line-width': [
          'case',
          ['==', ['get', 'hasData'], true],
          2,
          0.5
        ],
        'line-opacity': [
          'case',
          ['==', ['get', 'hasData'], true],
          0.9,
          0.3
        ],
      },
    })

    console.log('Choropleth layers added successfully')

    // Create popup for hover
    activePopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    })

    // Mouse enter handler
    const onMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }

    // Mouse move handler for popup
    const onMouseMove = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features || e.features.length === 0 || !activePopup) return
      
      const feature = e.features[0]
      const props = feature.properties
      
      if (!props || !props.hasData) {
        activePopup.remove()
        return
      }

      const name = props.name || 'Unknown'
      const tiv = props.tiv || 0
      const count = props.recordCount || 0

      activePopup
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="padding: 8px; max-width: 200px;">
            <div style="font-weight: bold; margin-bottom: 4px; color: #333;">${name}</div>
            <div style="font-size: 12px; color: #666;">
              <div><strong>TIV:</strong> ${formatTIV(tiv, currency)}</div>
              <div><strong>Locations:</strong> ${count}</div>
            </div>
          </div>
        `)
        .addTo(map)
    }

    // Mouse leave handler
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = ''
      if (activePopup) {
        activePopup.remove()
      }
    }

    // Add event handlers
    map.on('mouseenter', 'tiv-choropleth-fill', onMouseEnter)
    map.on('mousemove', 'tiv-choropleth-fill', onMouseMove)
    map.on('mouseleave', 'tiv-choropleth-fill', onMouseLeave)

  } catch (error) {
    console.error('Error rendering choropleth:', error)
  }
}

/**
 * Create a choropleth legend component data
 */
export function getChoroplethLegendStops(maxTIV: number, formatTIV: (tiv: number, currency: string) => string, currency: string): Array<{ color: string; label: string }> {
  return COLOR_STOPS.map((stop, index) => ({
    color: stop[1],
    label: index === 0 
      ? formatTIV(0, currency)
      : formatTIV(Math.round(stop[0] * maxTIV), currency),
  }))
}
