import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Globe, Home } from 'lucide-react'

export default function Layout() {
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Navigation Header */}
      <header className="bg-gray-900 border-b border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <NavLink to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <Globe className="w-8 h-8 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Catastrophe Analysis Platform</h1>
          </NavLink>
          
          {!isHomePage && (
            <nav className="flex items-center space-x-1">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </NavLink>
            </nav>
          )}
        </div>
      </header>
      
      {/* Page Content */}
      <Outlet />
    </div>
  )
}
