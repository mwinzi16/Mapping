/**
 * realtime.js — JavaScript for the real-time tracking page.
 *
 * Handles SocketIO client connection, event list management, map
 * marker updates, notification panel, and sidebar tab switching.
 */

/* ===================================================================
 * State
 * =================================================================== */

var realtimeState = {
  map: null,
  socket: null,
  activeTab: 'earthquakes',
  earthquakes: [],
  hurricanes: [],
  wildfires: [],
  severeWeather: [],
  notifications: [],
  refreshInterval: null,
};

/**
 * Color class maps for sidebar tabs — avoids Tailwind purging issues.
 */
var tabColorMap = {
  earthquakes: { text: 'text-yellow-500', border: 'border-yellow-500' },
  hurricanes: { text: 'text-blue-500', border: 'border-blue-500' },
  wildfires: { text: 'text-orange-500', border: 'border-orange-500' },
  severe: { text: 'text-purple-500', border: 'border-purple-500' },
  triggers: { text: 'text-green-500', border: 'border-green-500' },
};


/* ===================================================================
 * Page Initialization
 * =================================================================== */

/**
 * Initialize the real-time tracking page.
 */
function initRealtimePage() {
  // Initialize map
  realtimeState.map = initMap('realtime-map', {
    center: [0, 20],
    zoom: 2,
  });

  realtimeState.map.on('load', function () {
    fetchAllEvents();
  });

  // Initialize SocketIO connection
  initSocketConnection();

  // Auto-refresh every 5 minutes
  realtimeState.refreshInterval = setInterval(function () {
    fetchAllEvents();
  }, 5 * 60 * 1000);
}


/* ===================================================================
 * SocketIO Connection
 * =================================================================== */

/**
 * Initialize SocketIO connection for real-time updates.
 */
function initSocketConnection() {
  // Check if Socket.IO client is available
  if (typeof io === 'undefined') {
    console.warn('Socket.IO client not loaded. Real-time updates disabled.');
    return;
  }

  try {
    realtimeState.socket = io({ transports: ['websocket', 'polling'] });

    realtimeState.socket.on('connect', function () {
      console.log('SocketIO connected');
      addNotification('Connected to real-time server', 'info');
    });

    realtimeState.socket.on('disconnect', function () {
      console.log('SocketIO disconnected');
      addNotification('Disconnected from server', 'warning');
    });

    realtimeState.socket.on('earthquake_alert', function (data) {
      if (data) {
        realtimeState.earthquakes.unshift(data);
        updateEventList('earthquakes');
        renderEventsOnMap();
        addNotification('New earthquake: M' + (data.magnitude || 0).toFixed(1) + ' — ' + (data.place || 'Unknown'), 'warning');
        showToast('New M' + (data.magnitude || 0).toFixed(1) + ' earthquake detected', 'warning');
      }
    });

    realtimeState.socket.on('hurricane_update', function (data) {
      if (data) {
        addNotification('Hurricane update: ' + (data.name || 'Unknown'), 'info');
        showToast('Hurricane update: ' + (data.name || 'Unknown'), 'info');
      }
    });

    realtimeState.socket.on('wildfire_alert', function (data) {
      if (data) {
        addNotification('Wildfire detected', 'warning');
      }
    });

    realtimeState.socket.on('severe_weather_alert', function (data) {
      if (data) {
        addNotification('Severe weather: ' + (data.headline || 'Alert'), 'warning');
      }
    });
  } catch (e) {
    console.warn('Failed to connect SocketIO:', e);
  }
}


/* ===================================================================
 * Data Fetching
 * =================================================================== */

/**
 * Fetch all event types from the API.
 */
function fetchAllEvents() {
  fetchEventType('/api/v1/earthquakes/recent', 'earthquakes');
  fetchEventType('/api/v1/hurricanes/active', 'hurricanes');
  fetchEventType('/api/v1/wildfires/', 'wildfires');
  fetchEventType('/api/v1/severe-weather/', 'severe');
}

/**
 * Fetch a specific event type from the API.
 *
 * @param {string} url - API endpoint URL.
 * @param {string} eventType - Event type key.
 */
function fetchEventType(url, eventType) {
  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (json) {
      var data = json.data || json;
      if (!Array.isArray(data)) data = [];

      realtimeState[eventType === 'severe' ? 'severeWeather' : eventType] = data;

      // Update tab count
      var countEl = document.getElementById('tab-count-' + eventType);
      if (countEl) countEl.textContent = '(' + data.length + ')';

      // Update event list if this tab is active
      if (realtimeState.activeTab === eventType) {
        updateEventList(eventType);
      }

      renderEventsOnMap();
    })
    .catch(function (err) {
      console.warn('Failed to fetch ' + eventType + ':', err);
    });
}


