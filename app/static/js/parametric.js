/**
 * parametric.js — JavaScript for parametric analysis pages.
 *
 * Handles TC/EQ sub-tab switching, data loading via fetch API, bounding
 * box drawing on the map, and statistics calculation/display.
 */

/* ===================================================================
 * State
 * =================================================================== */

var parametricState = {
  map: null,
  activeSubTab: 'tropical-cyclone',
  isDrawing: false,
  drawStart: null,
  boxes: [],
  hurricaneData: [],
  earthquakeData: [],
  tempDrawMarker: null,
  drawPreviewRect: null,
};


/* ===================================================================
 * Page Initialization
 * =================================================================== */

/**
 * Initialize the parametric historical page: map + initial data load.
 */
function initParametricPage() {
  parametricState.map = initMap('parametric-map', {
    center: [-60, 25],
    zoom: 3,
  });

  parametricState.map.on('load', function () {
    // Load default TC data on map ready
    loadParametricTC();
  });

  // Map click handler for box drawing
  parametricState.map.on('click', function (e) {
    if (!parametricState.isDrawing) return;
    handleDrawClick(e.lngLat);
  });

  // Mouse move handler for draw preview
  parametricState.map.on('mousemove', function (e) {
    if (!parametricState.isDrawing || !parametricState.drawStart) return;
    updateDrawPreview(parametricState.drawStart, e.lngLat);
  });
}


/* ===================================================================
 * Sub-Tab Switching
 * =================================================================== */

/**
 * Switch between Tropical Cyclone and Earthquake sub-tabs.
 *
 * @param {'tropical-cyclone'|'earthquake'} tab - The target tab.
 */
function switchParametricSubTab(tab) {
  parametricState.activeSubTab = tab;

  var tcPanel = document.getElementById('tc-panel');
  var eqPanel = document.getElementById('eq-panel');
  var tcTab = document.getElementById('subtab-tc');
  var eqTab = document.getElementById('subtab-eq');

  if (tab === 'tropical-cyclone') {
    tcPanel.classList.remove('hidden');
    eqPanel.classList.add('hidden');
    tcTab.className = 'py-3 px-4 flex items-center justify-center gap-2 transition-colors bg-gray-700 text-blue-400 border-b-2 border-blue-400';
    eqTab.className = 'py-3 px-4 flex items-center justify-center gap-2 transition-colors text-gray-400 hover:text-white hover:bg-gray-700/50';
    renderTCOnMap();
  } else {
    tcPanel.classList.add('hidden');
    eqPanel.classList.remove('hidden');
    tcTab.className = 'py-3 px-4 flex items-center justify-center gap-2 transition-colors text-gray-400 hover:text-white hover:bg-gray-700/50';
    eqTab.className = 'py-3 px-4 flex items-center justify-center gap-2 transition-colors bg-gray-700 text-yellow-400 border-b-2 border-yellow-400';
    renderEQOnMap();
  }
}


/* ===================================================================
 * Data Loading
 * =================================================================== */

/**
 * Load tropical cyclone historical data from the API.
 */
function loadParametricTC() {
  var yearStart = document.getElementById('tc-year-start').value || 1851;
  var yearEnd = document.getElementById('tc-year-end').value || 2025;
  var minCat = document.getElementById('tc-min-category').value || 0;
  var basin = document.getElementById('tc-basin').value || 'AL';
  var dataset = document.getElementById('tc-dataset').value || 'hurdat2';

  var spinner = document.getElementById('tc-load-spinner');
  spinner.classList.remove('hidden');
  showLoading('Loading tropical cyclone data...');

  var url = '/api/v1/parametric/hurricanes/historical?'
    + 'start_year=' + encodeURIComponent(yearStart)
    + '&end_year=' + encodeURIComponent(yearEnd)
    + '&min_category=' + encodeURIComponent(minCat)
    + '&basin=' + encodeURIComponent(basin)
    + '&dataset=' + encodeURIComponent(dataset);

  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (json) {
      var data = json.data || json;
      parametricState.hurricaneData = Array.isArray(data) ? data : [];
      var count = parametricState.hurricaneData.length;
      document.getElementById('tc-results-count').textContent = count.toLocaleString() + ' hurricanes loaded';
      document.getElementById('parametric-data-count').textContent = count.toLocaleString();
      document.getElementById('parametric-data-label').textContent = 'Historical Hurricanes: ';
      renderTCOnMap();
      hideLoading();
      showToast(count + ' tropical cyclones loaded', 'success');
    })
    .catch(function (err) {
      hideLoading();
      showError(err.message);
      showToast('Failed to load TC data: ' + err.message, 'error');
    })
    .finally(function () {
      spinner.classList.add('hidden');
    });
}

