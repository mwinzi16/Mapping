/**
 * indemnity.js — JavaScript for indemnity live cat and historical pages.
 *
 * Handles TIV CSV file parsing, marker generation, historical event
 * loading/selection, impact analysis, and layer toggle management.
 */

/* ===================================================================
 * State
 * =================================================================== */

var indemnityState = {
  map: null,
  tivData: [],
  liveEvents: { earthquakes: [], hurricanes: [], wildfires: [], severe: [] },
  historicalEarthquakes: [],
  historicalHurricanes: [],
  selectedEvents: [],
  showTIV: true,
  showEvents: true,
  loadMode: 'top30',
  typeFilter: 'all',
  searchQuery: '',
  pageMode: null, // 'live' or 'historical'
  eventMarkers: [],
  tivMarkerInstances: [],
};


/* ===================================================================
 * Live Page Initialization
 * =================================================================== */

/**
 * Initialize the indemnity live cat page.
 */
function initIndemnityLivePage() {
  indemnityState.pageMode = 'live';
  indemnityState.map = initMap('indemnity-live-map', {
    center: [-95, 38],
    zoom: 4,
  });

  indemnityState.map.on('load', function () {
    fetchLiveEvents();
    // Show legend
    var legend = document.getElementById('indemnity-legend');
    if (legend) legend.classList.remove('hidden');
  });
}

/**
 * Fetch all live event data from APIs and update counts.
 */
function fetchLiveEvents() {
  var endpoints = [
    { url: '/api/v1/earthquakes/recent', key: 'earthquakes', countEl: 'live-eq-count' },
    { url: '/api/v1/hurricanes/active', key: 'hurricanes', countEl: 'live-tc-count' },
    { url: '/api/v1/wildfires/', key: 'wildfires', countEl: 'live-fire-count' },
    { url: '/api/v1/severe-weather/', key: 'severe', countEl: 'live-sw-count' },
  ];

  endpoints.forEach(function (ep) {
    fetch(ep.url)
      .then(function (res) { return res.ok ? res.json() : { data: [] }; })
      .then(function (json) {
        var data = json.data || json;
        if (!Array.isArray(data)) data = [];
        indemnityState.liveEvents[ep.key] = data;

        var countEl = document.getElementById(ep.countEl);
        if (countEl) countEl.textContent = data.length;

        renderLiveEventMarkers();
      })
      .catch(function () {
        var countEl = document.getElementById(ep.countEl);
        if (countEl) countEl.textContent = '0';
      });
  });
}

/**
 * Render live event markers on the map.
 */
function renderLiveEventMarkers() {
  if (!indemnityState.map || !indemnityState.showEvents) return;

  clearEventMarkers();

  var events = indemnityState.liveEvents;

  // Earthquake markers
  if (events.earthquakes && events.earthquakes.length > 0) {
    var eqGeoJSON = toGeoJSONPoints(events.earthquakes);
    if (indemnityState.map.loaded()) {
      addEarthquakeLayer(indemnityState.map, eqGeoJSON);
    }
  }

  // Other event types as simple markers
  var otherEvents = [];
  if (events.hurricanes) otherEvents = otherEvents.concat(events.hurricanes.map(function (h) { return { lat: h.latitude, lon: h.longitude, name: h.name, type: 'hurricane', color: '#3b82f6' }; }));
  if (events.wildfires) otherEvents = otherEvents.concat(events.wildfires.map(function (f) { return { lat: f.latitude, lon: f.longitude, name: f.name || 'Active Fire', type: 'wildfire', color: '#f97316' }; }));
  if (events.severe) otherEvents = otherEvents.concat(events.severe.map(function (s) { return { lat: s.latitude, lon: s.longitude, name: s.headline || 'Weather Alert', type: 'severe', color: '#8b5cf6' }; }));

  otherEvents.forEach(function (evt) {
    if (evt.lat == null || evt.lon == null) return;
    var el = document.createElement('div');
    el.style.width = '12px';
    el.style.height = '12px';
    el.style.backgroundColor = evt.color;
    el.style.borderRadius = '50%';
    el.style.border = '2px solid rgba(255,255,255,0.6)';
    el.style.cursor = 'pointer';

    var popup = new maplibregl.Popup({ offset: 10 }).setHTML(
      '<div style="padding:6px; max-width:180px;"><div style="font-weight:bold; color:#333; font-size:13px;">' +
      escapeHtml(evt.name) + '</div><div style="font-size:11px; color:#666; text-transform:capitalize;">' +
      evt.type + '</div></div>'
    );

    var marker = new maplibregl.Marker({ element: el })
      .setLngLat([evt.lon, evt.lat])
      .setPopup(popup)
      .addTo(indemnityState.map);

    indemnityState.eventMarkers.push(marker);
  });
}


