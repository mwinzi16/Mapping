/**
 * Excel utilities for importing/exporting earthquake trigger zone definitions.
 */
import * as XLSX from 'xlsx'
import { EarthquakeBoundingBox, EarthquakeTriggerCriteria, PayoutStructure } from '../types/parametric'

// Template column headers for earthquake zones
const EQ_TEMPLATE_HEADERS = [
  'Zone Name',
  'North (Lat)',
  'South (Lat)',
  'East (Lon)',
  'West (Lon)',
  'Min Magnitude',
  'Max Depth (km)',
  'Min Depth (km)',
  'Payout Type',
  'Payout Limit ($)',
  'Color (optional)',
]

// Example data for template
const EQ_TEMPLATE_EXAMPLES = [
  ['California Coast', 42.0, 32.0, -114.0, -125.0, 6.0, 70, '', 'binary', 1000000, '#FF6B6B'],
  ['Japan Subduction', 45.0, 30.0, 150.0, 130.0, 7.0, 100, 10, 'percentage', 5000000, '#4ECDC4'],
  ['Chile Trench', -20.0, -45.0, -65.0, -75.0, 6.5, '', '', 'tiered', 2000000, '#FFE66D'],
]

/**
 * Generate and download an Excel template for earthquake trigger zone definitions.
 */
export function downloadEarthquakeZoneTemplate(): void {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new()
  
  // Create data with headers and examples
  const data = [
    EQ_TEMPLATE_HEADERS,
    ...EQ_TEMPLATE_EXAMPLES,
  ]
  
  const ws = XLSX.utils.aoa_to_sheet(data)
  
  // Set column widths
  ws['!cols'] = [
    { wch: 20 },  // Zone Name
    { wch: 12 },  // North
    { wch: 12 },  // South
    { wch: 12 },  // East
    { wch: 12 },  // West
    { wch: 14 },  // Min Magnitude
    { wch: 14 },  // Max Depth
    { wch: 14 },  // Min Depth
    { wch: 14 },  // Payout Type
    { wch: 14 },  // Payout Limit
    { wch: 16 },  // Color
  ]
  
  // Add instructions sheet
  const instructionsData = [
    ['Earthquake Trigger Zone Template Instructions'],
    [''],
    ['Required Fields:'],
    ['- Zone Name: A descriptive name for the trigger zone'],
    ['- North (Lat): Northern boundary latitude (-90 to 90)'],
    ['- South (Lat): Southern boundary latitude (-90 to 90)'],
    ['- East (Lon): Eastern boundary longitude (-180 to 180)'],
    ['- West (Lon): Western boundary longitude (-180 to 180)'],
    [''],
    ['Optional Trigger Criteria (leave blank for any):'],
    ['- Min Magnitude: Minimum earthquake magnitude on Richter scale (e.g., 6.0)'],
    ['- Max Depth (km): Maximum depth in kilometers (shallower earthquakes)'],
    ['- Min Depth (km): Minimum depth in kilometers (deeper earthquakes)'],
    [''],
    ['Optional Payout Configuration:'],
    ['- Payout Type: "binary" (full payout if triggered), "percentage" (scales with magnitude), or "tiered" (magnitude tiers)'],
    ['- Payout Limit ($): Maximum payout amount in dollars'],
    ['- Color: Hex color code for map display (e.g., #FF6B6B)'],
    [''],
    ['Notes:'],
    ['- Trigger criteria are cumulative (AND logic)'],
    ['- An earthquake must meet ALL specified criteria to count as "qualifying"'],
    ['- Delete example rows before importing your own data'],
    ['- Magnitude typically ranges from 4.0 to 9.5 for significant events'],
    ['- Shallow earthquakes (< 70km) are often more damaging'],
  ]
  
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData)
  instructionsWs['!cols'] = [{ wch: 80 }]
  
  // Add sheets to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Earthquake Zones')
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions')
  
  // Generate and download
  XLSX.writeFile(wb, 'earthquake_zones_template.xlsx')
}

