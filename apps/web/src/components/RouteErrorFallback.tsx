import React from 'react'

interface Props {
  title?: string
  message?: string
}

const RouteErrorFallback: React.FC<Props> = ({ 
  title = 'Page Error', 
  message = 'This section encountered an error. Other parts of the app still work.' 
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white p-8">
      <div className="max-w-md text-center">
        <div className="text-4xl mb-3">🗺️</div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-gray-400 mb-4">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

export default RouteErrorFallback