/* ===================================================================
 * Historical Page Initialization
 * =================================================================== */

/**
 * Initialize the indemnity historical page.
 */
function initIndemnityHistoricalPage() {
  indemnityState.pageMode = 'historical';
  indemnityState.map = initMap('indemnity-hist-map', {
    center: [-60, 25],
    zoom: 3,
  });

  indemnityState.map.on('load', function () {
    loadHistoricalEvents();
    var legend = document.getElementById('hist-legend');
    if (legend) legend.classList.remove('hidden');
  });
}

/**
 * Load historical events from the API.
 */
function loadHistoricalEvents() {
  var spinner = document.getElementById('hist-load-spinner');
  if (spinner) spinner.classList.remove('hidden');
  var errorEl = document.getElementById('hist-load-error');
  if (errorEl) errorEl.classList.add('hidden');

  var loading = document.getElementById('indemnity-hist-loading');
  if (loading) loading.classList.remove('hidden');

  var limit = indemnityState.loadMode === 'all' ? 1000 : parseInt(indemnityState.loadMode.replace('top', '')) || 30;

  Promise.all([
    fetch('/api/v1/indemnity/historical/earthquakes?limit=' + limit + '&mode=significant')
      .then(function (r) { return r.ok ? r.json() : { data: [] }; }),
    fetch('/api/v1/indemnity/historical/hurricanes?limit=' + limit + '&mode=significant')
      .then(function (r) { return r.ok ? r.json() : { data: [] }; }),
  ])
    .then(function (results) {
      var eqData = results[0].data || results[0] || [];
      var tcData = results[1].data || results[1] || [];
      indemnityState.historicalEarthquakes = Array.isArray(eqData) ? eqData : [];
      indemnityState.historicalHurricanes = Array.isArray(tcData) ? tcData : [];

      renderHistoricalEventList();
      renderHistoricalEventsOnMap();

      if (loading) loading.classList.add('hidden');
      showToast((indemnityState.historicalEarthquakes.length + indemnityState.historicalHurricanes.length) + ' historical events loaded', 'success');
    })
    .catch(function (err) {
      if (errorEl) {
        errorEl.textContent = 'Failed to load: ' + err.message;
        errorEl.classList.remove('hidden');
      }
      if (loading) loading.classList.add('hidden');
      showToast('Failed to load historical events', 'error');
    })
    .finally(function () {
      if (spinner) spinner.classList.add('hidden');
    });
}


/* ===================================================================
 * Historical Event List
 * =================================================================== */

/**
 * Render the historical event list in the sidebar.
 */
function renderHistoricalEventList() {
  var allEvents = getAllHistoricalEvents();
  var filtered = filterHistoricalEventList(allEvents);

  var countEl = document.getElementById('hist-event-count');
  if (countEl) countEl.textContent = '(' + filtered.length + ')';

  var list = document.getElementById('hist-event-list');
  if (!list) return;

  if (filtered.length === 0) {
    list.innerHTML = '<li class="p-4 text-center text-gray-500 text-sm">No events match your criteria</li>';
    return;
  }

  list.innerHTML = filtered.map(function (evt) {
    var isSelected = indemnityState.selectedEvents.indexOf(evt.id) !== -1;
    var bgClass = isSelected ? 'bg-blue-900/30' : '';
    var icon = evt.type === 'earthquake'
      ? '<div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style="background-color:' + getMagnitudeColor(evt.magnitude || 6) + '">M' + (evt.magnitude || 0).toFixed(0) + '</div>'
      : '<div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style="background-color:' + getCategoryColor(evt.category) + '">' + (evt.category ? 'C' + evt.category : 'TS') + '</div>';

    return '<li class="p-3 hover:bg-gray-700 cursor-pointer transition-colors ' + bgClass + '" onclick="toggleEventSelection(\'' + evt.id + '\')">' +
      '<div class="flex items-center gap-3">' +
      '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' class="w-4 h-4 rounded bg-gray-700 border-gray-600" onclick="event.stopPropagation(); toggleEventSelection(\'' + evt.id + '\')">' +
      icon +
      '<div class="flex-1 min-w-0">' +
      '<p class="text-sm text-white truncate">' + escapeHtml(evt.name) + '</p>' +
      '<p class="text-xs text-gray-400">' + evt.date + '</p>' +
      '</div>' +
      '</div></li>';
  }).join('');
}

