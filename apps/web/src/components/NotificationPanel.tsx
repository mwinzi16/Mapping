import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useEventStore } from '../stores/eventStore'
import type { Notification } from '../types'

export default function NotificationPanel() {
  const { notifications, dismissNotification } = useEventStore()
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([])
  
  // Show only the 3 most recent unread notifications
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).slice(0, 3)
    setVisibleNotifications(unread)
  }, [notifications])
  
  if (visibleNotifications.length === 0) return null
  
  return (
    <div className="absolute top-4 right-4 w-80 space-y-2 z-10">
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            p-4 rounded-lg shadow-lg backdrop-blur-sm border
            ${notification.type === 'earthquake' 
              ? 'bg-yellow-900/80 border-yellow-600' 
              : 'bg-blue-900/80 border-blue-600'
            }
            animate-in slide-in-from-right duration-300
          `}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
              notification.type === 'earthquake' ? 'text-yellow-400' : 'text-blue-400'
            }`} />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white">
                {notification.title}
              </h4>
              <p className="text-xs text-gray-300 mt-1">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => dismissNotification(notification.id)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
