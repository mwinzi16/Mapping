import axios from 'axios'
import { BoundingBox, HistoricalHurricane, BoxStatistics, AnalysisFilters, DatasetInfo, DatasetType } from '../types/parametric'

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

export const parametricApi = {
  /**
   * Get available hurricane datasets.
   */
  async getAvailableDatasets(): Promise<DatasetInfo[]> {
    const response = await axios.get(`${API_BASE}/parametric/datasets`)
    return response.data.data
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
    
    const response = await axios.get(
      `${API_BASE}/parametric/hurricanes/historical?${params}`
    )
    return response.data.data
  },
  
  /**
   * Get hurricanes that intersect with a specific bounding box.
   */
  async getBoxIntersections(
    box: BoundingBox,
    filters: AnalysisFilters
  ): Promise<HistoricalHurricane[]> {
    const response = await axios.post(
      `${API_BASE}/parametric/analysis/intersections`,
      {
        box,
        start_year: filters.startYear,
        end_year: filters.endYear,
        min_category: filters.minCategory,
        basin: filters.basin,
        dataset: filters.dataset,
      }
    )
    return response.data.data
  },
  
  /**
   * Calculate statistics for a single box.
   */
  async calculateBoxStatistics(
    box: BoundingBox,
    filters: AnalysisFilters
  ): Promise<BoxStatistics> {
    const response = await axios.post(
      `${API_BASE}/parametric/analysis/statistics`,
      {
        box,
        start_year: filters.startYear,
        end_year: filters.endYear,
        min_category: filters.minCategory,
        basin: filters.basin,
        dataset: filters.dataset,
      }
    )
    return response.data.data
  },
  
  /**
   * Calculate statistics for multiple boxes at once.
   */
  async calculateAllBoxStatistics(
    boxes: BoundingBox[],
    filters: AnalysisFilters
  ): Promise<Record<string, BoxStatistics>> {
    const response = await axios.post(
      `${API_BASE}/parametric/analysis/bulk-statistics`,
      {
        boxes,
        start_year: filters.startYear,
        end_year: filters.endYear,
        min_category: filters.minCategory,
        basin: filters.basin,
        dataset: filters.dataset,
      }
    )
    return response.data.data
  },
  
  /**
   * Get available basins for filtering.
   */
  async getBasins(dataset: DatasetType = 'ibtracs'): Promise<string[]> {
    const response = await axios.get(`${API_BASE}/parametric/basins?dataset=${dataset}`)
    return response.data.data
  },
  
  /**
   * Get year range of available historical data.
   */
  async getYearRange(dataset: DatasetType = 'ibtracs'): Promise<{ min_year: number; max_year: number }> {
    const response = await axios.get(
      `${API_BASE}/parametric/year-range?dataset=${dataset}`
    )
    return response.data.data
  },
}