/**
 * Get all historical events combined and sorted by significance.
 *
 * @returns {Array} Combined events array.
 */
function getAllHistoricalEvents() {
  var events = [];

  indemnityState.historicalEarthquakes.forEach(function (eq) {
    events.push({
      id: eq.id || 'eq-' + (eq.latitude || 0) + '-' + (eq.longitude || 0),
      name: eq.name || eq.place || 'Earthquake M' + (eq.magnitude || 0).toFixed(1),
      type: 'earthquake',
      magnitude: eq.magnitude,
      lat: eq.latitude || eq.lat,
      lon: eq.longitude || eq.lon,
      date: eq.date || (eq.event_time ? eq.event_time.split('T')[0] : 'Unknown'),
      significance_score: eq.significance_score || eq.magnitude * 10 || 0,
      data: eq,
    });
  });

  indemnityState.historicalHurricanes.forEach(function (h) {
    var midTrack = h.track && h.track.length > 0
      ? h.track[Math.floor(h.track.length / 2)]
      : { lat: 0, lon: 0 };

    events.push({
      id: h.id || h.storm_id || 'tc-' + h.name,
      name: h.name || 'Unnamed Storm',
      type: 'hurricane',
      category: h.max_category || h.category,
      lat: midTrack.lat || midTrack.latitude,
      lon: midTrack.lon || midTrack.longitude,
      date: h.track && h.track.length > 0 ? (h.track[0].time || '').split('T')[0] : h.season + '',
      significance_score: h.significance_score || (h.max_category || 1) * 20 || 0,
      data: h,
    });
  });

  events.sort(function (a, b) { return b.significance_score - a.significance_score; });
  return events;
}

/**
 * Filter the event list by type and search query.
 *
 * @param {Array} events - All events.
 * @returns {Array} Filtered events.
 */
function filterHistoricalEventList(events) {
  return events.filter(function (evt) {
    if (indemnityState.typeFilter !== 'all' && evt.type !== indemnityState.typeFilter) return false;
    if (indemnityState.searchQuery && evt.name.toLowerCase().indexOf(indemnityState.searchQuery.toLowerCase()) === -1) return false;
    return true;
  });
}

/**
 * Handle search/filter input changes.
 */
function filterHistoricalEvents() {
  var input = document.getElementById('hist-search-input');
  if (input) indemnityState.searchQuery = input.value;
  renderHistoricalEventList();
}


/* ===================================================================
 * Historical Event Selection
 * =================================================================== */

/**
 * Toggle selection of a historical event.
 *
 * @param {string} eventId - The event ID to toggle.
 */
function toggleEventSelection(eventId) {
  var idx = indemnityState.selectedEvents.indexOf(eventId);
  if (idx === -1) {
    indemnityState.selectedEvents.push(eventId);
  } else {
    indemnityState.selectedEvents.splice(idx, 1);
  }
  renderHistoricalEventList();
  renderHistoricalEventsOnMap();
  calculateImpactAnalysis();
}


/* ===================================================================
 * Historical Map Rendering
 * =================================================================== */

/**
 * Render historical events on the map.
 */
function renderHistoricalEventsOnMap() {
  if (!indemnityState.map || !indemnityState.map.loaded()) return;
  if (!indemnityState.showEvents) return;

  var map = indemnityState.map;

  // Clear existing event layers
  removeLayerSafe(map, 'hist-eq-layer');
  removeSourceSafe(map, 'hist-eq-source');
  removeLayerSafe(map, 'hist-tc-layer');
  removeSourceSafe(map, 'hist-tc-source');
  clearEventMarkers();

  // Earthquake points
  var eqFeatures = indemnityState.historicalEarthquakes
    .filter(function (eq) { return eq.latitude != null && eq.longitude != null; })
    .map(function (eq) {
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [eq.longitude || eq.lon, eq.latitude || eq.lat] },
        properties: { magnitude: eq.magnitude, place: eq.name || eq.place, event_time: eq.event_time || eq.date },
      };
    });

  if (eqFeatures.length > 0) {
    addEarthquakeLayer(map, { type: 'FeatureCollection', features: eqFeatures });
  }

  // Hurricane tracks
  var tcFeatures = [];
  indemnityState.historicalHurricanes.forEach(function (h) {
    if (!h.track || h.track.length < 2) return;
    var coords = h.track.map(function (pt) { return [pt.lon || pt.longitude, pt.lat || pt.latitude]; });
    tcFeatures.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { name: h.name, category: h.max_category || h.category || 0, season: h.season },
    });
  });

  if (tcFeatures.length > 0) {
    addHurricaneTrackLayer(map, { type: 'FeatureCollection', features: tcFeatures });
  }
}


