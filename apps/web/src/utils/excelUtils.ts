/**
 * Excel utilities for importing/exporting trigger zone definitions.
 */
import * as XLSX from 'xlsx'
import { BoundingBox, TriggerCriteria } from '../types/parametric'

// Template column headers
const TEMPLATE_HEADERS = [
  'Zone Name',
  'North (Lat)',
  'South (Lat)',
  'East (Lon)',
  'West (Lon)',
  'Min Category',
  'Min Wind (kt)',
  'Max Pressure (mb)',
  'Color (optional)',
]

// Example data for template
const TEMPLATE_EXAMPLE = [
  'Florida Gulf',
  30.0,
  24.0,
  -80.0,
  -88.0,
  3,
  '',
  '',
  '#FF6B6B',
]

/**
 * Generate and download an Excel template for trigger zone definitions.
 */
export function downloadTriggerZoneTemplate(): void {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new()
  
  // Create data with headers and example
  const data = [
    TEMPLATE_HEADERS,
    TEMPLATE_EXAMPLE,
    ['Caribbean', 20.0, 10.0, -60.0, -85.0, 1, 64, '', '#4ECDC4'],
    ['Gulf of Mexico', 30.0, 18.0, -80.0, -98.0, '', 100, 960, '#FFE66D'],
  ]
  
  const ws = XLSX.utils.aoa_to_sheet(data)
  
  // Set column widths
  ws['!cols'] = [
    { wch: 20 },  // Zone Name
    { wch: 12 },  // North
    { wch: 12 },  // South
    { wch: 12 },  // East
    { wch: 12 },  // West
    { wch: 14 },  // Min Category
    { wch: 14 },  // Min Wind
    { wch: 16 },  // Max Pressure
    { wch: 16 },  // Color
  ]
  
  // Add instructions sheet
  const instructionsData = [
    ['Trigger Zone Template Instructions'],
    [''],
    ['Required Fields:'],
    ['- Zone Name: A descriptive name for the trigger zone'],
    ['- North (Lat): Northern boundary latitude (-90 to 90)'],
    ['- South (Lat): Southern boundary latitude (-90 to 90)'],
    ['- East (Lon): Eastern boundary longitude (-180 to 180)'],
    ['- West (Lon): Western boundary longitude (-180 to 180)'],
    [''],
    ['Optional Trigger Criteria (leave blank for any):'],
    ['- Min Category: Minimum Saffir-Simpson category (0-5, where 0=Tropical Storm)'],
    ['- Min Wind (kt): Minimum wind speed in knots'],
    ['- Max Pressure (mb): Maximum central pressure in millibars (lower = stronger)'],
    ['- Color: Hex color code for map display (e.g., #FF6B6B)'],
    [''],
    ['Notes:'],
    ['- Trigger criteria are cumulative (AND logic)'],
    ['- A hurricane must meet ALL specified criteria to count as "qualifying"'],
    ['- Delete example rows before importing your own data'],
  ]
  
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData)
  instructionsWs['!cols'] = [{ wch: 80 }]
  
  // Add sheets to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Trigger Zones')
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions')
  
  // Generate and download
  XLSX.writeFile(wb, 'trigger_zones_template.xlsx')
}

/**
 * Parse an uploaded Excel file and convert to BoundingBox array.
 */
export async function parseExcelFile(file: File): Promise<BoundingBox[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Get first sheet (should be "Trigger Zones")
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        }) as unknown[][]
        
        // Skip header row
        const rows = jsonData.slice(1)
        
        const boxes: BoundingBox[] = []
        let rowIndex = 2 // 1-based, starting after header
        
        for (const row of rows) {
          if (!row || row.length === 0) continue
          
          const [name, north, south, east, west, minCat, minWind, maxPressure, color] = row
          
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
          let trigger: TriggerCriteria | undefined
          const minCatVal = minCat !== '' ? parseInt(String(minCat)) : undefined
          const minWindVal = minWind !== '' ? parseInt(String(minWind)) : undefined
          const maxPressureVal = maxPressure !== '' ? parseInt(String(maxPressure)) : undefined
          
          if (minCatVal !== undefined || minWindVal !== undefined || maxPressureVal !== undefined) {
            trigger = {
              min_category: minCatVal,
              min_wind_knots: minWindVal,
              max_pressure_mb: maxPressureVal,
            }
          }
          
          const box: BoundingBox = {
            id: `box-${Date.now()}-${rowIndex}`,
            name: String(name) || `Zone ${boxes.length + 1}`,
            north: northVal,
            south: southVal,
            east: eastVal,
            west: westVal,
            color: color ? String(color) : `hsl(${Math.random() * 360}, 70%, 50%)`,
            trigger,
          }
          
          boxes.push(box)
          rowIndex++
        }
        
        if (boxes.length === 0) {
          reject(new Error('No valid trigger zones found in the file'))
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
 * Export current boxes to Excel file.
 */
export function exportBoxesToExcel(boxes: BoundingBox[]): void {
  const data = [
    TEMPLATE_HEADERS,
    ...boxes.map((box) => [
      box.name,
      box.north,
      box.south,
      box.east,
      box.west,
      box.trigger?.min_category ?? '',
      box.trigger?.min_wind_knots ?? '',
      box.trigger?.max_pressure_mb ?? '',
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
    { wch: 16 },
    { wch: 16 },
  ]
  
  XLSX.utils.book_append_sheet(wb, ws, 'Trigger Zones')
  XLSX.writeFile(wb, 'trigger_zones_export.xlsx')
}
