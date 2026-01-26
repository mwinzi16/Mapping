import * as XLSX from 'xlsx'
import { TIVRecord } from '../types/indemnity'

/**
 * Download a TIV data template Excel file
 */
export function downloadTIVTemplate(): void {
  const headers = [
    'Location ID',
    'Latitude',
    'Longitude',
    'TIV',
    'Currency',
    'Category',
    'Subcategory',
    'Address',
    'City',
    'State',
    'Country',
    'Postal Code',
    'Construction Type',
    'Year Built',
    'Number of Stories',
    'Occupancy Type',
  ]

  const exampleData = [
    [
      'LOC001',
      25.7617,
      -80.1918,
      1500000,
      'USD',
      'Commercial',
      'Office',
      '100 Main St',
      'Miami',
      'FL',
      'USA',
      '33101',
      'Concrete',
      2005,
      10,
      'Office',
    ],
    [
      'LOC002',
      25.7825,
      -80.2105,
      750000,
      'USD',
      'Residential',
      'Single Family',
      '200 Oak Ave',
      'Miami',
      'FL',
      'USA',
      '33102',
      'Wood Frame',
      1998,
      2,
      'Residential',
    ],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData])

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Location ID
    { wch: 12 }, // Latitude
    { wch: 12 }, // Longitude
    { wch: 15 }, // TIV
    { wch: 10 }, // Currency
    { wch: 12 }, // Category
    { wch: 15 }, // Subcategory
    { wch: 25 }, // Address
    { wch: 15 }, // City
    { wch: 10 }, // State
    { wch: 10 }, // Country
    { wch: 12 }, // Postal Code
    { wch: 15 }, // Construction Type
    { wch: 12 }, // Year Built
    { wch: 15 }, // Number of Stories
    { wch: 15 }, // Occupancy Type
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'TIV Data')

  // Add instructions sheet
  const instructions = [
    ['TIV Data Import Instructions'],
    [''],
    ['Required Fields:'],
    ['- Location ID: Unique identifier for each location'],
    ['- TIV: Total Insured Value (numeric, no currency symbols)'],
    [''],
    ['Recommended for Location Mapping:'],
    ['- Latitude: Decimal degrees (-90 to 90) - needed for point markers'],
    ['- Longitude: Decimal degrees (-180 to 180) - needed for point markers'],
    [''],
    ['Recommended for Choropleth (State/Country View):'],
    ['- State: State or province name - required for state-level aggregation'],
    ['- Country: Country name - required for country-level aggregation'],
    [''],
    ['Optional Fields:'],
    ['- Latitude: Decimal degrees (-90 to 90) - optional if using state/country aggregation'],
    ['- Longitude: Decimal degrees (-180 to 180) - optional if using state/country aggregation'],
    ['- Currency: Default is USD if not specified'],
    ['- Category: e.g., Commercial, Residential, Industrial'],
    ['- Subcategory: More specific classification'],
    ['- Address, City, State, Country, Postal Code: Location details'],
    ['- Construction Type: e.g., Concrete, Wood Frame, Steel'],
    ['- Year Built: Construction year'],
    ['- Number of Stories: Building height'],
    ['- Occupancy Type: How the building is used'],
    [''],
    ['Notes:'],
    ['- Delete example rows before adding your data'],
    ['- TIV values should be positive numbers'],
    ['- Coordinates are optional; state/country choropleth works without them'],
  ]

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions)
  wsInstructions['!cols'] = [{ wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

  XLSX.writeFile(wb, 'TIV_Template.xlsx')
}

/**
 * Parse an Excel file containing TIV data
 */
export async function parseTIVExcelFile(file: File): Promise<TIVRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        // Get the first sheet (skip instructions if present)
        const sheetName = workbook.SheetNames.find(
          (name) => name.toLowerCase() !== 'instructions'
        ) || workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (jsonData.length === 0) {
          reject(new Error('No data found in the Excel file'))
          return
        }

        const records: TIVRecord[] = jsonData.map((row: any, index: number) => {
          // Try to find latitude/longitude columns with various names (optional now)
          const latRaw = row['Latitude'] || row['latitude'] || row['Lat'] || row['lat'] || ''
          const lonRaw = row['Longitude'] || row['longitude'] || row['Lon'] || row['lon'] || row['Long'] || ''
          const lat = latRaw !== '' ? parseFloat(latRaw) : undefined
          const lon = lonRaw !== '' ? parseFloat(lonRaw) : undefined
          const tiv = parseFloat(
            row['TIV'] || row['tiv'] || row['Total Insured Value'] || row['Insured Value'] || '0'
          )

          // Validate coordinates if provided (but don't require them)
          if (lat !== undefined && (isNaN(lat) || lat < -90 || lat > 90)) {
            throw new Error(
              `Row ${index + 2}: Invalid latitude value: ${latRaw}`
            )
          }
          if (lon !== undefined && (isNaN(lon) || lon < -180 || lon > 180)) {
            throw new Error(
              `Row ${index + 2}: Invalid longitude value: ${lonRaw}`
            )
          }

          if (isNaN(tiv) || tiv < 0) {
            throw new Error(`Row ${index + 2}: Invalid TIV value: ${row['TIV']}`)
          }

          return {
            id: String(row['Location ID'] || row['ID'] || row['id'] || `LOC-${index + 1}`),
            latitude: lat,
            longitude: lon,
            tiv: tiv,
            currency: row['Currency'] || row['currency'] || 'USD',
            category: row['Category'] || row['category'] || undefined,
            subcategory: row['Subcategory'] || row['subcategory'] || undefined,
            address: row['Address'] || row['address'] || undefined,
            city: row['City'] || row['city'] || undefined,
            state: row['State'] || row['state'] || row['Province'] || undefined,
            country: row['Country'] || row['country'] || undefined,
            postalCode: String(row['Postal Code'] || row['postalCode'] || row['Zip'] || row['ZIP'] || ''),
            constructionType: row['Construction Type'] || row['constructionType'] || undefined,
            yearBuilt: row['Year Built'] ? parseInt(row['Year Built']) : undefined,
            numberOfStories: row['Number of Stories'] ? parseInt(row['Number of Stories']) : undefined,
            occupancyType: row['Occupancy Type'] || row['occupancyType'] || undefined,
          }
        })

        resolve(records)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Export TIV records to Excel
 */
export function exportTIVToExcel(records: TIVRecord[], filename: string = 'TIV_Export.xlsx'): void {
  const data = records.map((record) => ({
    'Location ID': record.id,
    'Latitude': record.latitude,
    'Longitude': record.longitude,
    'TIV': record.tiv,
    'Currency': record.currency,
    'Category': record.category || '',
    'Subcategory': record.subcategory || '',
    'Address': record.address || '',
    'City': record.city || '',
    'State': record.state || '',
    'Country': record.country || '',
    'Postal Code': record.postalCode || '',
    'Construction Type': record.constructionType || '',
    'Year Built': record.yearBuilt || '',
    'Number of Stories': record.numberOfStories || '',
    'Occupancy Type': record.occupancyType || '',
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'TIV Data')

  XLSX.writeFile(wb, filename)
}

/**
 * Format TIV value for display
 */
export function formatTIV(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format large TIV values with abbreviations
 */
export function formatTIVShort(value: number, currency: string = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''
  
  if (value >= 1e9) {
    return `${symbol}${(value / 1e9).toFixed(1)}B`
  }
  if (value >= 1e6) {
    return `${symbol}${(value / 1e6).toFixed(1)}M`
  }
  if (value >= 1e3) {
    return `${symbol}${(value / 1e3).toFixed(1)}K`
  }
  return `${symbol}${value.toFixed(0)}`
}