/* ===================================================================
 * Impact Analysis
 * =================================================================== */

/**
 * Calculate impact analysis — which TIV locations fall within selected event radii.
 */
function calculateImpactAnalysis() {
  var badge = document.getElementById('hist-impact-badge');
  if (!badge) return;

  if (indemnityState.selectedEvents.length === 0 || indemnityState.tivData.length === 0) {
    badge.classList.add('hidden');
    return;
  }

  badge.classList.remove('hidden');

  var allEvents = getAllHistoricalEvents();
  var selected = allEvents.filter(function (evt) {
    return indemnityState.selectedEvents.indexOf(evt.id) !== -1;
  });

  // Simple radius-based impact: 200km for EQ, 300km for TC
  var affectedLocations = 0;
  var affectedTIV = 0;

  indemnityState.tivData.forEach(function (loc) {
    var impacted = selected.some(function (evt) {
      var radius = evt.type === 'earthquake' ? 200 : 300; // km
      var dist = haversineDistance(loc.latitude, loc.longitude, evt.lat, evt.lon);
      return dist <= radius;
    });
    if (impacted) {
      affectedLocations++;
      affectedTIV += loc.tiv || 0;
    }
  });

  document.getElementById('impact-event-count').textContent = selected.length;
  document.getElementById('impact-tiv-value').textContent = formatCurrency(affectedTIV);
  document.getElementById('impact-location-count').textContent = affectedLocations;
}

/**
 * Calculate Haversine distance between two points in km.
 *
 * @param {number} lat1 - Latitude of point 1.
 * @param {number} lon1 - Longitude of point 1.
 * @param {number} lat2 - Latitude of point 2.
 * @param {number} lon2 - Longitude of point 2.
 * @returns {number} Distance in kilometers.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


/* ===================================================================
 * TIV CSV Parsing & Management
 * =================================================================== */

/**
 * Handle TIV CSV file drop on the live page dropzone.
 *
 * @param {DragEvent} event - The drop event.
 */
function handleTIVDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('border-green-500', 'bg-green-900/10');
  var file = event.dataTransfer.files[0];
  if (file) parseTIVFile(file, 'live');
}

/**
 * Handle TIV file selection via file input on live page.
 *
 * @param {Event} event - The change event.
 */
function handleTIVFileSelect(event) {
  var file = event.target.files[0];
  if (file) parseTIVFile(file, 'live');
}

/**
 * Handle TIV CSV file drop on the historical page dropzone.
 *
 * @param {DragEvent} event - The drop event.
 */
function handleHistTIVDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('border-green-500', 'bg-green-900/10');
  var file = event.dataTransfer.files[0];
  if (file) parseTIVFile(file, 'historical');
}

/**
 * Handle TIV file selection via file input on historical page.
 *
 * @param {Event} event - The change event.
 */
function handleHistTIVFileSelect(event) {
  var file = event.target.files[0];
  if (file) parseTIVFile(file, 'historical');
}

/**
 * Parse a TIV CSV file and add markers to the map.
 *
 * @param {File} file - The CSV file to parse.
 * @param {'live'|'historical'} mode - Which page context.
 */
