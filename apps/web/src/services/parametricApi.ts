import axios from 'axios'
import { BoundingBox, HistoricalHurricane, BoxStatistics, AnalysisFilters, DatasetInfo, DatasetType } from '../types/parametric'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const parametricApi = {
  /**
   * Get available hurricane datasets.
   */
  async getAvailableDatasets(): Promise<DatasetInfo[]> {
    const response = await axios.get<DatasetInfo[]>(`${API_BASE}/api/parametric/datasets`)
    return response.data
  },
  
  /**
   * Fetch historical hurricanes based on filters.
   */
  async getHistoricalHurricanes(filters: AnalysisFilters): Promise<HistoricalHurricane[]> {
    const params = new URLSearchParams()
    params.set('start_year', filters.startYear.toString())
    params.set('end_year', filters.endYear.toString())
    params.set('min_category', filters.minCategory.toString())
    params.set('dataset', filters.dataset)
    if (filters.basin) {
      params.set('basin', filters.basin)
    }
    
    const response = await axios.get<HistoricalHurricane[]>(
      `${API_BASE}/api/parametric/hurricanes/historical?${params}`
    )
    return response.data
  },
  
  /**
   * Get hurricanes that intersect with a specific bounding box.
   */
  async getBoxIntersections(
    box: BoundingBox,
    filters: AnalysisFilters
  ): Promise<HistoricalHurricane[]> {
    const response = await axios.post<HistoricalHurricane[]>(
      `${API_BASE}/api/parametric/analysis/intersections`,
      {
        box,
        start_year: filters.startYear,
        end_year: filters.endYear,
        min_category: filters.minCategory,
        basin: filters.basin,
        dataset: filters.dataset,
      }
    )
    return response.data
  },
  
  /**
   * Calculate statistics for a single box.
   */
  async calculateBoxStatistics(
    box: BoundingBox,
    filters: AnalysisFilters
  ): Promise<BoxStatistics> {
    const response = await axios.post<BoxStatistics>(
      `${API_BASE}/api/parametric/analysis/statistics`,
      {
        box,
        start_year: filters.startYear,
        end_year: filters.endYear,
        min_category: filters.minCategory,
        basin: filters.basin,
        dataset: filters.dataset,
      }
    )
    return response.data
  },
  
  /**
   * Calculate statistics for multiple boxes at once.
   */
  async calculateAllBoxStatistics(
    boxes: BoundingBox[],
    filters: AnalysisFilters
  ): Promise<Record<string, BoxStatistics>> {
    const response = await axios.post<Record<string, BoxStatistics>>(
      `${API_BASE}/api/parametric/analysis/bulk-statistics`,
      {
        boxes,
        start_year: filters.startYear,
        end_year: filters.endYear,
        min_category: filters.minCategory,
        basin: filters.basin,
        dataset: filters.dataset,
      }
    )
    return response.data
  },
  
  /**
   * Get available basins for filtering.
   */
  async getBasins(dataset: DatasetType = 'ibtracs'): Promise<string[]> {
    const response = await axios.get<string[]>(`${API_BASE}/api/parametric/basins?dataset=${dataset}`)
    return response.data
  },
  
  /**
   * Get year range of available historical data.
   */
  async getYearRange(dataset: DatasetType = 'ibtracs'): Promise<{ min_year: number; max_year: number }> {
    const response = await axios.get<{ min_year: number; max_year: number }>(
      `${API_BASE}/api/parametric/year-range?dataset=${dataset}`
    )
    return response.data
  },
}
