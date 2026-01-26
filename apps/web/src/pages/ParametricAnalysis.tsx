import { useEffect, useState } from 'react'
import { Waves, Mountain, Loader2 } from 'lucide-react'

// Tropical Cyclone components
import ParametricMap from '../components/parametric/ParametricMap'
import TropicalCycloneFilterSection from '../components/parametric/TropicalCycloneFilterSection'
import TropicalCycloneBoxPanel from '../components/parametric/TropicalCycloneBoxPanel'
import TropicalCycloneStatisticsSection from '../components/parametric/TropicalCycloneStatisticsSection'
import { useParametricStore } from '../stores/parametricStore'

// Earthquake components
import EarthquakeMap from '../components/parametric/EarthquakeMap'
import EarthquakeBoxPanel from '../components/parametric/EarthquakeBoxPanel'
import EarthquakeFilterSection from '../components/parametric/EarthquakeFilterSection'
import EarthquakeStatisticsSection from '../components/parametric/EarthquakeStatisticsSection'
import { useEarthquakeParametricStore } from '../stores/earthquakeParametricStore'

type SubTab = 'tropical-cyclone' | 'earthquake'

export default function ParametricAnalysis() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('tropical-cyclone')

  // Tropical Cyclone state
  const {
    fetchHistoricalHurricanes,
    isLoading: isLoadingHurricanes,
    error: hurricaneError,
    hurricanes,
  } = useParametricStore()

  // Earthquake state
  const {
    fetchHistoricalEarthquakes,
    isLoading: isLoadingEarthquakes,
    error: earthquakeError,
    earthquakes,
  } = useEarthquakeParametricStore()

  // Fetch data when tab changes
  useEffect(() => {
    if (activeSubTab === 'tropical-cyclone') {
      fetchHistoricalHurricanes()
    } else {
      fetchHistoricalEarthquakes()
    }
  }, [activeSubTab, fetchHistoricalHurricanes, fetchHistoricalEarthquakes])

  const isLoading =
    activeSubTab === 'tropical-cyclone' ? isLoadingHurricanes : isLoadingEarthquakes
  const error = activeSubTab === 'tropical-cyclone' ? hurricaneError : earthquakeError
  const dataCount =
    activeSubTab === 'tropical-cyclone' ? hurricanes.length : earthquakes.length
  const dataLabel =
    activeSubTab === 'tropical-cyclone' ? 'Historical Hurricanes' : 'Historical Earthquakes'

  return (
    <div className="flex-1 flex overflow-hidden bg-gray-900">
      {/* Left Panel - Box Management */}
      <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
        {/* Sub-tabs */}
        <div className="grid grid-cols-2 border-b border-gray-700">
          <button
            onClick={() => setActiveSubTab('tropical-cyclone')}
            className={`py-3 px-4 flex items-center justify-center gap-2 transition-colors ${
              activeSubTab === 'tropical-cyclone'
                ? 'bg-gray-700 text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <Waves className="w-4 h-4" />
            <span className="text-sm font-medium">Tropical Cyclone</span>
          </button>
          <button
            onClick={() => setActiveSubTab('earthquake')}
            className={`py-3 px-4 flex items-center justify-center gap-2 transition-colors ${
              activeSubTab === 'earthquake'
                ? 'bg-gray-700 text-yellow-400 border-b-2 border-yellow-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <Mountain className="w-4 h-4" />
            <span className="text-sm font-medium">Earthquake</span>
          </button>
        </div>

        {/* Earthquake Tab - 3 collapsible categories */}
        {activeSubTab === 'earthquake' && (
          <div className="flex-1 overflow-y-auto">
            {/* Event Filter */}
            <EarthquakeFilterSection />
            
            {/* Trigger Zones */}
            <EarthquakeBoxPanel />
            
            {/* Statistics (with sub-collapsible sections) */}
            <EarthquakeStatisticsSection />
          </div>
        )}

        {/* Tropical Cyclone Tab - 3 collapsible categories */}
        {activeSubTab === 'tropical-cyclone' && (
          <div className="flex-1 overflow-y-auto">
            {/* Event Filter */}
            <TropicalCycloneFilterSection />
            
            {/* Trigger Zones */}
            <TropicalCycloneBoxPanel />
            
            {/* Statistics (with sub-collapsible sections) */}
            <TropicalCycloneStatisticsSection />
          </div>
        )}
      </aside>

      {/* Main Map Area */}
      <main className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-gray-900/50 flex items-center justify-center">
            <div className="flex items-center space-x-3 bg-gray-800 px-6 py-4 rounded-lg">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="text-white">Loading {dataLabel.toLowerCase()}...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-900/90 text-red-100 px-6 py-3 rounded-lg max-w-lg">
            {error}
          </div>
        )}

        {/* Data count badge */}
        <div className="absolute top-4 right-4 z-10 bg-gray-800/90 px-4 py-2 rounded-lg">
          <span className="text-gray-400">{dataLabel}: </span>
          <span className="text-white font-semibold">
            {dataCount.toLocaleString()}
          </span>
        </div>

        {activeSubTab === 'tropical-cyclone' ? (
          <ParametricMap />
        ) : (
          <EarthquakeMap />
        )}
      </main>
    </div>
  )
}