function parseTIVFile(file, mode) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var text = e.target.result;
    var lines = text.split('\n').filter(function (l) { return l.trim(); });
    if (lines.length < 2) {
      showToast('CSV file appears empty', 'warning');
      return;
    }

    var headers = lines[0].split(',').map(function (h) { return h.trim().toLowerCase(); });
    var nameIdx = findColumnIndex(headers, ['name', 'location', 'address', 'site']);
    var latIdx = findColumnIndex(headers, ['lat', 'latitude']);
    var lonIdx = findColumnIndex(headers, ['lon', 'lng', 'longitude']);
    var tivIdx = findColumnIndex(headers, ['tiv', 'total_insured_value', 'insured_value', 'value']);

    if (latIdx === -1 || lonIdx === -1 || tivIdx === -1) {
      showToast('CSV must contain lat, lon, and tiv columns', 'error');
      return;
    }

    var records = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = parseCSVLine(lines[i]);
      var lat = parseFloat(cols[latIdx]);
      var lon = parseFloat(cols[lonIdx]);
      var tiv = parseFloat(cols[tivIdx]);

      if (isNaN(lat) || isNaN(lon) || isNaN(tiv)) continue;

      records.push({
        name: nameIdx >= 0 ? cols[nameIdx] : 'Location ' + i,
        latitude: lat,
        longitude: lon,
        tiv: tiv,
      });
    }

    indemnityState.tivData = records;

    // Update UI
    var prefix = mode === 'live' ? '' : 'hist-';
    var summaryEl = document.getElementById(prefix + 'tiv-data-summary');
    var dropzoneEl = document.getElementById(prefix + 'tiv-dropzone') || document.getElementById(prefix.replace('-', '') + 'tiv-dropzone');
    var fileNameEl = document.getElementById(prefix + 'tiv-file-name');
    var countEl = document.getElementById(prefix + 'tiv-record-count');

    if (summaryEl) summaryEl.classList.remove('hidden');
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (countEl) countEl.textContent = records.length;

    // Render markers on map
    addTIVMarkers(indemnityState.map, records);

    showToast(records.length + ' TIV locations loaded', 'success');

    // Update statistics
    updateIndemnityStatistics(mode);
  };
  reader.readAsText(file);
}

/**
 * Find the index of a column by checking multiple possible header names.
 *
 * @param {Array<string>} headers - All header names (lowercase).
 * @param {Array<string>} candidates - Possible names to match.
 * @returns {number} Column index, or -1 if not found.
 */
function findColumnIndex(headers, candidates) {
  for (var i = 0; i < headers.length; i++) {
    for (var j = 0; j < candidates.length; j++) {
      if (headers[i] === candidates[j]) return i;
    }
  }
  return -1;
}

/**
 * Parse a single CSV line handling quoted values.
 *
 * @param {string} line - A CSV line.
 * @returns {Array<string>} Parsed column values.
 */
