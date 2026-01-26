import { useState } from 'react'
import { Activity, Bell, Settings, Mail } from 'lucide-react'
import { useEventStore } from '../stores/eventStore'
import SubscribeModal from './SubscribeModal'

export default function Header() {
  const { earthquakes, hurricanes, wildfires, severeWeather, notifications } = useEventStore()
  const [showSubscribe, setShowSubscribe] = useState(false)
  
  const unreadCount = notifications.filter(n => !n.read).length
  
  return (
    <>
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Catastrophe Mapping</h1>
            <p className="text-xs text-gray-400">Real-time disaster tracking</p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-xl font-bold text-yellow-500">{earthquakes.length}</p>
            <p className="text-xs text-gray-400">Quakes</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-blue-500">{hurricanes.length}</p>
            <p className="text-xs text-gray-400">Storms</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-orange-500">{wildfires.length}</p>
            <p className="text-xs text-gray-400">Fires</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-purple-500">{severeWeather.length}</p>
            <p className="text-xs text-gray-400">Severe</p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Subscribe button */}
          <button 
            onClick={() => setShowSubscribe(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Mail className="w-4 h-4" />
            <span className="text-sm font-medium">Get Alerts</span>
          </button>
          
          {/* Notifications */}
          <button className="relative p-2 hover:bg-gray-700 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          
          {/* Settings */}
          <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
            <Settings className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </header>
      
      {/* Subscribe Modal */}
      <SubscribeModal isOpen={showSubscribe} onClose={() => setShowSubscribe(false)} />
    </>
  )
}
