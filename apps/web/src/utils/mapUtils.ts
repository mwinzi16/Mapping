import maplibregl from 'maplibre-gl'

/** Map style URLs used across indemnity views. */
export const MAP_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
} as const

/** Shared default map configuration for indemnity pages. */
export function getDefaultMapOptions(): Partial<maplibregl.MapOptions> {
  return {
    style: MAP_STYLES.dark,
    center: [-95, 38] as [number, number],
    zoom: 4,
  }
}

/** Get color based on TIV value relative to maximum TIV. */
export function getTIVColor(tiv: number, maxTIV: number): string {
  const ratio = tiv / maxTIV
  if (ratio > 0.8) return '#a855f7' // purple-500
  if (ratio > 0.6) return '#c084fc' // purple-400
  if (ratio > 0.4) return '#d8b4fe' // purple-300
  if (ratio > 0.2) return '#e9d5ff' // purple-200
  return '#f3e8ff' // purple-100
}

/** Get marker pixel size based on TIV value relative to maximum TIV. */
export function getMarkerSize(tiv: number, maxTIV: number): number {
  const ratio = tiv / maxTIV
  return Math.max(8, Math.min(24, 8 + ratio * 16))
}

/** Create a styled circular DOM element for a TIV marker. */
export function createMarkerElement(
  color: string,
  size: number,
  className?: string,
): HTMLDivElement {
  const el = document.createElement('div')
  if (className) el.className = className
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  el.style.backgroundColor = color
  el.style.borderRadius = '50%'
  el.style.border = '2px solid rgba(168, 85, 247, 0.8)'
  el.style.cursor = 'pointer'
  el.style.opacity = '0.8'
  return el
}

/** Remove all markers from the map and empty the array in-place. */
export function clearMarkers(markers: maplibregl.Marker[]): void {
  markers.forEach((marker) => marker.remove())
  markers.length = 0
}
