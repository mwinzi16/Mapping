import { useState } from 'react'
import { MapPin, Building, Building2, Map, Globe, Grid3X3, ChevronDown, Landmark } from 'lucide-react'
import type { TIVGranularity } from '../../types/indemnity'

interface GranularityOption {
  id: TIVGranularity
  name: string
  icon: React.ReactNode
  description: string
}

const GRANULARITY_OPTIONS: GranularityOption[] = [
  {
    id: 'location',
    name: 'Location',
    icon: <MapPin className="w-4 h-4" />,
    description: 'Individual locations',
  },
  {
    id: 'postal',
    name: 'Postal Code',
    icon: <Building className="w-4 h-4" />,
    description: 'Aggregated by ZIP/postal code',
  },
  {
    id: 'city',
    name: 'City',
    icon: <Building2 className="w-4 h-4" />,
    description: 'Aggregated by city',
  },
  {
    id: 'county',
    name: 'County',
    icon: <Landmark className="w-4 h-4" />,
    description: 'Aggregated by county/parish',
  },
  {
    id: 'state',
    name: 'State/Province',
    icon: <Map className="w-4 h-4" />,
    description: 'Aggregated by state or province',
  },
  {
    id: 'country',
    name: 'Country',
    icon: <Globe className="w-4 h-4" />,
    description: 'Aggregated by country',
  },
  {
    id: 'grid',
    name: 'Grid (0.5°)',
    icon: <Grid3X3 className="w-4 h-4" />,
    description: '0.5 degree grid cells',
  },
]

interface GranularitySelectorProps {
  currentGranularity: TIVGranularity
  onGranularityChange: (granularity: TIVGranularity) => void
  className?: string
}

export default function GranularitySelector({
  currentGranularity,
  onGranularityChange,
  className = '',
}: GranularitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentOption = GRANULARITY_OPTIONS.find((opt) => opt.id === currentGranularity) || GRANULARITY_OPTIONS[0]

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
      >
        <span className="text-purple-400">{currentOption.icon}</span>
        <span className="text-sm text-white">{currentOption.name}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close on click outside */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute top-full left-0 mt-1 bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-700 shadow-xl z-20 min-w-[200px]">
            <div className="py-1">
              {GRANULARITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    onGranularityChange(option.id)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-left transition-colors ${
                    currentGranularity === option.id
                      ? 'bg-purple-900/50 text-purple-300'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span className={currentGranularity === option.id ? 'text-purple-400' : 'text-gray-500'}>
                    {option.icon}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{option.name}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
