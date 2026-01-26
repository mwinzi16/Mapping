import { useState, useRef } from 'react'
import {
  Trash2,
  Database,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
} from 'lucide-react'
import { useIndemnityStore } from '../../stores/indemnityStore'
import { downloadTIVTemplate, parseTIVExcelFile, exportTIVToExcel, formatTIVShort } from '../../utils/tivExcelUtils'

export default function TIVDataPanel() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const [pendingRecords, setPendingRecords] = useState<any[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    datasets,
    activeDatasetId,
    setActiveDataset,
    removeDataset,
    importTIVData,
    clearAllData,
  } = useIndemnityStore()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const records = await parseTIVExcelFile(file)
      setPendingRecords(records)
      setDatasetName(file.name.replace(/\.[^/.]+$/, ''))
      setShowNameInput(true)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to parse file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const confirmImport = () => {
    if (pendingRecords && datasetName) {
      importTIVData(pendingRecords, datasetName)
      setPendingRecords(null)
      setDatasetName('')
      setShowNameInput(false)
    }
  }

  const cancelImport = () => {
    setPendingRecords(null)
    setDatasetName('')
    setShowNameInput(false)
  }

  const activeDataset = datasets.find(d => d.id === activeDatasetId)

  return (
    <div className="border-t border-gray-700">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-gray-200">TIV Data</span>
        </div>
        <div className="flex items-center space-x-2">
          {datasets.length > 0 && (
            <span className="text-xs text-gray-400">
              {datasets.length} dataset{datasets.length !== 1 ? 's' : ''}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Toolbar */}
          <div className="flex items-center justify-end mb-3 space-x-1">
            {/* Download Template */}
            <button
              onClick={() => downloadTIVTemplate()}
              className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded-lg transition-colors"
              title="Download Excel template"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Upload Excel */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-purple-400 hover:text-purple-300 hover:bg-gray-700 rounded-lg transition-colors"
              title="Upload TIV data"
              disabled={isUploading}
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Export Data */}
            {activeDataset && (
              <button
                onClick={() => exportTIVToExcel(activeDataset.records, `${activeDataset.name}_export.xlsx`)}
                className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-gray-700 rounded-lg transition-colors"
                title="Export TIV data"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
            )}

            {/* Clear All */}
            {datasets.length > 0 && (
              <button
                onClick={clearAllData}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-lg transition-colors"
                title="Clear all data"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Upload Error */}
          {uploadError && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {uploadError}
              <button
                onClick={() => setUploadError(null)}
                className="ml-2 text-red-400 hover:text-red-300"
              >
                ×
              </button>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="mb-4 p-3 bg-purple-900/50 border border-purple-700 rounded-lg text-purple-300 text-sm">
              Processing Excel file...
            </div>
          )}

          {/* Name Input for New Dataset */}
          {showNameInput && pendingRecords && (
            <div className="mb-4 p-4 bg-gray-700/50 rounded-lg space-y-3">
              <p className="text-sm text-gray-300">
                Found <span className="font-bold text-white">{pendingRecords.length}</span> locations
              </p>
              <input
                type="text"
                placeholder="Dataset Name"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={confirmImport}
                  disabled={!datasetName}
                  className="flex-1 flex items-center justify-center space-x-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded text-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Import</span>
                </button>
                <button
                  onClick={cancelImport}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Dataset List */}
          {datasets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No TIV data loaded</p>
              <p className="text-xs mt-1">
                Upload an Excel file with location and TIV data
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    dataset.id === activeDatasetId
                      ? 'bg-purple-900/50 border border-purple-500'
                      : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                  }`}
                  onClick={() => setActiveDataset(dataset.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm">{dataset.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeDataset(dataset.id)
                      }}
                      className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded"
                      title="Remove dataset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-gray-400">
                      <span className="text-white font-medium">{dataset.records.length.toLocaleString()}</span> locations
                    </div>
                    <div className="text-gray-400">
                      Total: <span className="text-purple-400 font-medium">{formatTIVShort(dataset.totalTIV, dataset.currency)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
