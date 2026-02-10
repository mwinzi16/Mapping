/**
 * app.js — Core application JavaScript for Catastrophe Analysis Platform.
 *
 * Handles dark mode toggling, toast notifications, HTMX event listeners,
 * collapsible section management, and general UI utilities.
 */

/* ===================================================================
 * Dark Mode
 * =================================================================== */

/**
 * Toggle dark mode on/off. Persists preference to localStorage.
 */
function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.classList.contains('dark');

  if (isDark) {
    html.classList.remove('dark');
    document.body.classList.remove('bg-gray-900', 'text-white');
    document.body.classList.add('bg-gray-100', 'text-gray-900');
    localStorage.setItem('theme', 'light');
  } else {
    html.classList.add('dark');
    document.body.classList.remove('bg-gray-100', 'text-gray-900');
    document.body.classList.add('bg-gray-900', 'text-white');
    localStorage.setItem('theme', 'dark');
  }

  updateDarkModeIcons();
}

/**
 * Update sun/moon icons based on current dark mode state.
 */
function updateDarkModeIcons() {
  const isDark = document.documentElement.classList.contains('dark');
  const sunIcon = document.getElementById('icon-sun');
  const moonIcon = document.getElementById('icon-moon');

  if (sunIcon && moonIcon) {
    if (isDark) {
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
    } else {
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
    }
  }
}

/**
 * Initialize dark mode from localStorage on page load.
 */
function initDarkMode() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('bg-gray-900', 'text-white');
    document.body.classList.add('bg-gray-100', 'text-gray-900');
  } else {
    document.documentElement.classList.add('dark');
  }
  updateDarkModeIcons();
}


/* ===================================================================
 * Toast Notifications
 * =================================================================== */

let toastCounter = 0;
const TOAST_DURATION = 5000;

/**
 * Display a toast notification.
 *
 * @param {string} message - The text to display.
 * @param {'info'|'success'|'warning'|'error'} type - Notification type.
 * @param {number} [duration] - Auto-dismiss time in ms. 0 for persistent.
 */
function showToast(message, type, duration) {
  if (typeof type === 'undefined') { type = 'info'; }
  if (typeof duration === 'undefined') { duration = TOAST_DURATION; }

  const container = document.getElementById('toast-container');
  if (!container) return;

  toastCounter += 1;
  var toastId = 'toast-' + toastCounter;

  var colorClasses = {
    info: 'bg-blue-600 border-blue-500',
    success: 'bg-green-600 border-green-500',
    warning: 'bg-yellow-600 border-yellow-500',
    error: 'bg-red-600 border-red-500',
  };

  var iconPaths = {
    info: '<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path>',
    success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>',
    error: '<circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path>',
  };

  var classes = colorClasses[type] || colorClasses.info;
  var iconPath = iconPaths[type] || iconPaths.info;

  var toast = document.createElement('div');
  toast.id = toastId;
  toast.className = 'toast-enter flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-white text-sm max-w-sm ' + classes;
  toast.setAttribute('role', 'alert');
  toast.innerHTML =
    '<svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    iconPath +
    '</svg>' +
    '<span class="flex-1">' + escapeHtml(message) + '</span>' +
    '<button onclick="dismissToast(\'' + toastId + '\')" class="text-white/80 hover:text-white flex-shrink-0" aria-label="Dismiss">' +
    '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>' +
    '</svg></button>';

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(function () {
      dismissToast(toastId);
    }, duration);
  }
}

/**
 * Dismiss a toast notification with exit animation.
 *
 * @param {string} toastId - The ID of the toast element.
 */
function dismissToast(toastId) {
  var toast = document.getElementById(toastId);
  if (!toast) return;
  toast.classList.remove('toast-enter');
  toast.classList.add('toast-exit');
  setTimeout(function () {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}


/* ===================================================================
 * Collapsible Sections
 * =================================================================== */

/**
 * Toggle visibility of a collapsible section.
 *
 * @param {string} contentId - The ID of content div to show/hide.
 */
function toggleSection(contentId) {
  var content = document.getElementById(contentId);
  if (!content) return;

  var isHidden = content.classList.contains('hidden');
  if (isHidden) {
    content.classList.remove('hidden');
  } else {
    content.classList.add('hidden');
  }

  // Rotate chevron in the parent button
  var btn = content.previousElementSibling;
  if (!btn) {
    // content might be nested — try parent
    var parent = content.parentElement;
    if (parent) {
      btn = parent.querySelector('button');
    }
  }
  if (btn) {
    var chevron = btn.querySelector('.section-chevron');
    if (chevron) {
      if (isHidden) {
        chevron.style.transform = 'rotate(180deg)';
      } else {
        chevron.style.transform = 'rotate(0deg)';
      }
    }
  }
}


/* ===================================================================
 * HTMX Event Listeners
 * =================================================================== */

document.addEventListener('htmx:afterRequest', function (event) {
  // Handle HTMX errors
  if (event.detail.failed) {
    showToast('Request failed. Please try again.', 'error');
  }
});

document.addEventListener('htmx:responseError', function (event) {
  var status = event.detail.xhr ? event.detail.xhr.status : 0;
  if (status === 429) {
    showToast('Rate limit exceeded. Please wait.', 'warning');
  } else if (status >= 500) {
    showToast('Server error. Please try again later.', 'error');
  } else {
    showToast('Request failed (HTTP ' + status + ').', 'error');
  }
});

// Process OOB swaps for toasts
document.addEventListener('htmx:oobAfterSwap', function (event) {
  if (event.detail.target && event.detail.target.id === 'toast-container') {
    // Auto-dismiss OOB toasts after 5 seconds
    var toasts = event.detail.target.children;
    for (var i = 0; i < toasts.length; i++) {
      (function (toast) {
        setTimeout(function () {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, TOAST_DURATION);
      })(toasts[i]);
    }
  }
});


/* ===================================================================
 * Utility Functions
 * =================================================================== */

/**
 * Escape HTML entities in a string to prevent XSS.
 *
 * @param {string} text - Raw text to escape.
 * @returns {string} Escaped HTML-safe string.
 */
function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

/**
 * Format a number as compact currency (e.g., $1.2M).
 *
 * @param {number} value - The numeric value.
 * @param {string} [currency] - Currency code (default 'USD').
 * @returns {string} Formatted string.
 */
function formatCurrency(value, currency) {
  if (typeof currency === 'undefined') currency = 'USD';
  var symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  if (value >= 1e9) return symbol + (value / 1e9).toFixed(1) + 'B';
  if (value >= 1e6) return symbol + (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return symbol + (value / 1e3).toFixed(1) + 'K';
  return symbol + value.toFixed(0);
}

/**
 * Format a number with locale-appropriate separators.
 *
 * @param {number} num - Number to format.
 * @returns {string} Formatted string.
 */
function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Calculate time-since string (e.g., "2 hours ago").
 *
 * @param {string|Date} dateInput - ISO date string or Date object.
 * @returns {string} Human-readable time distance.
 */
function timeAgo(dateInput) {
  var date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  var now = new Date();
  var diffMs = now - date;
  var diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + ' min ago';
  var diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return diffHrs + 'h ago';
  var diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return diffDays + 'd ago';
  var diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return diffMonths + 'mo ago';
  return Math.floor(diffMonths / 12) + 'y ago';
}


/* ===================================================================
 * Initialization
 * =================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  initDarkMode();
});