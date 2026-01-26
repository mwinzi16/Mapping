/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Earthquake severity colors
        earthquake: {
          minor: '#22c55e',      // Green (M < 3)
          light: '#eab308',      // Yellow (M 3-4.9)
          moderate: '#f97316',   // Orange (M 5-5.9)
          strong: '#ef4444',     // Red (M 6-6.9)
          major: '#dc2626',      // Dark red (M 7-7.9)
          great: '#7c2d12',      // Brown-red (M 8+)
        },
        // Hurricane category colors
        hurricane: {
          depression: '#6b7280', // Gray (TD)
          storm: '#3b82f6',      // Blue (TS)
          cat1: '#fbbf24',       // Yellow
          cat2: '#f97316',       // Orange
          cat3: '#ef4444',       // Red
          cat4: '#dc2626',       // Dark red
          cat5: '#7c2d12',       // Brown-red
        },
      },
    },
  },
  plugins: [],
}
