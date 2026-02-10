/**
 * map.js — MapLibre GL JS utilities for the Catastrophe Analysis Platform.
 *
 * Provides map initialization, layer management, color scales, and legend
 * building functions shared across all map-bearing pages.
 */

/* ===================================================================
 * Map Style Definitions
 * =================================================================== */

var MAP_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
};

var DEFAULT_MAP_CENTER = [-95, 38];
var DEFAULT_MAP_ZOOM = 4;


/* ===================================================================
 * Map Initialization
 * =================================================================== */

/**
 * Create and return a MapLibre GL map instance.
 *
 * @param {string} containerId - The DOM element ID for the map container.
 * @param {object} [options] - Additional MapLibre map options to merge.
 * @returns {maplibregl.Map} The initialized map instance.
 */
function initMap(containerId, options) {
  var defaults = {
    container: containerId,
    style: MAP_STYLES.dark,
    center: DEFAULT_MAP_CENTER,
    zoom: DEFAULT_MAP_ZOOM,
    attributionControl: true,
  };

  if (options) {
    for (var key in options) {
      if (options.hasOwnProperty(key)) {
        defaults[key] = options[key];
      }
    }
  }

  var map = new maplibregl.Map(defaults);
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 200 }), 'bottom-right');

  return map;
}


/* ===================================================================
 * Color Scales
 * =================================================================== */

/**
 * Get color for earthquake magnitude.
 *
 * @param {number} magnitude - Earthquake magnitude.
 * @returns {string} Hex color.
 */
function getMagnitudeColor(magnitude) {
  if (magnitude < 3) return '#22c55e';
  if (magnitude < 4) return '#84cc16';
  if (magnitude < 5) return '#eab308';
  if (magnitude < 6) return '#f97316';
  if (magnitude < 7) return '#ef4444';
  if (magnitude < 8) return '#dc2626';
  return '#7c2d12';
}

/**
 * Get human-readable label for earthquake magnitude.
 *
 * @param {number} magnitude - Earthquake magnitude.
 * @returns {string} Label (e.g. "Minor", "Strong").
 */
function getMagnitudeLabel(magnitude) {
  if (magnitude < 3) return 'Minor';
  if (magnitude < 4) return 'Light';
  if (magnitude < 5) return 'Light';
  if (magnitude < 6) return 'Moderate';
  if (magnitude < 7) return 'Strong';
  if (magnitude < 8) return 'Major';
  return 'Great';
}

/**
 * Get color for hurricane category (Saffir-Simpson scale).
 *
 * @param {number|null} category - Hurricane category (1–5) or null for TS/TD.
 * @returns {string} Hex color.
 */
function getCategoryColor(category) {
  if (category === null || category === undefined || category === 0) return '#3b82f6';
  if (category === 1) return '#22c55e';
  if (category === 2) return '#eab308';
  if (category === 3) return '#f97316';
  if (category === 4) return '#ef4444';
  if (category >= 5) return '#9333ea';
  return '#6b7280';
}

/**
 * Get color for wildfire based on FRP or confidence.
 *
 * @param {number} [confidence] - Detection confidence percentage.
 * @param {number} [frp] - Fire Radiative Power in MW.
 * @returns {string} Hex color.
 */
function getWildfireColor(confidence, frp) {
  if (frp !== undefined && frp !== null) {
    if (frp < 10) return '#fbbf24';
    if (frp < 50) return '#f97316';
    if (frp < 100) return '#ef4444';
    return '#dc2626';
  }
  if (confidence !== undefined && confidence !== null) {
    if (confidence < 50) return '#fbbf24';
    if (confidence < 80) return '#f97316';
    return '#ef4444';
  }
  return '#f97316';
}

/**
 * Get color for TIV value relative to maximum.
 *
 * @param {number} tiv - Total Insured Value.
 * @param {number} maxTIV - Maximum TIV in dataset.
 * @returns {string} Hex color.
 */
function getTIVColor(tiv, maxTIV) {
  var ratio = tiv / maxTIV;
  if (ratio > 0.8) return '#a855f7';
  if (ratio > 0.6) return '#c084fc';
  if (ratio > 0.4) return '#d8b4fe';
  if (ratio > 0.2) return '#e9d5ff';
  return '#f3e8ff';
}

