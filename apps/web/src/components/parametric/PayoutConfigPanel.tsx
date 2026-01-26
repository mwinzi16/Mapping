import { useState } from 'react'
import { DollarSign, Plus, Trash2, ChevronDown, ChevronUp, Percent } from 'lucide-react'
import type { PayoutStructure, PayoutTier } from '../../types/parametric'

interface PayoutConfigPanelProps {
  payout?: PayoutStructure
  onChange: (payout: PayoutStructure) => void
  perilType: 'earthquake' | 'hurricane'
  className?: string
}

const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF']

const DEFAULT_EARTHQUAKE_TIERS: PayoutTier[] = [
  { id: '1', name: 'Moderate', minIntensity: 5.0, maxIntensity: 5.9, payoutMultiplier: 0.25, payoutPercent: 25 },
  { id: '2', name: 'Strong', minIntensity: 6.0, maxIntensity: 6.9, payoutMultiplier: 0.5, payoutPercent: 50 },
  { id: '3', name: 'Major', minIntensity: 7.0, maxIntensity: 7.9, payoutMultiplier: 0.75, payoutPercent: 75 },
  { id: '4', name: 'Great', minIntensity: 8.0, payoutMultiplier: 1.0, payoutPercent: 100 },
]

const DEFAULT_HURRICANE_TIERS: PayoutTier[] = [
  { id: '1', name: 'Category 1', minIntensity: 1, maxIntensity: 1, payoutMultiplier: 0.2, payoutPercent: 20 },
  { id: '2', name: 'Category 2', minIntensity: 2, maxIntensity: 2, payoutMultiplier: 0.4, payoutPercent: 40 },
  { id: '3', name: 'Category 3', minIntensity: 3, maxIntensity: 3, payoutMultiplier: 0.6, payoutPercent: 60 },
  { id: '4', name: 'Category 4', minIntensity: 4, maxIntensity: 4, payoutMultiplier: 0.8, payoutPercent: 80 },
  { id: '5', name: 'Category 5', minIntensity: 5, payoutMultiplier: 1.0, payoutPercent: 100 },
]

type PayoutType = 'binary' | 'percentage' | 'tiered'