function parseCSVLine(line) {
  var result = [];
  var current = '';
  var inQuotes = false;

  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Clear TIV data from the live page.
 */
function clearTIVData() {
  indemnityState.tivData = [];
  clearTIVMarkers();
  var summary = document.getElementById('tiv-data-summary');
  if (summary) summary.classList.add('hidden');
  showToast('TIV data cleared', 'info');
}

/**
 * Clear TIV data from the historical page.
 */
function clearHistTIVData() {
  indemnityState.tivData = [];
  clearTIVMarkers();
  var summary = document.getElementById('hist-tiv-data-summary');
  if (summary) summary.classList.add('hidden');
  showToast('TIV data cleared', 'info');
}


/* ===================================================================
 * Statistics
 * =================================================================== */

/**
 * Update indemnity statistics display.
 *
 * @param {'live'|'historical'} mode - Page mode.
 */
function updateIndemnityStatistics(mode) {
  var statsId = mode === 'live' ? 'indemnity-statistics' : 'hist-statistics';
  var statsEl = document.getElementById(statsId);
  if (!statsEl || indemnityState.tivData.length === 0) return;

  var data = indemnityState.tivData;
  var totalTIV = data.reduce(function (sum, d) { return sum + d.tiv; }, 0);
  var avgTIV = totalTIV / data.length;
  var maxTIV = Math.max.apply(null, data.map(function (d) { return d.tiv; }));

  statsEl.innerHTML =
    '<div class="bg-gray-700/50 rounded-lg p-3">' +
    '<div class="text-xs text-gray-400">Total Locations</div>' +
    '<div class="text-lg font-bold text-white">' + data.length.toLocaleString() + '</div>' +
    '</div>' +
    '<div class="bg-gray-700/50 rounded-lg p-3">' +
    '<div class="text-xs text-gray-400">Total TIV</div>' +
    '<div class="text-lg font-bold text-purple-400">' + formatCurrency(totalTIV) + '</div>' +
    '</div>' +
    '<div class="bg-gray-700/50 rounded-lg p-3">' +
    '<div class="text-xs text-gray-400">Average TIV</div>' +
    '<div class="text-lg font-bold text-blue-400">' + formatCurrency(avgTIV) + '</div>' +
    '</div>' +
    '<div class="bg-gray-700/50 rounded-lg p-3">' +
    '<div class="text-xs text-gray-400">Max TIV</div>' +
    '<div class="text-lg font-bold text-yellow-400">' + formatCurrency(maxTIV) + '</div>' +
    '</div>';
}


/* ===================================================================
 * Layer Toggles
 * =================================================================== */

/**
 * Toggle a layer on the indemnity live page.
 *
 * @param {'tiv'|'events'} layer - Which layer to toggle.
 */
function toggleIndemnityLayer(layer) {
  if (layer === 'tiv') {
    indemnityState.showTIV = !indemnityState.showTIV;
    if (indemnityState.showTIV && indemnityState.tivData.length > 0) {
      addTIVMarkers(indemnityState.map, indemnityState.tivData);
    } else {
      clearTIVMarkers();
    }
  } else if (layer === 'events') {
    indemnityState.showEvents = !indemnityState.showEvents;
    if (indemnityState.showEvents) {
      renderLiveEventMarkers();
    } else {
      clearEventMarkers();
      removeLayerSafe(indemnityState.map, 'earthquakes-layer');
      removeSourceSafe(indemnityState.map, 'earthquakes-source');
    }
  }
}

/**
 * Toggle a layer on the indemnity historical page.
 *
 * @param {'tiv'|'events'} layer - Which layer to toggle.
 */
function toggleHistLayer(layer) {
  if (layer === 'tiv') {
    indemnityState.showTIV = !indemnityState.showTIV;
    if (indemnityState.showTIV && indemnityState.tivData.length > 0) {
      addTIVMarkers(indemnityState.map, indemnityState.tivData);
    } else {
      clearTIVMarkers();
    }
  } else if (layer === 'events') {
    indemnityState.showEvents = !indemnityState.showEvents;
    if (indemnityState.showEvents) {
      renderHistoricalEventsOnMap();
    } else {
      clearEventMarkers();
      removeLayerSafe(indemnityState.map, 'earthquakes-layer');
      removeSourceSafe(indemnityState.map, 'earthquakes-source');
      removeLayerSafe(indemnityState.map, 'hurricane-tracks-layer');
      removeSourceSafe(indemnityState.map, 'hurricane-tracks-source');
    }
  }
}

/**
 * Clear all event markers from the map.
 */
function clearEventMarkers() {
  indemnityState.eventMarkers.forEach(function (m) { m.remove(); });
  indemnityState.eventMarkers = [];
}


/* ===================================================================
 * Historical Page Controls
 * =================================================================== */

/**
 * Set the historical load mode and update button styles.
 *
 * @param {string} mode - The load mode (top10, top20, top30, all).
 */
function setHistLoadMode(mode) {
  indemnityState.loadMode = mode;
  var buttons = document.querySelectorAll('.hist-mode-btn');
  buttons.forEach(function (btn) {
    if (btn.getAttribute('data-mode') === mode) {
      btn.className = 'hist-mode-btn px-2 py-1.5 bg-blue-600 text-white text-xs rounded transition-colors';
    } else {
      btn.className = 'hist-mode-btn px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors';
    }
  });
}

/**
 * Set the event type filter and update button styles.
 *
 * @param {'all'|'earthquake'|'hurricane'} type - The filter type.
 */
function setHistTypeFilter(type) {
  indemnityState.typeFilter = type;
  var buttons = document.querySelectorAll('.hist-type-btn');
  buttons.forEach(function (btn) {
    if (btn.getAttribute('data-type') === type) {
      btn.className = 'hist-type-btn flex-1 px-2 py-1.5 bg-blue-600 text-white text-xs rounded transition-colors';
    } else {
      btn.className = 'hist-type-btn flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors';
    }
  });
  renderHistoricalEventList();
}

/**
 * Apply indemnity filters on the live page.
 */
function applyIndemnityFilters() {
  showToast('Filters applied', 'info');
  // Re-render TIV markers with filter applied
  if (indemnityState.tivData.length > 0 && indemnityState.showTIV) {
    var minTIV = parseFloat(document.getElementById('min-tiv-filter').value) || 0;
    var search = (document.getElementById('tiv-search-filter').value || '').toLowerCase();

    var filtered = indemnityState.tivData.filter(function (d) {
      if (d.tiv < minTIV) return false;
      if (search && d.name.toLowerCase().indexOf(search) === -1) return false;
      return true;
    });

    clearTIVMarkers();
    addTIVMarkers(indemnityState.map, filtered);
  }
}