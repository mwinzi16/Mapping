import { useEffect } from 'react'
import { useEarthquakeParametricStore } from '../../stores/earthquakeParametricStore'
import { EarthquakeDatasetType } from '../../types/parametric'

export default function EarthquakeFilterPanel() {
  const {
    filters,
    setFilters,
    fetchHistoricalEarthquakes,
    datasets,
    fetchDatasets,
  } = useEarthquakeParametricStore()

  useEffect(() => {
    // Fetch available datasets
    fetchDatasets()
  }, [fetchDatasets])

  const handleApplyFilters = () => {
    fetchHistoricalEarthquakes()
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Dataset Selection */}
      <div>
        <label className="text-xs text-gray-400">Data Source</label>
        <select
          value={filters.dataset}
          onChange={(e) =>
            setFilters({ dataset: e.target.value as EarthquakeDatasetType })
          }
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
        >
          <option value="usgs_worldwide">USGS Worldwide</option>
          <option value="usgs_us">USGS United States</option>
        </select>
        {datasets.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {datasets.find((d) => d.id === filters.dataset)?.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400">Start Year</label>
          <input
            type="number"
            min={1970}
            max={filters.endYear}
            value={filters.startYear}
            onChange={(e) => setFilters({ startYear: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">End Year</label>
          <input
            type="number"
            min={filters.startYear}
            max={new Date().getFullYear()}
            value={filters.endYear}
            onChange={(e) => setFilters({ endYear: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400">Minimum Magnitude</label>
        <select
          value={filters.minMagnitude}
          onChange={(e) =>
            setFilters({ minMagnitude: parseFloat(e.target.value) })
          }
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
        >
          <option value={4.0}>M4.0+ (Light)</option>
          <option value={4.5}>M4.5+ (Moderate)</option>
          <option value={5.0}>M5.0+ (Moderate)</option>
          <option value={5.5}>M5.5+</option>
          <option value={6.0}>M6.0+ (Strong)</option>
          <option value={6.5}>M6.5+</option>
          <option value={7.0}>M7.0+ (Major)</option>
          <option value={7.5}>M7.5+</option>
          <option value={8.0}>M8.0+ (Great)</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Lower magnitudes = more data but slower load times
        </p>
      </div>

      <button
        onClick={handleApplyFilters}
        className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors"
      >
        Apply Filters
      </button>

      <p className="text-xs text-gray-500 text-center">
        Data from USGS Earthquake Catalog (1970 - present)
      </p>
    </div>
  )
}