/* ===================================================================
 * Sidebar Tab Switching
 * =================================================================== */

/**
 * Switch the active sidebar tab.
 *
 * @param {string} tab - Tab name to activate.
 */
function switchRealtimeTab(tab) {
  realtimeState.activeTab = tab;

  // Update tab button styles
  document.querySelectorAll('.sidebar-tab').forEach(function (btn) {
    var btnTab = btn.getAttribute('data-tab');
    if (btnTab === tab) {
      var colors = tabColorMap[btnTab] || tabColorMap.earthquakes;
      btn.className = 'sidebar-tab py-2 px-1 flex flex-col items-center justify-center gap-1 transition-colors bg-gray-700 ' + colors.text + ' border-b-2 ' + colors.border;
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.className = 'sidebar-tab py-2 px-1 flex flex-col items-center justify-center gap-1 transition-colors text-gray-400 hover:text-white hover:bg-gray-750';
      btn.setAttribute('aria-selected', 'false');
    }
  });

  // Show/hide event panels
  document.querySelectorAll('.event-panel').forEach(function (panel) {
    panel.classList.add('hidden');
  });
  var activePanel = document.getElementById('panel-' + tab);
  if (activePanel) activePanel.classList.remove('hidden');

  // Show/hide filter panels
  ['earthquakes', 'hurricanes', 'wildfires', 'severe', 'triggers'].forEach(function (t) {
    var filterEl = document.getElementById('filter-' + t);
    if (filterEl) {
      if (t === tab) {
        filterEl.classList.remove('hidden');
      } else {
        filterEl.classList.add('hidden');
      }
    }
  });

  // Update event list for current tab
  updateEventList(tab);
}


/* ===================================================================
 * Event List Rendering
 * =================================================================== */

/**
 * Update the event list for a given tab.
 *
 * @param {string} eventType - The event type to render.
 */
function updateEventList(eventType) {
  var listId;
  switch (eventType) {
    case 'earthquakes': listId = 'earthquake-list'; break;
    case 'hurricanes': listId = 'hurricane-list'; break;
    case 'wildfires': listId = 'wildfire-list'; break;
    case 'severe': listId = 'severe-list'; break;
    default: return;
  }

  var list = document.getElementById(listId);
  if (!list) return;

  if (eventType === 'earthquakes') {
    renderEarthquakeList(list, realtimeState.earthquakes);
  } else if (eventType === 'hurricanes') {
    renderHurricaneList(list, realtimeState.hurricanes);
  } else if (eventType === 'wildfires') {
    renderWildfireList(list, realtimeState.wildfires);
  } else if (eventType === 'severe') {
    renderSevereWeatherList(list, realtimeState.severeWeather);
  }
}

/**
 * Render earthquake event list items.
 *
 * @param {HTMLElement} list - The UL element.
 * @param {Array} earthquakes - Earthquake data array.
 */
function renderEarthquakeList(list, earthquakes) {
  if (!earthquakes || earthquakes.length === 0) {
    list.innerHTML = '<li class="p-4 text-center text-gray-500 text-sm">No earthquakes in selected range</li>';
    return;
  }

  list.innerHTML = earthquakes.map(function (eq) {
    var mag = eq.magnitude || 0;
    var color = getMagnitudeColor(mag);
    return '<li class="p-3 hover:bg-gray-700 cursor-pointer transition-colors" onclick="flyToEvent(' + (eq.latitude || 0) + ',' + (eq.longitude || 0) + ')">' +
      '<div class="flex items-start gap-3">' +
      '<div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style="background-color:' + color + '">' + mag.toFixed(1) + '</div>' +
      '<div class="flex-1 min-w-0">' +
      '<p class="text-sm text-white truncate">' + escapeHtml(eq.place || 'Unknown') + '</p>' +
      '<p class="text-xs text-gray-400">Depth: ' + (eq.depth_km || 0).toFixed(1) + ' km</p>' +
      '<div class="flex items-center gap-1 mt-1 text-xs text-gray-500">' +
      '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' +
      '<span>' + timeAgo(eq.event_time || eq.time) + '</span>' +
      '</div></div></div></li>';
  }).join('');
}

/**
 * Render hurricane event list items.
 *
 * @param {HTMLElement} list - The UL element.
 * @param {Array} hurricanes - Hurricane data array.
 */