/**
 * Load earthquake historical data from the API.
 */
function loadParametricEQ() {
  var yearStart = document.getElementById('eq-year-start').value || 1900;
  var yearEnd = document.getElementById('eq-year-end').value || 2025;
  var minMag = document.getElementById('eq-min-magnitude').value || 6;

  var spinner = document.getElementById('eq-load-spinner');
  spinner.classList.remove('hidden');
  showLoading('Loading earthquake data...');

  var url = '/api/v1/earthquake-parametric/earthquakes/historical?'
    + 'start_year=' + encodeURIComponent(yearStart)
    + '&end_year=' + encodeURIComponent(yearEnd)
    + '&min_magnitude=' + encodeURIComponent(minMag);

  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (json) {
      var data = json.data || json;
      parametricState.earthquakeData = Array.isArray(data) ? data : [];
      var count = parametricState.earthquakeData.length;
      document.getElementById('eq-results-count').textContent = count.toLocaleString() + ' earthquakes loaded';
      document.getElementById('parametric-data-count').textContent = count.toLocaleString();
      document.getElementById('parametric-data-label').textContent = 'Historical Earthquakes: ';
      renderEQOnMap();
      hideLoading();
      showToast(count + ' earthquakes loaded', 'success');
    })
    .catch(function (err) {
      hideLoading();
      showError(err.message);
      showToast('Failed to load EQ data: ' + err.message, 'error');
    })
    .finally(function () {
      spinner.classList.add('hidden');
    });
}


/* ===================================================================
 * Map Rendering
 * =================================================================== */

/**
 * Render loaded tropical cyclone tracks on the map.
 */
function renderTCOnMap() {
  var map = parametricState.map;
  if (!map || !map.loaded()) return;

  // Remove earthquake layer if present
  removeLayerSafe(map, 'earthquakes-layer');
  removeSourceSafe(map, 'earthquakes-source');

  var features = [];
  parametricState.hurricaneData.forEach(function (storm) {
    if (!storm.track || storm.track.length < 2) return;

    // Build line segments colored by category at that point
    var coordinates = storm.track.map(function (pt) {
      return [pt.lon || pt.longitude, pt.lat || pt.latitude];
    });

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
      properties: {
        name: storm.name,
        season: storm.season || storm.year,
        category: storm.max_category || storm.category || 0,
        max_wind_mph: storm.max_wind_mph || storm.max_wind,
        storm_id: storm.storm_id || storm.id,
      },
    });
  });

  var geojson = { type: 'FeatureCollection', features: features };
  addHurricaneTrackLayer(map, geojson);
  renderBoxesOnMap();
}

/**
 * Render loaded earthquake data on the map.
 */
function renderEQOnMap() {
  var map = parametricState.map;
  if (!map || !map.loaded()) return;

  // Remove hurricane layer if present
  removeLayerSafe(map, 'hurricane-tracks-layer');
  removeSourceSafe(map, 'hurricane-tracks-source');

  var features = parametricState.earthquakeData
    .filter(function (eq) {
      return eq.latitude != null && eq.longitude != null;
    })
    .map(function (eq) {
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [eq.longitude, eq.latitude],
        },
        properties: {
          magnitude: eq.magnitude,
          depth_km: eq.depth_km || eq.depth,
          place: eq.place || eq.location,
          event_time: eq.event_time || eq.time,
        },
      };
    });

  var geojson = { type: 'FeatureCollection', features: features };
  addEarthquakeLayer(map, geojson);
  renderBoxesOnMap();
}


/* ===================================================================
 * Bounding Box Drawing
 * =================================================================== */

/**
 * Start drawing a bounding box on the map.
 */
function startDrawingBox() {
  parametricState.isDrawing = true;
  parametricState.drawStart = null;

  var btn = document.getElementById('draw-box-btn');
  if (btn) {
    btn.textContent = 'Click first corner on map...';
    btn.classList.remove('bg-green-600', 'hover:bg-green-700');
    btn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
  }

  if (parametricState.map) {
    parametricState.map.getCanvas().style.cursor = 'crosshair';
  }
}

/**
 * Handle a click on the map during box drawing.
 *
 * @param {object} lngLat - The clicked coordinates { lng, lat }.
 */
