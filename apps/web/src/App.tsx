import { BrowserRouter, Routes, Route, NavLink, Outlet, Navigate } from 'react-router-dom'
import { Activity, BarChart3 } from 'lucide-react'
import Layout from './components/Layout'
import Home from './pages/Home'
import RealTimeTracking from './pages/RealTimeTracking'
import ParametricAnalysis from './pages/ParametricAnalysis'
import IndemnityLiveCat from './pages/IndemnityLiveCat'
import IndemnityHistorical from './pages/IndemnityHistorical'

// Parametric Layout with sub-navigation
function ParametricLayout() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub-navigation for Parametric */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-2">
        <nav className="flex items-center space-x-1">
          <NavLink
            to="/parametric/live"
            className={({ isActive }) =>
              `flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                isActive
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <Activity className="w-4 h-4" />
            <span>Live Cat</span>
          </NavLink>
          
          <NavLink
            to="/parametric/historical"
            end
            className={({ isActive }) =>
              `flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <BarChart3 className="w-4 h-4" />
            <span>Historical</span>
          </NavLink>
        </nav>
      </div>
      
      {/* Page Content */}
      <Outlet />
    </div>
  )
}

// Indemnity Layout with sub-navigation
function IndemnityLayout() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub-navigation for Indemnity */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-2">
        <nav className="flex items-center space-x-1">
          <NavLink
            to="/indemnity/live"
            className={({ isActive }) =>
              `flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                isActive
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <Activity className="w-4 h-4" />
            <span>Live Cat</span>
          </NavLink>
          
          <NavLink
            to="/indemnity/historical"
            end
            className={({ isActive }) =>
              `flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <BarChart3 className="w-4 h-4" />
            <span>Historical</span>
          </NavLink>
        </nav>
      </div>
      
      {/* Page Content */}
      <Outlet />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="parametric" element={<ParametricLayout />}>
            <Route index element={<ParametricAnalysis />} />
            <Route path="live" element={<RealTimeTracking />} />
            <Route path="historical" element={<ParametricAnalysis />} />
          </Route>
          <Route path="indemnity" element={<IndemnityLayout />}>
            <Route index element={<Navigate to="/indemnity/live" replace />} />
            <Route path="live" element={<IndemnityLiveCat />} />
            <Route path="historical" element={<IndemnityHistorical />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