/**
 * Get marker pixel size based on TIV value.
 *
 * @param {number} tiv - Total Insured Value.
 * @param {number} maxTIV - Maximum TIV in dataset.
 * @returns {number} Marker size in pixels.
 */
function getMarkerSize(tiv, maxTIV) {
  var ratio = tiv / maxTIV;
  return Math.max(8, Math.min(24, 8 + ratio * 16));
}


/* ===================================================================
 * Layer Management: Earthquakes
 * =================================================================== */

/**
 * Add earthquake circles to the map, sized by magnitude.
 *
 * @param {maplibregl.Map} map - The map instance.
 * @param {object} geojson - GeoJSON FeatureCollection of earthquake points.
 */
function addEarthquakeLayer(map, geojson) {
  // Remove existing layer/source if present
  removeLayerSafe(map, 'earthquakes-layer');
  removeSourceSafe(map, 'earthquakes-source');

  map.addSource('earthquakes-source', {
    type: 'geojson',
    data: geojson,
  });

  map.addLayer({
    id: 'earthquakes-layer',
    type: 'circle',
    source: 'earthquakes-source',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'magnitude'],
        2, 4,
        5, 8,
        7, 16,
        9, 32,
      ],
      'circle-color': [
        'interpolate', ['linear'], ['get', 'magnitude'],
        2, '#22c55e',
        4, '#eab308',
        6, '#ef4444',
        8, '#7c2d12',
      ],
      'circle-opacity': 0.7,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.4,
    },
  });

  // Click handler for popups
  map.on('click', 'earthquakes-layer', function (e) {
    if (!e.features || e.features.length === 0) return;
    var props = e.features[0].properties;
    var coords = e.features[0].geometry.coordinates.slice();

    new maplibregl.Popup({ offset: 15 })
      .setLngLat(coords)
      .setHTML(
        '<div style="padding:8px; max-width:220px;">' +
        '<div style="font-weight:bold; color:#333; margin-bottom:4px;">M ' + (props.magnitude || 0).toFixed(1) + ' Earthquake</div>' +
        '<div style="font-size:12px; color:#666;">' +
        '<div>' + escapeHtml(props.place || 'Unknown') + '</div>' +
        '<div>Depth: ' + (props.depth_km || 0).toFixed(1) + ' km</div>' +
        (props.event_time ? '<div>' + timeAgo(props.event_time) + '</div>' : '') +
        '</div></div>'
      )
      .addTo(map);
  });

  map.on('mouseenter', 'earthquakes-layer', function () {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'earthquakes-layer', function () {
    map.getCanvas().style.cursor = '';
  });
}


/* ===================================================================
 * Layer Management: Hurricane Tracks
 * =================================================================== */

/**
 * Add hurricane track lines to the map, colored by category.
 *
 * @param {maplibregl.Map} map - The map instance.
 * @param {object} geojson - GeoJSON FeatureCollection of LineString tracks.
 */
function addHurricaneTrackLayer(map, geojson) {
  removeLayerSafe(map, 'hurricane-tracks-layer');
  removeSourceSafe(map, 'hurricane-tracks-source');

  map.addSource('hurricane-tracks-source', {
    type: 'geojson',
    data: geojson,
  });

  map.addLayer({
    id: 'hurricane-tracks-layer',
    type: 'line',
    source: 'hurricane-tracks-source',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-width': 2.5,
      'line-color': [
        'match', ['get', 'category'],
        1, '#22c55e',
        2, '#eab308',
        3, '#f97316',
        4, '#ef4444',
        5, '#9333ea',
        '#3b82f6', // default — tropical storm
      ],
      'line-opacity': 0.8,
    },
  });

  map.on('click', 'hurricane-tracks-layer', function (e) {
    if (!e.features || e.features.length === 0) return;
    var props = e.features[0].properties;
    var coords = e.lngLat;

    var catLabel = props.category ? 'Category ' + props.category : 'Tropical Storm';
    new maplibregl.Popup({ offset: 15 })
      .setLngLat(coords)
      .setHTML(
        '<div style="padding:8px; max-width:220px;">' +
        '<div style="font-weight:bold; color:#333; margin-bottom:4px;">' + escapeHtml(props.name || 'Storm') + '</div>' +
        '<div style="font-size:12px; color:#666;">' +
        '<div>' + catLabel + '</div>' +
        (props.max_wind_mph ? '<div>Max winds: ' + props.max_wind_mph + ' mph</div>' : '') +
        (props.season ? '<div>Season: ' + props.season + '</div>' : '') +
        '</div></div>'
      )
      .addTo(map);
  });

  map.on('mouseenter', 'hurricane-tracks-layer', function () {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'hurricane-tracks-layer', function () {
    map.getCanvas().style.cursor = '';
  });
}


