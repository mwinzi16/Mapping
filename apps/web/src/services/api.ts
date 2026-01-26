import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const api = {
  // Earthquakes
  async getRecentEarthquakes(hours: number = 24, minMagnitude: number = 2.5) {
    const response = await client.get('/earthquakes/recent', {
      params: { hours, min_magnitude: minMagnitude },
    })
    return response.data
  },
  
  async getSignificantEarthquakes(days: number = 30) {
    const response = await client.get('/earthquakes/significant', {
      params: { days },
    })
    return response.data
  },
  
  async getEarthquake(id: string) {
    const response = await client.get(`/earthquakes/usgs/${id}`)
    return response.data
  },
  
  // Hurricanes
  async getActiveHurricanes() {
    const response = await client.get('/hurricanes/active')
    return response.data
  },
  
  async getHurricane(id: number) {
    const response = await client.get(`/hurricanes/${id}`)
    return response.data
  },
  
  async getHurricaneTrack(id: number) {
    const response = await client.get(`/hurricanes/${id}/track`)
    return response.data
  },
  
  async getSeasonHurricanes(year: number, basin: string = 'AL') {
    const response = await client.get(`/hurricanes/season/${year}`, {
      params: { basin },
    })
    return response.data
  },
  
  // Wildfires
  async getActiveWildfires(region: string = 'USA', hours: number = 24) {
    const response = await client.get('/wildfires/active', {
      params: { region, hours },
    })
    return response.data
  },
  
  async getMajorWildfires() {
    const response = await client.get('/wildfires/major')
    return response.data
  },
  
  // Severe Weather (Tornado, Hail, Flooding)
  async getSevereWeatherAlerts(eventType?: string, state?: string) {
    const response = await client.get('/severe-weather/alerts', {
      params: { event_type: eventType, state },
    })
    return response.data
  },
  
  async getTornadoAlerts() {
    const response = await client.get('/severe-weather/tornadoes')
    return response.data
  },
  
  async getFloodAlerts() {
    const response = await client.get('/severe-weather/flooding')
    return response.data
  },
  
  async getHailAlerts() {
    const response = await client.get('/severe-weather/hail')
    return response.data
  },
  
  async getStormReports() {
    const response = await client.get('/severe-weather/storm-reports')
    return response.data
  },
}
