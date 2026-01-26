import { useEffect } from 'react'
import Map from '../components/Map'
import Sidebar from '../components/Sidebar'
import NotificationPanel from '../components/NotificationPanel'
import { useEventStore } from '../stores/eventStore'
import { useWebSocket } from '../hooks/useWebSocket'

export default function RealTimeTracking() {
  const { fetchAllEvents } = useEventStore()
  
  // Initialize WebSocket connection
  useWebSocket()
  
  // Fetch initial data
  useEffect(() => {
    fetchAllEvents()
    
    // Refresh data every 5 minutes
    const interval = setInterval(() => {
      fetchAllEvents()
    }, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [fetchAllEvents])
  
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Map */}
      <main className="flex-1 relative">
        <Map />
        
        {/* Notification overlay */}
        <NotificationPanel />
      </main>
    </div>
  )
}