export default function PayoutConfigPanel({
  payout,
  onChange,
  perilType,
  className = '',
}: PayoutConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const defaultTiers = perilType === 'earthquake' ? DEFAULT_EARTHQUAKE_TIERS : DEFAULT_HURRICANE_TIERS
  
  const currentPayout: PayoutStructure = payout || {
    basePayout: 1000000,
    currency: 'USD',
    payoutType: 'tiered',
    tiers: defaultTiers,
  }

  const handleBasePayoutChange = (value: number) => {
    onChange({ ...currentPayout, basePayout: value })
  }

  const handleCurrencyChange = (currency: string) => {
    onChange({ ...currentPayout, currency })
  }

  const handlePayoutTypeChange = (payoutType: PayoutType) => {
    onChange({ ...currentPayout, payoutType })
  }

  const handleTierChange = (tierId: string, field: keyof PayoutTier, value: number | string) => {
    const newTiers = currentPayout.tiers.map((tier) =>
      tier.id === tierId ? { ...tier, [field]: value } : tier
    )
    onChange({ ...currentPayout, tiers: newTiers })
  }

  const addTier = () => {
    const newTier: PayoutTier = {
      id: crypto.randomUUID(),
      name: `Tier ${currentPayout.tiers.length + 1}`,
      minIntensity: 0,
      payoutMultiplier: 0.5,
      payoutPercent: 50,
    }
    onChange({ ...currentPayout, tiers: [...currentPayout.tiers, newTier] })
  }

  const removeTier = (tierId: string) => {
    onChange({
      ...currentPayout,
      tiers: currentPayout.tiers.filter((t) => t.id !== tierId),
    })
  }

  const applyDefaults = () => {
    onChange({
      basePayout: 1000000,
      currency: 'USD',
      payoutType: 'tiered',
      tiers: defaultTiers,
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currentPayout.currency,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Calculate payout based on type
  const calculateTierPayout = (tier: PayoutTier): number => {
    if (tier.fixedPayout !== undefined) return tier.fixedPayout
    if (currentPayout.payoutType === 'percentage' && tier.payoutPercent !== undefined) {
      return currentPayout.basePayout * (tier.payoutPercent / 100)
    }
    return currentPayout.basePayout * tier.payoutMultiplier
  }

  const intensityLabel = perilType === 'earthquake' ? 'Magnitude' : 'Category'
  const isPercentageMode = currentPayout.payoutType === 'percentage'

  return (
    <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          <span className="font-medium text-white">Payout Configuration</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">
            Base: {formatCurrency(currentPayout.basePayout)}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-4">
          {/* Payout Type Selector */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Payout Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePayoutTypeChange('binary')}
                className={`px-3 py-2 text-xs rounded border ${
                  currentPayout.payoutType === 'binary'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-650'
                }`}
              >
                Binary (All or Nothing)
              </button>
              <button
                onClick={() => handlePayoutTypeChange('percentage')}
                className={`px-3 py-2 text-xs rounded border ${
                  currentPayout.payoutType === 'percentage'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-650'
                }`}
              >
                <Percent className="w-3 h-3 inline mr-1" />
                Percentage
              </button>
              <button
                onClick={() => handlePayoutTypeChange('tiered')}
                className={`px-3 py-2 text-xs rounded border ${
                  currentPayout.payoutType === 'tiered'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-650'
                }`}
              >
                Tiered Multiplier
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {currentPayout.payoutType === 'binary' && 'Single payout when trigger conditions are met'}
              {currentPayout.payoutType === 'percentage' && 'Payout as percentage of limit based on intensity'}
              {currentPayout.payoutType === 'tiered' && 'Multiple payout tiers with different multipliers'}
            </p>
          </div>

          {/* Base payout and currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {currentPayout.payoutType === 'binary' ? 'Payout Amount' : 'Limit / Base Payout'}
              </label>
              <input
                type="number"
                value={currentPayout.basePayout}
                onChange={(e) => handleBasePayoutChange(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                min={0}
                step={10000}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Currency</label>
              <select
                value={currentPayout.currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                {DEFAULT_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tiers - only show for non-binary types */}
          {currentPayout.payoutType !== 'binary' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-400">
                  Payout Tiers ({currentPayout.tiers.length})
                </label>
                <button
                  onClick={applyDefaults}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Reset to defaults
                </button>
              </div>

              <div className="space-y-2">
                {currentPayout.tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="flex items-center space-x-2 p-2 bg-gray-750 rounded border border-gray-600"
                  >
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => handleTierChange(tier.id, 'name', e.target.value)}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                        placeholder="Name"
                      />
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">{intensityLabel}</span>
                        <input
                          type="number"
                          value={tier.minIntensity}
                          onChange={(e) => handleTierChange(tier.id, 'minIntensity', Number(e.target.value))}
                          className="w-14 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                          step={perilType === 'earthquake' ? 0.1 : 1}
                        />
                        {tier.maxIntensity !== undefined && (
                          <>
                            <span className="text-gray-500">-</span>
                            <input
                              type="number"
                              value={tier.maxIntensity}
                              onChange={(e) => handleTierChange(tier.id, 'maxIntensity', Number(e.target.value))}
                              className="w-14 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                              step={perilType === 'earthquake' ? 0.1 : 1}
                            />
                          </>
                        )}
                      </div>
                      {/* Percentage or Multiplier input based on type */}
                      <div className="flex items-center space-x-1">
                        {isPercentageMode ? (
                          <>
                            <input
                              type="number"
                              value={tier.payoutPercent ?? tier.payoutMultiplier * 100}
                              onChange={(e) => handleTierChange(tier.id, 'payoutPercent', Number(e.target.value))}
                              className="w-14 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                              step={5}
                              min={0}
                              max={100}
                            />
                            <span className="text-xs text-gray-500">%</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-gray-500">×</span>
                            <input
                              type="number"
                              value={tier.payoutMultiplier}
                              onChange={(e) => handleTierChange(tier.id, 'payoutMultiplier', Number(e.target.value))}
                              className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                              step={0.05}
                              min={0}
                              max={10}
                            />
                          </>
                        )}
                      </div>
                      <div className="text-xs text-green-400 flex items-center justify-end">
                        {formatCurrency(calculateTierPayout(tier))}
                      </div>
                    </div>
                    <button
                      onClick={() => removeTier(tier.id)}
                      className="p-1 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addTier}
                className="mt-2 flex items-center space-x-1 text-sm text-blue-400 hover:text-blue-300"
              >
                <Plus className="w-4 h-4" />
                <span>Add tier</span>
              </button>
            </div>
          )}

          {/* Summary */}
          <div className="p-2 bg-gray-750 rounded border border-gray-600">
            <div className="text-xs text-gray-400 mb-1">Payout Range</div>
            <div className="text-sm text-white">
              {currentPayout.payoutType === 'binary' ? (
                formatCurrency(currentPayout.basePayout)
              ) : (
                <>
                  {formatCurrency(Math.min(...currentPayout.tiers.map(t => calculateTierPayout(t))))}
                  {' '}-{' '}
                  {formatCurrency(Math.max(...currentPayout.tiers.map(t => calculateTierPayout(t))))}
                </>
              )}
            </div>
            {currentPayout.payoutType !== 'binary' && (
              <div className="text-xs text-gray-500 mt-1">
                {currentPayout.tiers.length} tier{currentPayout.tiers.length !== 1 ? 's' : ''} configured
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
