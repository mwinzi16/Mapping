import { useState } from 'react'
import { Filter, ChevronDown, ChevronUp } from 'lucide-react'
import FilterPanel from './FilterPanel'

export default function TropicalCycloneFilterSection() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="border-t border-gray-700">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-gray-200">Event Filter</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <FilterPanel />
        </div>
      )}
    </div>
  )
}
