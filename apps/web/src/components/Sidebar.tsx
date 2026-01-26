import { useState } from 'react'
import { Waves, Mountain, Flame, Wind, Filter, Clock, Target } from 'lucide-react'
import { useEventStore } from '../stores/eventStore'
import { useTriggerZoneStore } from '../stores/triggerZoneStore'
import { formatDistanceToNow } from 'date-fns'
import { getMagnitudeColor, getCategoryColor, getWildfireColor, getTornadoColor, getFloodingColor } from '../utils/colors'
import TriggerZonePanel from './TriggerZonePanel'

type Tab = 'earthquakes' | 'hurricanes' | 'wildfires' | 'severe' | 'triggers'

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<Tab>('earthquakes')
  const { earthquakes, hurricanes, wildfires, severeWeather, setSelectedEvent, filters, setFilters } = useEventStore()
  const { zones } = useTriggerZoneStore()
  
  const tabs = [
    { id: 'earthquakes' as Tab, icon: Mountain, label: 'Quakes', color: 'yellow-500', count: earthquakes.length },
    { id: 'hurricanes' as Tab, icon: Waves, label: 'Storms', color: 'blue-500', count: hurricanes.length },
    { id: 'wildfires' as Tab, icon: Flame, label: 'Fires', color: 'orange-500', count: wildfires.length },
    { id: 'severe' as Tab, icon: Wind, label: 'Severe', color: 'purple-500', count: severeWeather.length },
    { id: 'triggers' as Tab, icon: Target, label: 'Zones', color: 'green-500', count: zones.length },
  ]
  
  return (
    <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="grid grid-cols-5 border-b border-gray-700">
        {tabs.map(({ id, icon: Icon, label, color, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`py-2 px-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === id
                ? `bg-gray-700 text-${color} border-b-2 border-${color}`
                : 'text-gray-400 hover:text-white hover:bg-gray-750'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-xs">{label}</span>
            <span className="text-xs opacity-60">({count})</span>
          </button>
        ))}
      </div>
      
      {/* Filters */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Filter className="w-4 h-4" />
          <span>Filters</span>
        </div>
        {activeTab === 'earthquakes' && (
          <select
            value={filters.minMagnitude}
            onChange={(e) => setFilters({ minMagnitude: Number(e.target.value) })}
            className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
          >
            <option value={0}>All magnitudes</option>
            <option value={2.5}>M 2.5+</option>
            <option value={4.5}>M 4.5+</option>
            <option value={6}>M 6.0+</option>
          </select>
        )}
        {activeTab === 'hurricanes' && (
          <select
            value={filters.minCategory || 0}
            onChange={(e) => setFilters({ minCategory: Number(e.target.value) || null })}
            className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
          >
            <option value={0}>All storms</option>
            <option value={1}>Cat 1+</option>
            <option value={3}>Cat 3+ (Major)</option>
          </select>
        )}
        {(activeTab === 'wildfires' || activeTab === 'severe') && (
          <p className="text-xs text-gray-500">Showing all active events</p>
        )}
      </div>
      
      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'earthquakes' && (
          <ul className="divide-y divide-gray-700">
            {earthquakes.map((eq) => (
              <li
                key={eq.usgs_id}
                onClick={() => setSelectedEvent(eq)}
                className="p-3 hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: getMagnitudeColor(eq.magnitude) }}
                  >
                    {eq.magnitude.toFixed(1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{eq.place}</p>
                    <p className="text-xs text-gray-400">Depth: {eq.depth_km.toFixed(1)} km</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatDistanceToNow(new Date(eq.event_time))} ago</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {earthquakes.length === 0 && (
              <li className="p-4 text-center text-gray-500 text-sm">No earthquakes in selected range</li>
            )}
          </ul>
        )}
        
        {activeTab === 'hurricanes' && (
          <ul className="divide-y divide-gray-700">
            {hurricanes.map((hurricane) => (
              <li
                key={hurricane.storm_id}
                onClick={() => setSelectedEvent(hurricane)}
                className="p-3 hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: getCategoryColor(hurricane.category) }}
                  >
                    {hurricane.category ? `C${hurricane.category}` : 'TS'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{hurricane.name}</p>
                    <p className="text-xs text-gray-400">{hurricane.classification}</p>
                    <p className="text-xs text-gray-500 mt-1">Max winds: {hurricane.max_wind_mph} mph</p>
                  </div>
                </div>
              </li>
            ))}
            {hurricanes.length === 0 && (
              <li className="p-4 text-center text-gray-500 text-sm">No active storms at this time</li>
            )}
          </ul>
        )}
        
        {activeTab === 'wildfires' && (
          <ul className="divide-y divide-gray-700">
            {wildfires.map((fire) => (
              <li
                key={fire.source_id}
                onClick={() => setSelectedEvent(fire)}
                className="p-3 hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
                    style={{ backgroundColor: getWildfireColor(fire.confidence, fire.frp) }}
                  >
                    🔥
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{fire.name || 'Active Fire'}</p>
                    {fire.frp && <p className="text-xs text-gray-400">FRP: {fire.frp.toFixed(1)} MW</p>}
                    {fire.confidence && <p className="text-xs text-gray-500">Confidence: {fire.confidence}%</p>}
                  </div>
                </div>
              </li>
            ))}
            {wildfires.length === 0 && (
              <li className="p-4 text-center text-gray-500 text-sm">No active wildfires detected</li>
            )}
          </ul>
        )}
        
        {activeTab === 'severe' && (
          <ul className="divide-y divide-gray-700">
            {severeWeather.map((event) => (
              <li
                key={event.source_id}
                onClick={() => setSelectedEvent(event)}
                className="p-3 hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
                    style={{ 
                      backgroundColor: event.event_type === 'tornado' 
                        ? getTornadoColor(event.tornado_scale)
                        : event.event_type === 'flooding'
                        ? getFloodingColor(event.flood_severity)
                        : '#8b5cf6'
                    }}
                  >
                    {event.event_type === 'tornado' ? '🌪️' : 
                     event.event_type === 'flooding' ? '🌊' : 
                     event.event_type === 'hail' ? '🧊' : '⚡'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white capitalize">{event.event_type}</p>
                    <p className="text-xs text-gray-400 truncate">{event.location || 'Unknown location'}</p>
                    {event.severity && <p className="text-xs text-gray-500">{event.severity} severity</p>}
                  </div>
                </div>
              </li>
            ))}
            {severeWeather.length === 0 && (
              <li className="p-4 text-center text-gray-500 text-sm">No active severe weather alerts</li>
            )}
          </ul>
        )}
        
        {activeTab === 'triggers' && (
          <TriggerZonePanel />
        )}
      </div>
    </aside>
  )
}