/* ===================================================================
 * Layer Management: Wildfires
 * =================================================================== */

/**
 * Add wildfire marker circles to the map.
 *
 * @param {maplibregl.Map} map - The map instance.
 * @param {object} geojson - GeoJSON FeatureCollection of fire points.
 */
function addWildfireLayer(map, geojson) {
  removeLayerSafe(map, 'wildfires-layer');
  removeSourceSafe(map, 'wildfires-source');

  map.addSource('wildfires-source', {
    type: 'geojson',
    data: geojson,
  });

  map.addLayer({
    id: 'wildfires-layer',
    type: 'circle',
    source: 'wildfires-source',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'frp'],
        0, 5,
        50, 10,
        200, 18,
      ],
      'circle-color': [
        'interpolate', ['linear'], ['get', 'frp'],
        0, '#fbbf24',
        50, '#f97316',
        150, '#ef4444',
      ],
      'circle-opacity': 0.75,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.3,
    },
  });

  map.on('click', 'wildfires-layer', function (e) {
    if (!e.features || e.features.length === 0) return;
    var props = e.features[0].properties;
    var coords = e.features[0].geometry.coordinates.slice();

    new maplibregl.Popup({ offset: 15 })
      .setLngLat(coords)
      .setHTML(
        '<div style="padding:8px; max-width:200px;">' +
        '<div style="font-weight:bold; color:#333; margin-bottom:4px;">🔥 ' + escapeHtml(props.name || 'Active Fire') + '</div>' +
        '<div style="font-size:12px; color:#666;">' +
        (props.frp ? '<div>FRP: ' + Number(props.frp).toFixed(1) + ' MW</div>' : '') +
        (props.confidence ? '<div>Confidence: ' + props.confidence + '%</div>' : '') +
        '</div></div>'
      )
      .addTo(map);
  });

  map.on('mouseenter', 'wildfires-layer', function () {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'wildfires-layer', function () {
    map.getCanvas().style.cursor = '';
  });
}


/* ===================================================================
 * Layer Management: Severe Weather
 * =================================================================== */

/**
 * Add severe weather alert polygons/points to the map.
 *
 * @param {maplibregl.Map} map - The map instance.
 * @param {object} geojson - GeoJSON FeatureCollection of alert features.
 */
function addSevereWeatherLayer(map, geojson) {
  removeLayerSafe(map, 'severe-fill-layer');
  removeLayerSafe(map, 'severe-outline-layer');
  removeLayerSafe(map, 'severe-points-layer');
  removeSourceSafe(map, 'severe-source');

  map.addSource('severe-source', {
    type: 'geojson',
    data: geojson,
  });

  // Fill layer for polygons
  map.addLayer({
    id: 'severe-fill-layer',
    type: 'fill',
    source: 'severe-source',
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'fill-color': '#8b5cf6',
      'fill-opacity': 0.2,
    },
  });

  // Outline for polygons
  map.addLayer({
    id: 'severe-outline-layer',
    type: 'line',
    source: 'severe-source',
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'line-color': '#8b5cf6',
      'line-width': 2,
      'line-opacity': 0.8,
    },
  });

  // Circle layer for point features
  map.addLayer({
    id: 'severe-points-layer',
    type: 'circle',
    source: 'severe-source',
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-radius': 8,
      'circle-color': '#8b5cf6',
      'circle-opacity': 0.7,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff',
    },
  });
}


/* ===================================================================
 * Layer Management: TIV Markers
 * =================================================================== */

/** Global store for TIV DOM markers so they can be removed. */
var tivMarkerInstances = [];