/**
 * Parse an uploaded Excel file and convert to EarthquakeBoundingBox array.
 */
export async function parseEarthquakeExcelFile(file: File): Promise<EarthquakeBoundingBox[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        }) as unknown[][]
        
        // Skip header row
        const rows = jsonData.slice(1)
        
        const boxes: EarthquakeBoundingBox[] = []
        let rowIndex = 2 // 1-based, starting after header
        
        for (const row of rows) {
          if (!row || row.length === 0) continue
          
          const [name, north, south, east, west, minMag, maxDepth, minDepth, payoutType, payoutLimit, color] = row
          
          // Skip empty rows
          if (!name && !north && !south) continue
          
          // Validate required fields
          const northVal = parseFloat(String(north))
          const southVal = parseFloat(String(south))
          const eastVal = parseFloat(String(east))
          const westVal = parseFloat(String(west))
          
          if (isNaN(northVal) || isNaN(southVal) || isNaN(eastVal) || isNaN(westVal)) {
            console.warn(`Row ${rowIndex}: Invalid coordinates, skipping`)
            rowIndex++
            continue
          }
          
          // Build trigger criteria if any are specified
          let trigger: EarthquakeTriggerCriteria | undefined
          const minMagVal = minMag !== '' ? parseFloat(String(minMag)) : undefined
          const maxDepthVal = maxDepth !== '' ? parseFloat(String(maxDepth)) : undefined
          const minDepthVal = minDepth !== '' ? parseFloat(String(minDepth)) : undefined
          
          if (minMagVal !== undefined || maxDepthVal !== undefined || minDepthVal !== undefined) {
            trigger = {
              min_magnitude: minMagVal,
              max_depth_km: maxDepthVal,
              min_depth_km: minDepthVal,
            }
          }
          
          // Build payout config if specified
          let payout: PayoutStructure | undefined
          const payoutTypeStr = String(payoutType).toLowerCase().trim()
          const payoutLimitVal = payoutLimit !== '' ? parseFloat(String(payoutLimit)) : undefined
          
          if (payoutTypeStr && ['binary', 'percentage', 'tiered'].includes(payoutTypeStr)) {
            payout = {
              payoutType: payoutTypeStr as 'binary' | 'percentage' | 'tiered',
              basePayout: payoutLimitVal || 1000000,
              currency: 'USD',
              tiers: [],
            }
          }
          
          const box: EarthquakeBoundingBox = {
            id: `eq-box-${Date.now()}-${rowIndex}`,
            name: String(name) || `Zone ${boxes.length + 1}`,
            north: northVal,
            south: southVal,
            east: eastVal,
            west: westVal,
            color: color ? String(color) : `hsl(${Math.random() * 360}, 70%, 50%)`,
            trigger,
            payout,
          }
          
          boxes.push(box)
          rowIndex++
        }
        
        if (boxes.length === 0) {
          reject(new Error('No valid earthquake zones found in the file'))
          return
        }
        
        resolve(boxes)
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error}`))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Export current earthquake boxes to Excel file.
 */
export function exportEarthquakeBoxesToExcel(boxes: EarthquakeBoundingBox[]): void {
  const data = [
    EQ_TEMPLATE_HEADERS,
    ...boxes.map((box) => [
      box.name,
      box.north,
      box.south,
      box.east,
      box.west,
      box.trigger?.min_magnitude ?? '',
      box.trigger?.max_depth_km ?? '',
      box.trigger?.min_depth_km ?? '',
      box.payout?.payoutType ?? '',
      box.payout?.basePayout ?? '',
      box.color ?? '',
    ]),
  ]
  
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(data)
  
  ws['!cols'] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
  ]
  
  XLSX.utils.book_append_sheet(wb, ws, 'Earthquake Zones')
  XLSX.writeFile(wb, 'earthquake_zones_export.xlsx')
}