function handleDrawClick(lngLat) {
  if (!parametricState.drawStart) {
    // First click — set start point
    parametricState.drawStart = { lng: lngLat.lng, lat: lngLat.lat };

    // Add temporary marker at start
    var el = document.createElement('div');
    el.style.width = '10px';
    el.style.height = '10px';
    el.style.backgroundColor = '#22c55e';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';

    parametricState.tempDrawMarker = new maplibregl.Marker({ element: el })
      .setLngLat([lngLat.lng, lngLat.lat])
      .addTo(parametricState.map);

    var btn = document.getElementById('draw-box-btn');
    if (btn) btn.textContent = 'Click second corner...';
  } else {
    // Second click — complete the box
    var box = {
      id: 'box-' + Date.now(),
      sw: {
        lng: Math.min(parametricState.drawStart.lng, lngLat.lng),
        lat: Math.min(parametricState.drawStart.lat, lngLat.lat),
      },
      ne: {
        lng: Math.max(parametricState.drawStart.lng, lngLat.lng),
        lat: Math.max(parametricState.drawStart.lat, lngLat.lat),
      },
    };

    parametricState.boxes.push(box);
    finishDrawing();
    renderBoxesOnMap();
    updateBoxList();
    calculateBoxStatistics();
    showToast('Bounding box created', 'success');
  }
}

/**
 * Update the draw preview rectangle on mousemove.
 *
 * @param {object} start - Start corner { lng, lat }.
 * @param {object} current - Current mouse position { lng, lat }.
 */
function updateDrawPreview(start, current) {
  var map = parametricState.map;
  var sourceId = 'draw-preview-source';
  var layerId = 'draw-preview-layer';

  var sw = { lng: Math.min(start.lng, current.lng), lat: Math.min(start.lat, current.lat) };
  var ne = { lng: Math.max(start.lng, current.lng), lat: Math.max(start.lat, current.lat) };

  var geojson = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [sw.lng, sw.lat],
        [ne.lng, sw.lat],
        [ne.lng, ne.lat],
        [sw.lng, ne.lat],
        [sw.lng, sw.lat],
      ]],
    },
  };

  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData(geojson);
  } else {
    map.addSource(sourceId, { type: 'geojson', data: geojson });
    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.15 },
    });
    map.addLayer({
      id: layerId + '-outline',
      type: 'line',
      source: sourceId,
      paint: { 'line-color': '#22c55e', 'line-width': 2, 'line-dasharray': [3, 3] },
    });
  }
}

/**
 * Clean up drawing state after completing a box.
 */
function finishDrawing() {
  parametricState.isDrawing = false;
  parametricState.drawStart = null;

  if (parametricState.tempDrawMarker) {
    parametricState.tempDrawMarker.remove();
    parametricState.tempDrawMarker = null;
  }

  var map = parametricState.map;
  removeLayerSafe(map, 'draw-preview-layer');
  removeLayerSafe(map, 'draw-preview-layer-outline');
  removeSourceSafe(map, 'draw-preview-source');

  map.getCanvas().style.cursor = '';

  var btn = document.getElementById('draw-box-btn');
  if (btn) {
    btn.textContent = 'Draw Bounding Box';
    btn.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
    btn.classList.add('bg-green-600', 'hover:bg-green-700');
  }
}

/**
 * Render all bounding boxes on the map.
 */
function renderBoxesOnMap() {
  var map = parametricState.map;
  if (!map) return;

  // Clear existing box layers
  parametricState.boxes.forEach(function (box, i) {
    removeLayerSafe(map, 'box-fill-' + i);
    removeLayerSafe(map, 'box-outline-' + i);
    removeSourceSafe(map, 'box-source-' + i);
  });

  // Re-add all boxes
  parametricState.boxes.forEach(function (box, i) {
    var geojson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [box.sw.lng, box.sw.lat],
          [box.ne.lng, box.sw.lat],
          [box.ne.lng, box.ne.lat],
          [box.sw.lng, box.ne.lat],
          [box.sw.lng, box.sw.lat],
        ]],
      },
    };

    map.addSource('box-source-' + i, { type: 'geojson', data: geojson });
    map.addLayer({
      id: 'box-fill-' + i,
      type: 'fill',
      source: 'box-source-' + i,
      paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.1 },
    });
    map.addLayer({
      id: 'box-outline-' + i,
      type: 'line',
      source: 'box-source-' + i,
      paint: { 'line-color': '#22c55e', 'line-width': 2 },
    });
  });
}

/**
 * Clear all bounding boxes from state and map.
 */
