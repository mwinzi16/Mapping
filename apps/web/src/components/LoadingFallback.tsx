import React from 'react'

const LoadingFallback: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full bg-gray-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  )
}

export default LoadingFallback
