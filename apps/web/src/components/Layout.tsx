import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Globe, Home, Sun, Moon } from 'lucide-react'
import { useDarkMode } from '../hooks/useDarkMode'
import Toast from './Toast'
import { useToastStore } from '../stores/toastStore'

export default function Layout() {
  const location = useLocation()
  const isHomePage = location.pathname === '/'
  const [isDark, toggleDark] = useDarkMode()
  const { toasts, dismissToast } = useToastStore()

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Navigation Header */}
      <header className="bg-gray-900 border-b border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <NavLink to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <Globe className="w-8 h-8 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Catastrophe Analysis Platform</h1>
          </NavLink>
          
          <div className="flex items-center space-x-3">
            {!isHomePage && (
              <nav className="flex items-center space-x-1" role="navigation" aria-label="Main navigation">
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
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>
      
      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Page Content */}
      <Outlet />
    </div>
  )
}