function clearAllBoxes() {
  var map = parametricState.map;

  parametricState.boxes.forEach(function (box, i) {
    removeLayerSafe(map, 'box-fill-' + i);
    removeLayerSafe(map, 'box-outline-' + i);
    removeSourceSafe(map, 'box-source-' + i);
  });

  parametricState.boxes = [];
  updateBoxList();

  if (parametricState.activeSubTab === 'tropical-cyclone') {
    document.getElementById('tc-statistics').innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Load data and draw boxes to see statistics</p>';
  } else {
    document.getElementById('eq-statistics').innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Load data and draw boxes to see statistics</p>';
  }
}

/**
 * Update the box list UI in the sidebar.
 */
function updateBoxList() {
  var listId = parametricState.activeSubTab === 'tropical-cyclone' ? 'tc-box-list' : 'eq-box-list';
  var list = document.getElementById(listId);
  if (!list) return;

  if (parametricState.boxes.length === 0) {
    list.innerHTML = '<li class="text-xs text-gray-500 text-center py-2">No bounding boxes defined</li>';
    return;
  }

  list.innerHTML = parametricState.boxes.map(function (box, i) {
    return '<li class="bg-gray-700/50 rounded-lg p-2">' +
      '<div class="flex items-center justify-between">' +
      '<span class="text-xs text-white font-medium">Box ' + (i + 1) + '</span>' +
      '<button onclick="removeBox(' + i + ')" class="text-red-400 hover:text-red-300 text-xs">Remove</button>' +
      '</div>' +
      '<div class="text-xs text-gray-400 mt-1">' +
      'SW: ' + box.sw.lat.toFixed(2) + '°, ' + box.sw.lng.toFixed(2) + '°<br>' +
      'NE: ' + box.ne.lat.toFixed(2) + '°, ' + box.ne.lng.toFixed(2) + '°' +
      '</div></li>';
  }).join('');
}

/**
 * Remove a single box by index.
 *
 * @param {number} index - Box index to remove.
 */
function removeBox(index) {
  var map = parametricState.map;
  removeLayerSafe(map, 'box-fill-' + index);
  removeLayerSafe(map, 'box-outline-' + index);
  removeSourceSafe(map, 'box-source-' + index);

  parametricState.boxes.splice(index, 1);
  renderBoxesOnMap();
  updateBoxList();
  calculateBoxStatistics();
}


/* ===================================================================
 * Statistics
 * =================================================================== */

/**
 * Calculate and display statistics for events intersecting boxes.
 */
function calculateBoxStatistics() {
  if (parametricState.boxes.length === 0) return;

  var statsEl = parametricState.activeSubTab === 'tropical-cyclone'
    ? document.getElementById('tc-statistics')
    : document.getElementById('eq-statistics');

  if (!statsEl) return;

  if (parametricState.activeSubTab === 'tropical-cyclone') {
    calculateTCBoxStats(statsEl);
  } else {
    calculateEQBoxStats(statsEl);
  }
}

/**
 * Calculate TC statistics for all boxes.
 *
 * @param {HTMLElement} container - The DOM container for stats.
 */
function calculateTCBoxStats(container) {
  var storms = parametricState.hurricaneData;
  var boxes = parametricState.boxes;

  var totalIntersecting = 0;
  var categoryBreakdown = {};

  boxes.forEach(function (box) {
    storms.forEach(function (storm) {
      if (!storm.track) return;
      var intersects = storm.track.some(function (pt) {
        var lon = pt.lon || pt.longitude;
        var lat = pt.lat || pt.latitude;
        return lon >= box.sw.lng && lon <= box.ne.lng && lat >= box.sw.lat && lat <= box.ne.lat;
      });
      if (intersects) {
        totalIntersecting++;
        var cat = storm.max_category || 0;
        var catKey = cat === 0 ? 'TS/TD' : 'Cat ' + cat;
        categoryBreakdown[catKey] = (categoryBreakdown[catKey] || 0) + 1;
      }
    });
  });

  var totalStorms = storms.length;
  var yearSpan = 1;
  if (storms.length > 0) {
    var years = storms.map(function (s) { return s.season || s.year || 2000; });
    yearSpan = Math.max(1, Math.max.apply(null, years) - Math.min.apply(null, years) + 1);
  }
  var annualRate = totalIntersecting / yearSpan;

  var html = '<div class="space-y-2">';
  html += '<div class="bg-gray-700/50 rounded-lg p-3">';
  html += '<div class="text-xs text-gray-400">Intersecting Storms</div>';
  html += '<div class="text-lg font-bold text-white">' + totalIntersecting + ' / ' + totalStorms + '</div>';
  html += '</div>';
  html += '<div class="bg-gray-700/50 rounded-lg p-3">';
  html += '<div class="text-xs text-gray-400">Annual Rate (λ)</div>';
  html += '<div class="text-lg font-bold text-blue-400">' + annualRate.toFixed(2) + '</div>';
  html += '</div>';
  html += '<div class="bg-gray-700/50 rounded-lg p-3">';
  html += '<div class="text-xs text-gray-400">Poisson P(≥1/year)</div>';
  html += '<div class="text-lg font-bold text-yellow-400">' + (1 - Math.exp(-annualRate)).toFixed(4) + '</div>';
  html += '</div>';

  // Category breakdown
  html += '<div class="bg-gray-700/50 rounded-lg p-3">';
  html += '<div class="text-xs text-gray-400 mb-2">Category Breakdown</div>';
  for (var cat in categoryBreakdown) {
    if (categoryBreakdown.hasOwnProperty(cat)) {
      html += '<div class="flex justify-between text-xs"><span class="text-gray-300">' + cat + '</span><span class="text-white font-medium">' + categoryBreakdown[cat] + '</span></div>';
    }
  }
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;
}

