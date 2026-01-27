import { useEffect, useState } from 'react'
import { useParametricStore } from '../../stores/parametricStore'
import { parametricApi } from '../../services/parametricApi'
import { DatasetType } from '../../types/parametric'
import { Star, Database } from 'lucide-react'

export default function FilterPanel() {
  const { filters, setFilters, fetchHistoricalHurricanes, datasets, fetchDatasets, hurricanes } = useParametricStore()
  const [basins, setBasins] = useState<string[]>([])
  const [yearRange, setYearRange] = useState<{ min: number; max: number }>({ min: 1980, max: 2024 })
  
  useEffect(() => {
    // Fetch available datasets
    fetchDatasets()
  }, [fetchDatasets])
  
  useEffect(() => {
    // Fetch basins and year range when dataset changes
    const loadMetadata = async () => {
      try {
        const [basinData, rangeData] = await Promise.all([
          parametricApi.getBasins(filters.dataset),
          parametricApi.getYearRange(filters.dataset),
        ])
        setBasins(basinData)
        setYearRange({ min: rangeData.min_year, max: rangeData.max_year })
        
        // Reset basin if it's not valid for the new dataset
        if (filters.basin && !basinData.includes(filters.basin)) {
          setFilters({ basin: null })
        }
      } catch (error) {
        console.error('Failed to load filter metadata:', error)
      }
    }
    
    loadMetadata()
  }, [filters.dataset, setFilters])
  
  const handleApplyFilters = () => {
    fetchHistoricalHurricanes()
  }
  
  return (
    <div className="mt-4 space-y-3">
      {/* Dataset Selection */}
      <div>
        <label className="text-xs text-gray-400">Data Source</label>
        <select
          value={filters.dataset}
          onChange={(e) => setFilters({ dataset: e.target.value as DatasetType })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
        >
          <option value="ibtracs">IBTrACS (Global, 1980+)</option>
          <option value="hurdat2_atlantic">HURDAT2 Atlantic (1851+)</option>
          <option value="hurdat2_pacific">HURDAT2 Pacific (1949+)</option>
        </select>
        {datasets.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {datasets.find(d => d.id === filters.dataset)?.description}
          </p>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400">Start Year</label>
          <input
            type="number"
            min={yearRange.min}
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
            max={yearRange.max}
            value={filters.endYear}
            onChange={(e) => setFilters({ endYear: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
          />
        </div>
      </div>
      
      <div>
        <label className="text-xs text-gray-400">Minimum Category</label>
        <select
          value={filters.minCategory}
          onChange={(e) => setFilters({ minCategory: parseInt(e.target.value) })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
        >
          <option value={0}>Tropical Storm & Above</option>
          <option value={1}>Category 1+</option>
          <option value={2}>Category 2+</option>
          <option value={3}>Category 3+ (Major)</option>
          <option value={4}>Category 4+</option>
          <option value={5}>Category 5</option>
        </select>
      </div>
      
      <div>
        <label className="text-xs text-gray-400">Basin</label>
        <select
          value={filters.basin || ''}
          onChange={(e) => setFilters({ basin: e.target.value || null })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
        >
          <option value="">All Basins</option>
          {basins.map((basin) => (
            <option key={basin} value={basin}>
              {getBasinName(basin)}
            </option>
          ))}
        </select>
      </div>

      {/* Top Events Selector */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block">Display Events</label>
        <div className="grid grid-cols-4 gap-1">
          {[10, 20, 30, null].map((limit) => (
            <button
              key={limit ?? 'all'}
              onClick={() => setFilters({ topEventsLimit: limit })}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                filters.topEventsLimit === limit
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {limit ? (
                <>
                  <Star className="w-3 h-3" />
                  {limit}
                </>
              ) : (
                <>
                  <Database className="w-3 h-3" />
                  All
                </>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {filters.topEventsLimit 
            ? `Showing top ${filters.topEventsLimit} most significant events`
            : `Showing all ${hurricanes.length} events`}
        </p>
      </div>
      
      <button
        onClick={handleApplyFilters}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors text-sm"
      >
        Apply Filters
      </button>
    </div>
  )
}

function getBasinName(code: string): string {
  const basinNames: Record<string, string> = {
    NA: 'North Atlantic',
    SA: 'South Atlantic',
    EP: 'Eastern Pacific',
    WP: 'Western Pacific',
    NI: 'North Indian',
    SI: 'South Indian',
    SP: 'South Pacific',
    AS: 'Arabian Sea',
    BB: 'Bay of Bengal',
    atlantic: 'Atlantic Basin',
    pacific: 'Pacific Basin',
  }
  return basinNames[code] || code
}
