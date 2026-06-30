import * as XLSX from 'xlsx'

export function exportToExcel(rows: Record<string, unknown>[], filename: string, sheetName = 'Dados') {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const colWidths = Object.keys(rows[0] ?? {}).map(key => ({
    wch: Math.min(Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2, 60)
  }))
  ws['!cols'] = colWidths
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