function renderHurricaneList(list, hurricanes) {
  if (!hurricanes || hurricanes.length === 0) {
    list.innerHTML = '<li class="p-4 text-center text-gray-500 text-sm">No active storms at this time</li>';
    return;
  }

  list.innerHTML = hurricanes.map(function (h) {
    var cat = h.category || null;
    var color = getCategoryColor(cat);
    var label = cat ? 'C' + cat : 'TS';
    return '<li class="p-3 hover:bg-gray-700 cursor-pointer transition-colors" onclick="flyToEvent(' + (h.latitude || 0) + ',' + (h.longitude || 0) + ')">' +
      '<div class="flex items-start gap-3">' +
      '<div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style="background-color:' + color + '">' + label + '</div>' +
      '<div class="flex-1 min-w-0">' +
      '<p class="text-sm text-white font-medium">' + escapeHtml(h.name || 'Unnamed') + '</p>' +
      '<p class="text-xs text-gray-400">' + escapeHtml(h.classification || '') + '</p>' +
      (h.max_wind_mph ? '<p class="text-xs text-gray-500 mt-1">Max winds: ' + h.max_wind_mph + ' mph</p>' : '') +
      '</div></div></li>';
  }).join('');
}

/**
 * Render wildfire event list items.
 *
 * @param {HTMLElement} list - The UL element.
 * @param {Array} wildfires - Wildfire data array.
 */
function renderWildfireList(list, wildfires) {
  if (!wildfires || wildfires.length === 0) {
    list.innerHTML = '<li class="p-4 text-center text-gray-500 text-sm">No active fires detected</li>';
    return;
  }

  list.innerHTML = wildfires.map(function (fire) {
    var color = getWildfireColor(fire.confidence, fire.frp);
    return '<li class="p-3 hover:bg-gray-700 cursor-pointer transition-colors" onclick="flyToEvent(' + (fire.latitude || 0) + ',' + (fire.longitude || 0) + ')">' +
      '<div class="flex items-start gap-3">' +
      '<div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg" style="background-color:' + color + '">🔥</div>' +
      '<div class="flex-1 min-w-0">' +
      '<p class="text-sm text-white">' + escapeHtml(fire.name || 'Active Fire') + '</p>' +
      (fire.frp ? '<p class="text-xs text-gray-400">FRP: ' + Number(fire.frp).toFixed(1) + ' MW</p>' : '') +
      (fire.confidence ? '<p class="text-xs text-gray-500">Confidence: ' + fire.confidence + '%</p>' : '') +
      '</div></div></li>';
  }).join('');
}

/**
 * Render severe weather event list items.
 *
 * @param {HTMLElement} list - The UL element.
 * @param {Array} events - Severe weather data array.
 */
function renderSevereWeatherList(list, events) {
  if (!events || events.length === 0) {
    list.innerHTML = '<li class="p-4 text-center text-gray-500 text-sm">No active severe weather alerts</li>';
    return;
  }

  list.innerHTML = events.map(function (evt) {
    return '<li class="p-3 hover:bg-gray-700 cursor-pointer transition-colors" onclick="flyToEvent(' + (evt.latitude || 0) + ',' + (evt.longitude || 0) + ')">' +
      '<div class="flex items-start gap-3">' +
      '<div class="w-10 h-10 rounded-full flex items-center justify-center bg-purple-600 text-white text-lg">⚡</div>' +
      '<div class="flex-1 min-w-0">' +
      '<p class="text-sm text-white truncate">' + escapeHtml(evt.headline || evt.event_type || 'Weather Alert') + '</p>' +
      '<p class="text-xs text-gray-400">' + escapeHtml(evt.severity || '') + '</p>' +
      (evt.area_desc ? '<p class="text-xs text-gray-500 mt-1 truncate">' + escapeHtml(evt.area_desc) + '</p>' : '') +
      '</div></div></li>';
  }).join('');
}


/* ===================================================================
 * Map Rendering
 * =================================================================== */

/**
 * Render all event types on the map.
 */
