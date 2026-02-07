import axios from 'axios'
import {
  EarthquakeBoundingBox,
  HistoricalEarthquake,
  EarthquakeBoxStatistics,
  EarthquakeAnalysisFilters,
  EarthquakeDatasetInfo,
} from '../types/parametric'

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

export const earthquakeParametricApi = {
  /**
   * Get available earthquake datasets.
   */
  async getAvailableDatasets(): Promise<EarthquakeDatasetInfo[]> {
    const response = await axios.get(
      `${API_BASE}/earthquake-parametric/datasets`
    )
    return response.data.data
  },

  /**
   * Fetch historical earthquakes based on filters.
   */
  async getHistoricalEarthquakes(
    filters: EarthquakeAnalysisFilters
  ): Promise<HistoricalEarthquake[]> {
    const params = new URLSearchParams()
    params.set('start_year', filters.startYear.toString())
    params.set('end_year', filters.endYear.toString())
    params.set('min_magnitude', filters.minMagnitude.toString())
    params.set('dataset', filters.dataset)

    const response = await axios.get(
      `${API_BASE}/earthquake-parametric/earthquakes/historical?${params}`
    )
    return response.data.data
  },

  /**
   * Get earthquakes that fall within a specific bounding box.
   */
  async getEarthquakesInBox(
    box: EarthquakeBoundingBox,
    filters: EarthquakeAnalysisFilters
  ): Promise<HistoricalEarthquake[]> {
    const response = await axios.post(
      `${API_BASE}/earthquake-parametric/analysis/earthquakes`,
      {
        box,
        start_year: filters.startYear,
        end_year: filters.endYear,
        min_magnitude: filters.minMagnitude,
        dataset: filters.dataset,
      }
    )
    return response.data.data
  },

  /**
   * Calculate statistics for a single box.
   */
  async calculateBoxStatistics(
    box: EarthquakeBoundingBox,
    filters: EarthquakeAnalysisFilters
  ): Promise<EarthquakeBoxStatistics> {
    const response = await axios.post(
      `${API_BASE}/earthquake-parametric/analysis/statistics`,
      {
        box,
        start_year: filters.startYear,
        end_year: filters.endYear,
        min_magnitude: filters.minMagnitude,
        dataset: filters.dataset,
      }
    )
    return response.data.data
  },

  /**
   * Calculate statistics for multiple boxes at once.
   */
  async calculateAllBoxStatistics(
    boxes: EarthquakeBoundingBox[],
    filters: EarthquakeAnalysisFilters
  ): Promise<Record<string, EarthquakeBoxStatistics>> {
    const response = await axios.post(
      `${API_BASE}/earthquake-parametric/analysis/bulk-statistics`,
      {
        boxes,
        start_year: filters.startYear,
        end_year: filters.endYear,
        min_magnitude: filters.minMagnitude,
        dataset: filters.dataset,
      }
    )
    return response.data.data
  },
}