/**
 * Add TIV location markers to the map.
 *
 * @param {maplibregl.Map} map - The map instance.
 * @param {Array<{name:string, latitude:number, longitude:number, tiv:number}>} data - TIV records.
 */
function addTIVMarkers(map, data) {
  clearTIVMarkers();

  if (!data || data.length === 0) return;

  var maxTIV = Math.max.apply(null, data.map(function (d) { return d.tiv; }));

  data.forEach(function (point) {
    var size = getMarkerSize(point.tiv, maxTIV);
    var color = getTIVColor(point.tiv, maxTIV);

    var el = document.createElement('div');
    el.className = 'tiv-marker';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.backgroundColor = color;
    el.style.borderRadius = '50%';
    el.style.border = '2px solid rgba(168, 85, 247, 0.8)';
    el.style.cursor = 'pointer';
    el.style.opacity = '0.8';

    var popup = new maplibregl.Popup({ offset: 15 }).setHTML(
      '<div style="padding:8px; max-width:200px;">' +
      '<div style="font-weight:bold; margin-bottom:4px; color:#333;">' + escapeHtml(point.name || 'Location') + '</div>' +
      '<div style="font-size:12px; color:#666;">' +
      '<div><strong>TIV:</strong> ' + formatCurrency(point.tiv) + '</div>' +
      '</div></div>'
    );

    var marker = new maplibregl.Marker({ element: el })
      .setLngLat([point.longitude, point.latitude])
      .setPopup(popup)
      .addTo(map);

    tivMarkerInstances.push(marker);
  });
}

/**
 * Remove all TIV markers from the map.
 */
function clearTIVMarkers() {
  tivMarkerInstances.forEach(function (m) { m.remove(); });
  tivMarkerInstances = [];
}


/* ===================================================================
 * Utility Functions
 * =================================================================== */

/**
 * Safely remove a layer from the map if it exists.
 *
 * @param {maplibregl.Map} map - The map instance.
 * @param {string} layerId - Layer ID to remove.
 */
function removeLayerSafe(map, layerId) {
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
}

/**
 * Safely remove a source from the map if it exists.
 *
 * @param {maplibregl.Map} map - The map instance.
 * @param {string} sourceId - Source ID to remove.
 */
function removeSourceSafe(map, sourceId) {
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

/**
 * Convert an array of event objects to a GeoJSON FeatureCollection.
 *
 * @param {Array} events - Array of objects with latitude/longitude properties.
 * @param {object} [propMapping] - Maps property names: { lat, lng, ...extras }.
 * @returns {object} GeoJSON FeatureCollection.
 */
function toGeoJSONPoints(events, propMapping) {
  var latKey = (propMapping && propMapping.lat) || 'latitude';
  var lngKey = (propMapping && propMapping.lng) || 'longitude';

  return {
    type: 'FeatureCollection',
    features: events
      .filter(function (e) {
        return e[latKey] != null && e[lngKey] != null;
      })
      .map(function (e) {
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [Number(e[lngKey]), Number(e[latKey])],
          },
          properties: e,
        };
      }),
  };
}

/**
 * Build a legend DOM element for the map.
 *
 * @param {Array<{label:string, color:string}>} items - Legend entries.
 * @param {string} [title] - Legend title.
 * @returns {HTMLDivElement} The legend element.
 */
function buildLegend(items, title) {
  var container = document.createElement('div');
  container.className = 'bg-gray-800/95 backdrop-blur-sm rounded-lg border border-gray-700 p-3';

  if (title) {
    var heading = document.createElement('h4');
    heading.className = 'text-xs font-medium text-white mb-2';
    heading.textContent = title;
    container.appendChild(heading);
  }

  items.forEach(function (item) {
    var row = document.createElement('div');
    row.className = 'flex items-center gap-2 mb-1';
    var swatch = document.createElement('span');
    swatch.className = 'w-3 h-3 rounded-full';
    swatch.style.backgroundColor = item.color;
    row.appendChild(swatch);
    var label = document.createElement('span');
    label.className = 'text-xs text-gray-300';
    label.textContent = item.label;
    row.appendChild(label);
    container.appendChild(row);
  });

  return container;
}