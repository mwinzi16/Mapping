import { useState, useEffect, useRef } from 'react'
import { Bell, Mail, MapPin, X, Check, Loader2 } from 'lucide-react'
import { isAxiosError } from 'axios'
import { client } from '../services/api'

interface SubscriptionFormData {
  email: string
  alert_earthquakes: boolean
  alert_hurricanes: boolean
  alert_wildfires: boolean
  alert_tornadoes: boolean
  alert_flooding: boolean
  alert_hail: boolean
  min_earthquake_magnitude: number
  min_hurricane_category: number
  use_location: boolean
  latitude?: number
  longitude?: number
  radius_km: number
}

interface SubscriptionPayload {
  email: string
  alert_earthquakes: boolean
  alert_hurricanes: boolean
  alert_wildfires: boolean
  alert_tornadoes: boolean
  alert_flooding: boolean
  alert_hail: boolean
  min_earthquake_magnitude: number
  min_hurricane_category: number
  location_filter?: {
    latitude: number
    longitude: number
    radius_km: number
  }
}

export default function SubscribeModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean
  onClose: () => void 
}) {
  const [step, setStep] = useState<'form' | 'success' | 'error'>('form')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  
  const [formData, setFormData] = useState<SubscriptionFormData>({
    email: '',
    alert_earthquakes: true,
    alert_hurricanes: true,
    alert_wildfires: true,
    alert_tornadoes: true,
    alert_flooding: true,
    alert_hail: true,
    min_earthquake_magnitude: 5.0,
    min_hurricane_category: 1,
    use_location: false,
    radius_km: 500,
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')
    
    try {
      const payload: SubscriptionPayload = {
        email: formData.email,
        alert_earthquakes: formData.alert_earthquakes,
        alert_hurricanes: formData.alert_hurricanes,
        alert_wildfires: formData.alert_wildfires,
        alert_tornadoes: formData.alert_tornadoes,
        alert_flooding: formData.alert_flooding,
        alert_hail: formData.alert_hail,
        min_earthquake_magnitude: formData.min_earthquake_magnitude,
        min_hurricane_category: formData.min_hurricane_category,
        ...(formData.use_location && formData.latitude && formData.longitude
          ? {
              location_filter: {
                latitude: formData.latitude,
                longitude: formData.longitude,
                radius_km: formData.radius_km,
              },
            }
          : {}),
      }
      
      await client.post('/subscriptions/subscribe', payload)
      setStep('success')
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErrorMessage(err.response.data?.detail || 'Failed to subscribe')
      } else {
        setErrorMessage('Network error. Please try again.')
      }
      setStep('error')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            use_location: true,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }))
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }

  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    // Focus first focusable element when modal opens
    const timer = setTimeout(() => {
      const firstInput = modalRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([type="file"]), button, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      firstInput?.focus()
    }, 0)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not([type="file"]), button, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusableElements || focusableElements.length === 0) return
        const firstEl = focusableElements[0]
        const lastEl = focusableElements[focusableElements.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault()
            lastEl.focus()
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault()
            firstEl.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])
  
  if (!isOpen) return null
  
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribe-modal-title"
    >
      <div ref={modalRef} className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2 rounded-lg">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <h2 id="subscribe-modal-title" className="text-xl font-bold text-white">Subscribe to Alerts</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  placeholder="your@email.com"
                  aria-label="Email address"
                />
              </div>
              
              {/* Event Types */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Alert me about:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'alert_earthquakes', label: '🔴 Earthquakes', emoji: '🔴' },
                    { key: 'alert_hurricanes', label: '🌀 Hurricanes', emoji: '🌀' },
                    { key: 'alert_wildfires', label: '🔥 Wildfires', emoji: '🔥' },
                    { key: 'alert_tornadoes', label: '🌪️ Tornadoes', emoji: '🌪️' },
                    { key: 'alert_flooding', label: '🌊 Flooding', emoji: '🌊' },
                    { key: 'alert_hail', label: '🧊 Hail', emoji: '🧊' },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                        formData[key as keyof SubscriptionFormData]
                          ? 'bg-red-600/20 border border-red-500'
                          : 'bg-gray-700 border border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData[key as keyof SubscriptionFormData] as boolean}
                        onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="sr-only"
                      />
                      <span className="text-sm text-white">{label}</span>
                      {formData[key as keyof SubscriptionFormData] && (
                        <Check className="w-4 h-4 text-red-500 ml-auto" />
                      )}
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Thresholds */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Min. Earthquake Magnitude
                  </label>
                  <select
                    value={formData.min_earthquake_magnitude}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      min_earthquake_magnitude: parseFloat(e.target.value) 
                    }))}
                    className="w-full bg-gray-700 text-white rounded-lg px-3 py-2"
                  >
                    <option value={3.0}>M 3.0+</option>
                    <option value={4.0}>M 4.0+</option>
                    <option value={5.0}>M 5.0+</option>
                    <option value={6.0}>M 6.0+</option>
                    <option value={7.0}>M 7.0+</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Min. Hurricane Category
                  </label>
                  <select
                    value={formData.min_hurricane_category}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      min_hurricane_category: parseInt(e.target.value) 
                    }))}
                    className="w-full bg-gray-700 text-white rounded-lg px-3 py-2"
                  >
                    <option value={0}>All Storms</option>
                    <option value={1}>Category 1+</option>
                    <option value={2}>Category 2+</option>
                    <option value={3}>Category 3+ (Major)</option>
                    <option value={4}>Category 4+</option>
                    <option value={5}>Category 5</option>
                  </select>
                </div>
              </div>
              
              {/* Location Filter */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.use_location}
                    onChange={(e) => setFormData(prev => ({ ...prev, use_location: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-red-600 focus:ring-red-500"
                  />
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">Only alert me about nearby events</span>
                </label>
                
                {formData.use_location && (
                  <div className="pl-6 space-y-3">
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      className="text-sm text-red-400 hover:text-red-300 underline"
                    >
                      Use my current location
                    </button>
                    
                    {formData.latitude && formData.longitude && (
                      <p className="text-xs text-gray-400">
                        Location: {formData.latitude.toFixed(2)}°, {formData.longitude.toFixed(2)}°
                      </p>
                    )}
                    
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Radius</label>
                      <select
                        value={formData.radius_km}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          radius_km: parseInt(e.target.value) 
                        }))}
                        className="bg-gray-700 text-white rounded px-3 py-1 text-sm"
                      >
                        <option value={100}>100 km</option>
                        <option value={250}>250 km</option>
                        <option value={500}>500 km</option>
                        <option value={1000}>1000 km</option>
                        <option value={2500}>2500 km</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    Subscribe to Alerts
                  </>
                )}
              </button>
              
              <p className="text-xs text-gray-500 text-center">
                We'll send you a verification email. You can unsubscribe at any time.
              </p>
            </form>
          )}
          
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Check Your Email!</h3>
              <p className="text-gray-400 mb-6">
                We've sent a verification link to <strong>{formData.email}</strong>. 
                Click the link to activate your alerts.
              </p>
              <button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}
          
          {step === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Something went wrong</h3>
              <p className="text-gray-400 mb-6">{errorMessage}</p>
              <button
                onClick={() => setStep('form')}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
