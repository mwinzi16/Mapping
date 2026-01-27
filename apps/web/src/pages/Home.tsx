import { Link } from 'react-router-dom'
import { BarChart3, Shield, Globe, TrendingUp, Activity, MapPin } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex-1 bg-gray-900 overflow-auto">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 py-16 px-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-2xl">
              <Globe className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Catastrophe Analysis Platform
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Comprehensive tools for parametric and indemnity catastrophe analysis, 
            real-time event tracking, and historical data insights.
          </p>
        </div>
      </div>

      {/* Main Menu Cards */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Parametric Analysis Card */}
          <Link
            to="/parametric/live"
            className="group bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-blue-500 hover:bg-gray-800/80 transition-all duration-300"
          >
            <div className="flex items-start space-x-4">
              <div className="bg-blue-600/20 p-4 rounded-xl group-hover:bg-blue-600/30 transition-colors">
                <BarChart3 className="w-8 h-8 text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                  Parametric Analysis
                </h2>
                <p className="text-gray-400 mb-4">
                  Define trigger zones, analyze historical events, calculate trigger probabilities, 
                  and run stress tests for parametric insurance products.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                    Tropical Cyclones
                  </span>
                  <span className="px-3 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                    Earthquakes
                  </span>
                  <span className="px-3 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                    Trigger Zones
                  </span>
                  <span className="px-3 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                    Statistics
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center text-blue-400 group-hover:translate-x-2 transition-transform">
              <span className="text-sm font-medium">Open Parametric Analysis</span>
              <TrendingUp className="w-4 h-4 ml-2" />
            </div>
          </Link>

          {/* Indemnity Analysis Card */}
          <Link
            to="/indemnity/live"
            className="group bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-purple-500 hover:bg-gray-800/80 transition-all duration-300"
          >
            <div className="flex items-start space-x-4">
              <div className="bg-purple-600/20 p-4 rounded-xl group-hover:bg-purple-600/30 transition-colors">
                <Shield className="w-8 h-8 text-purple-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                  Indemnity Analysis
                </h2>
                <p className="text-gray-400 mb-4">
                  Upload TIV data, analyze exposure mapping, overlay live and historical events, 
                  and calculate concentration risk for traditional indemnity products.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                    TIV Mapping
                  </span>
                  <span className="px-3 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                    Exposure Analysis
                  </span>
                  <span className="px-3 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                    Event Overlay
                  </span>
                  <span className="px-3 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                    Concentration Risk
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center text-purple-400 group-hover:translate-x-2 transition-transform">
              <span className="text-sm font-medium">Open Indemnity Analysis</span>
              <TrendingUp className="w-4 h-4 ml-2" />
            </div>
          </Link>
        </div>

        {/* Quick Access Section */}
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-gray-300 mb-6">Quick Access</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Parametric Quick Links */}
            <Link
              to="/parametric/live"
              className="flex items-center space-x-3 bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-green-500 hover:bg-gray-800 transition-all"
            >
              <Activity className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-white font-medium">Parametric Live</p>
                <p className="text-xs text-gray-500">Real-time triggers</p>
              </div>
            </Link>

            <Link
              to="/parametric/historical"
              className="flex items-center space-x-3 bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-800 transition-all"
            >
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-white font-medium">Parametric History</p>
                <p className="text-xs text-gray-500">Analyze past events</p>
              </div>
            </Link>

            {/* Indemnity Quick Links */}
            <Link
              to="/indemnity/live"
              className="flex items-center space-x-3 bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-green-500 hover:bg-gray-800 transition-all"
            >
              <MapPin className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-white font-medium">Indemnity Live</p>
                <p className="text-xs text-gray-500">TIV + live events</p>
              </div>
            </Link>

            <Link
              to="/indemnity/historical"
              className="flex items-center space-x-3 bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-purple-500 hover:bg-gray-800 transition-all"
            >
              <Shield className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-white font-medium">Indemnity History</p>
                <p className="text-xs text-gray-500">Historical exposure</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
