import { useEffect, useRef, useCallback, useState } from 'react'
import { useEventStore } from '../stores/eventStore'

const WS_URL = import.meta.env.VITE_WS_URL || `ws://localhost:8001/api/v1/notifications/ws`

const MAX_RECONNECT_ATTEMPTS = 5

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const attemptRef = useRef(0)
  const [connectionLost, setConnectionLost] = useState(false)
  // Use refs for store actions to avoid re-creating the connect callback
  const storeRef = useRef(useEventStore.getState())
  
  // Keep the ref up-to-date without triggering re-renders
  useEffect(() => {
    return useEventStore.subscribe((state) => {
      storeRef.current = state
    })
  }, [])
  
  const connect = useCallback(() => {
    // Don't connect if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    
    try {
      wsRef.current = new WebSocket(WS_URL)
      
      wsRef.current.onopen = () => {
        console.log('🔌 WebSocket connected - receiving real-time updates')
        attemptRef.current = 0
        setConnectionLost(false)
        
        // Subscribe to all events
        wsRef.current?.send(JSON.stringify({
          action: 'subscribe',
          events: ['earthquake', 'hurricane', 'wildfire', 'tornado', 'flooding', 'hail'],
        }))
      }
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const store = storeRef.current
          
          switch (data.type) {
            case 'new_event':
              // Handle real-time new events from the backend
              console.log(`📡 New ${data.event_type} event received`)
              
              if (data.event_type === 'earthquake') {
                store.addEarthquake(data.data)
              } else if (data.event_type === 'hurricane') {
                store.updateHurricane(data.data)
              } else {
                // For other event types, trigger a refresh
                store.fetchAllEvents()
              }
              
              // Show notification for significant events
              if (data.data) {
                store.addNotification({
                  type: data.event_type,
                  title: getEventTitle(data.event_type, data.data),
                  message: getEventMessage(data.event_type, data.data),
                })
              }
              break
              
            case 'earthquake':
              store.addEarthquake(data.data)
              break
              
            case 'hurricane':
              store.updateHurricane(data.data)
              break
              
            case 'connected':
              console.log('WebSocket: Connected to real-time feed')
              break
              
            case 'subscribed':
              console.log('WebSocket: Subscribed to:', data.events)
              break
              
            case 'pong':
              // Heartbeat response
              break
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e)
        }
      }
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
      
      wsRef.current.onclose = () => {
        if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.log('WebSocket: max reconnect attempts reached — connection lost')
          setConnectionLost(true)
          return
        }
        const delay = Math.min(30000, 1000 * Math.pow(2, attemptRef.current)) + Math.random() * 1000
        attemptRef.current += 1
        console.log(`WebSocket disconnected, reconnecting in ${Math.round(delay)}ms (attempt ${attemptRef.current}/${MAX_RECONNECT_ATTEMPTS})...`)
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect()
        }, delay)
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
    }
  }, []) // No store dependencies — uses storeRef
  
  // Send heartbeat every 30 seconds
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'ping' }))
      }
    }, 30000)
    
    return () => clearInterval(heartbeat)
  }, [])
  
  // Connect on mount
  useEffect(() => {
    connect()
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      wsRef.current?.close()
    }
  }, [connect])
  
  return { ws: wsRef.current, connectionLost }
}

// Helper functions for notifications
function getEventTitle(eventType: string, data: any): string {
  switch (eventType) {
    case 'earthquake':
      return `M${data.magnitude?.toFixed(1) || '?'} Earthquake`
    case 'hurricane':
      return `${data.name || 'Storm'} - ${data.category ? `Cat ${data.category}` : 'TS'}`
    case 'wildfire':
      return `🔥 ${data.name || 'Wildfire Detected'}`
    case 'tornado':
      return `🌪️ Tornado Warning`
    case 'flooding':
      return `🌊 Flood Alert`
    case 'hail':
      return `🧊 Severe Hail Warning`
    default:
      return `⚠️ ${eventType} Alert`
  }
}

function getEventMessage(eventType: string, data: any): string {
  switch (eventType) {
    case 'earthquake':
      return data.place || 'Unknown location'
    case 'hurricane':
      return `${data.max_wind_mph || '?'} mph winds`
    case 'wildfire':
      return `FRP: ${data.frp?.toFixed(0) || '?'} MW`
    case 'tornado':
    case 'flooding':
    case 'hail':
      return data.location || data.description || 'Check map for details'
    default:
      return 'New event detected'
  }
}