function renderEventsOnMap() {
  var map = realtimeState.map;
  if (!map || !map.loaded()) return;

  // Earthquakes
  if (realtimeState.earthquakes.length > 0) {
    var eqGeoJSON = toGeoJSONPoints(realtimeState.earthquakes);
    addEarthquakeLayer(map, eqGeoJSON);
  }

  // Hurricanes — as track lines if available, otherwise as points
  if (realtimeState.hurricanes.length > 0) {
    var hasTrack = realtimeState.hurricanes.some(function (h) { return h.track && h.track.length > 1; });
    if (hasTrack) {
      var trackFeatures = [];
      realtimeState.hurricanes.forEach(function (h) {
        if (!h.track || h.track.length < 2) return;
        trackFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: h.track.map(function (pt) { return [pt.lon || pt.longitude, pt.lat || pt.latitude]; }),
          },
          properties: { name: h.name, category: h.category || 0 },
        });
      });
      addHurricaneTrackLayer(map, { type: 'FeatureCollection', features: trackFeatures });
    }
  }

  // Wildfires
  if (realtimeState.wildfires.length > 0) {
    var fireGeoJSON = toGeoJSONPoints(realtimeState.wildfires);
    addWildfireLayer(map, fireGeoJSON);
  }

  // Severe weather
  if (realtimeState.severeWeather.length > 0) {
    var swGeoJSON = toGeoJSONPoints(realtimeState.severeWeather);
    addSevereWeatherLayer(map, swGeoJSON);
  }
}

/**
 * Fly the map to a specific event location.
 *
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 */
function flyToEvent(lat, lng) {
  if (!realtimeState.map) return;
  realtimeState.map.flyTo({
    center: [lng, lat],
    zoom: 8,
    duration: 1500,
  });
}


/* ===================================================================
 * Notification Panel
 * =================================================================== */

/**
 * Toggle the notification panel visibility.
 */
function toggleNotificationPanel() {
  var panel = document.getElementById('notification-panel');
  if (!panel) return;
  panel.classList.toggle('hidden');
}

/**
 * Add a notification to the panel.
 *
 * @param {string} message - Notification text.
 * @param {'info'|'warning'|'error'} type - Notification type.
 */
function addNotification(message, type) {
  realtimeState.notifications.unshift({
    id: Date.now(),
    message: message,
    type: type || 'info',
    time: new Date(),
  });

  // Keep only last 50 notifications
  if (realtimeState.notifications.length > 50) {
    realtimeState.notifications = realtimeState.notifications.slice(0, 50);
  }

  renderNotificationList();
  updateNotificationBadge();
}

/**
 * Render the notification list.
 */
function renderNotificationList() {
  var list = document.getElementById('notification-list');
  if (!list) return;

  if (realtimeState.notifications.length === 0) {
    list.innerHTML = '<li class="p-3 text-sm text-gray-500 text-center">No new notifications</li>';
    return;
  }

  var colors = {
    info: 'text-blue-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  list.innerHTML = realtimeState.notifications.slice(0, 20).map(function (n) {
    var colorClass = colors[n.type] || colors.info;
    return '<li class="p-3 hover:bg-gray-700/50">' +
      '<p class="text-sm ' + colorClass + '">' + escapeHtml(n.message) + '</p>' +
      '<p class="text-xs text-gray-500 mt-1">' + timeAgo(n.time) + '</p>' +
      '</li>';
  }).join('');
}

/**
 * Update the notification badge count.
 */
function updateNotificationBadge() {
  var badge = document.getElementById('notification-badge');
  if (!badge) return;

  var count = realtimeState.notifications.length;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}


/* ===================================================================
 * Trigger Zone Management (Real-time page)
 * =================================================================== */

/**
 * Start drawing a trigger zone on the real-time map.
 */
function startDrawingTriggerZone() {
  showToast('Click two points on the map to define a trigger zone', 'info');
  // Re-use the parametric drawing infrastructure if available
  if (typeof startDrawingBox === 'function') {
    startDrawingBox();
  }
}

/**
 * Filter events based on current filter settings.
 */
function filterEvents() {
  // Filters are applied on render — simply re-render the current tab
  var tab = realtimeState.activeTab;
  if (tab === 'earthquakes') {
    var minMag = parseFloat(document.getElementById('eq-magnitude-filter').value) || 0;
    var filtered = realtimeState.earthquakes.filter(function (eq) {
      return (eq.magnitude || 0) >= minMag;
    });
    var list = document.getElementById('earthquake-list');
    if (list) renderEarthquakeList(list, filtered);
  } else if (tab === 'hurricanes') {
    var minCat = parseInt(document.getElementById('hurricane-category-filter').value) || 0;
    var filtered2 = realtimeState.hurricanes.filter(function (h) {
      return (h.category || 0) >= minCat;
    });
    var list2 = document.getElementById('hurricane-list');
    if (list2) renderHurricaneList(list2, filtered2);
  }
}