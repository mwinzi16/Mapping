import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Outlet, Navigate } from 'react-router-dom'
import { Activity, BarChart3 } from 'lucide-react'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import RouteErrorFallback from './components/RouteErrorFallback'
import LoadingFallback from './components/LoadingFallback'

const Home = React.lazy(() => import('./pages/Home'))
const RealTimeTracking = React.lazy(() => import('./pages/RealTimeTracking'))
const ParametricAnalysis = React.lazy(() => import('./pages/ParametricAnalysis'))
const IndemnityLiveCat = React.lazy(() => import('./pages/IndemnityLiveCat'))
const IndemnityHistorical = React.lazy(() => import('./pages/IndemnityHistorical'))

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
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={
              <ErrorBoundary fallback={<RouteErrorFallback />}>
                <Suspense fallback={<LoadingFallback />}>
                  <Home />
                </Suspense>
              </ErrorBoundary>
            } />
            <Route path="parametric" element={<ParametricLayout />}>
              <Route index element={
                <ErrorBoundary fallback={<RouteErrorFallback />}>
                  <Suspense fallback={<LoadingFallback />}>
                    <ParametricAnalysis />
                  </Suspense>
                </ErrorBoundary>
              } />
              <Route path="live" element={
                <ErrorBoundary fallback={<RouteErrorFallback />}>
                  <Suspense fallback={<LoadingFallback />}>
                    <RealTimeTracking />
                  </Suspense>
                </ErrorBoundary>
              } />
              <Route path="historical" element={
                <ErrorBoundary fallback={<RouteErrorFallback />}>
                  <Suspense fallback={<LoadingFallback />}>
                    <ParametricAnalysis />
                  </Suspense>
                </ErrorBoundary>
              } />
            </Route>
            <Route path="indemnity" element={<IndemnityLayout />}>
              <Route index element={<Navigate to="/indemnity/live" replace />} />
              <Route path="live" element={
                <ErrorBoundary fallback={<RouteErrorFallback />}>
                  <Suspense fallback={<LoadingFallback />}>
                    <IndemnityLiveCat />
                  </Suspense>
                </ErrorBoundary>
              } />
              <Route path="historical" element={
                <ErrorBoundary fallback={<RouteErrorFallback />}>
                  <Suspense fallback={<LoadingFallback />}>
                    <IndemnityHistorical />
                  </Suspense>
                </ErrorBoundary>
              } />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