/**
 * Calculate EQ statistics for all boxes.
 *
 * @param {HTMLElement} container - The DOM container for stats.
 */
function calculateEQBoxStats(container) {
  var earthquakes = parametricState.earthquakeData;
  var boxes = parametricState.boxes;

  var totalIntersecting = 0;
  var magnitudeSum = 0;
  var maxMag = 0;

  boxes.forEach(function (box) {
    earthquakes.forEach(function (eq) {
      var lon = eq.longitude;
      var lat = eq.latitude;
      if (lon >= box.sw.lng && lon <= box.ne.lng && lat >= box.sw.lat && lat <= box.ne.lat) {
        totalIntersecting++;
        magnitudeSum += eq.magnitude;
        if (eq.magnitude > maxMag) maxMag = eq.magnitude;
      }
    });
  });

  var totalEQ = earthquakes.length;
  var avgMag = totalIntersecting > 0 ? magnitudeSum / totalIntersecting : 0;
  var yearSpan = 1;
  if (earthquakes.length > 0) {
    var years = earthquakes.map(function (eq) {
      var t = eq.event_time || eq.time || '';
      return t ? new Date(t).getFullYear() : 2000;
    });
    yearSpan = Math.max(1, Math.max.apply(null, years) - Math.min.apply(null, years) + 1);
  }
  var annualRate = totalIntersecting / yearSpan;

  var html = '<div class="space-y-2">';
  html += '<div class="bg-gray-700/50 rounded-lg p-3">';
  html += '<div class="text-xs text-gray-400">Earthquakes in Box</div>';
  html += '<div class="text-lg font-bold text-white">' + totalIntersecting + ' / ' + totalEQ + '</div>';
  html += '</div>';
  html += '<div class="bg-gray-700/50 rounded-lg p-3">';
  html += '<div class="text-xs text-gray-400">Annual Rate (λ)</div>';
  html += '<div class="text-lg font-bold text-yellow-400">' + annualRate.toFixed(2) + '</div>';
  html += '</div>';
  html += '<div class="bg-gray-700/50 rounded-lg p-3">';
  html += '<div class="text-xs text-gray-400">Poisson P(≥1/year)</div>';
  html += '<div class="text-lg font-bold text-blue-400">' + (1 - Math.exp(-annualRate)).toFixed(4) + '</div>';
  html += '</div>';
  html += '<div class="bg-gray-700/50 rounded-lg p-3">';
  html += '<div class="text-xs text-gray-400">Avg Magnitude</div>';
  html += '<div class="text-lg font-bold text-white">' + avgMag.toFixed(1) + '</div>';
  html += '</div>';
  html += '<div class="bg-gray-700/50 rounded-lg p-3">';
  html += '<div class="text-xs text-gray-400">Max Magnitude</div>';
  html += '<div class="text-lg font-bold text-red-400">' + maxMag.toFixed(1) + '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;
}


/* ===================================================================
 * Loading / Error UI
 * =================================================================== */

/**
 * Show the loading overlay.
 *
 * @param {string} [text] - Loading message text.
 */
function showLoading(text) {
  var el = document.getElementById('parametric-loading');
  if (el) {
    el.classList.remove('hidden');
    var textEl = document.getElementById('parametric-loading-text');
    if (textEl && text) textEl.textContent = text;
  }
}

/**
 * Hide the loading overlay.
 */
function hideLoading() {
  var el = document.getElementById('parametric-loading');
  if (el) el.classList.add('hidden');
}

/**
 * Show an error banner.
 *
 * @param {string} message - Error message.
 */
function showError(message) {
  var el = document.getElementById('parametric-error');
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
    setTimeout(function () {
      el.classList.add('hidden');
    }, 8000);
  }
}