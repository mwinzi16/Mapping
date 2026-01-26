import { useState } from 'react'
import { Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useIndemnityStore } from '../../stores/indemnityStore'
import { TIVGranularity } from '../../types/indemnity'

export default function IndemnityFilterSection() {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const { 
    granularity, 
    setGranularity, 
    filters, 
    setFilters, 
    clearFilters,
    statistics 
  } = useIndemnityStore()

  const categories = statistics?.byCategory ? Object.keys(statistics.byCategory) : []
  const states = statistics?.byState ? Object.keys(statistics.byState) : []

  return (
    <div className="border-t border-gray-700">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-gray-200">Data Filters</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Granularity Selection */}
          <div>
            <label className="text-xs text-gray-400 block mb-2">Display Granularity</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as TIVGranularity)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
            >
              <option value="location">Individual Locations</option>
              <option value="postal">By Postal Code</option>
              <option value="city">By City</option>
              <option value="state">By State/Province</option>
              <option value="country">By Country</option>
              <option value="grid">Grid (0.5° cells)</option>
            </select>
          </div>

          {/* TIV Range Filter */}
          <div>
            <label className="text-xs text-gray-400 block mb-2">TIV Range</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="number"
                  placeholder="Min TIV"
                  value={filters.minTIV || ''}
                  onChange={(e) => setFilters({ minTIV: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm placeholder-gray-500"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Max TIV"
                  value={filters.maxTIV || ''}
                  onChange={(e) => setFilters({ maxTIV: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm placeholder-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 block mb-2">Categories</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      const current = filters.categories || []
                      const updated = current.includes(cat)
                        ? current.filter(c => c !== cat)
                        : [...current, cat]
                      setFilters({ categories: updated.length > 0 ? updated : undefined })
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      filters.categories?.includes(cat)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* State Filter */}
          {states.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 block mb-2">States</label>
              <select
                multiple
                value={filters.states || []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value)
                  setFilters({ states: selected.length > 0 ? selected : undefined })
                }}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm h-24"
              >
                {states.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
          )}

          {/* Clear Filters */}
          {(filters.minTIV || filters.maxTIV || filters.categories?.length || filters.states?.length) && (
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors text-sm"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
