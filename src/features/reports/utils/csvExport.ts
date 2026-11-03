/**
 * Utilidades para generación y descarga segura de archivos CSV.
 * Incorpora protección contra inyección de fórmulas CSV (CSV Injection),
 * preservación de ceros iniciales y codificación UTF-8 con BOM para Excel.
 */

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

/**
 * Sanitiza una celda contra inyección de fórmulas CSV.
 * Si el contenido comienza con caracteres que las hojas de cálculo interpretan como fórmulas,
 * se antepone una comilla simple (') para neutralizar la ejecución y forzar formato texto.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  let str = String(value)

  // Comprobar si inicia con carácter de fórmula ejecutable
  if (str.length > 0 && FORMULA_TRIGGERS.includes(str[0])) {
    str = `'${str}`
  }

  // Si contiene comillas, saltos de línea o comas, escapar con comillas dobles
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`
  }

  return str
}

/**
 * Formatea un código, folio o SKU preservando ceros iniciales en Excel.
 */
export function sanitizeCodeCell(code: string | null | undefined): string {
  if (!code) return ''
  // En hojas de cálculo, ="00123" preserva los ceros a la izquierda sin convertir a entero
  const clean = code.replace(/"/g, '""')
  return `="${clean}"`
}

/**
 * Convierte una matriz de filas en texto CSV con BOM UTF-8.
 */
export function buildCsvContent(params: {
  title: string
  organizationName: string
  branchName: string
  periodLabel: string
  currency: string
  operatorName: string
  generatedAt: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
  summaryRows?: (string | number | null | undefined)[][]
}): string {
  const lines: string[] = []

  // Bloque de metadatos del reporte
  lines.push(`"${params.title}"`)
  lines.push(`"Organización:","${params.organizationName.replace(/"/g, '""')}"`)
  lines.push(`"Sucursal:","${params.branchName.replace(/"/g, '""')}"`)
  lines.push(`"Período:","${params.periodLabel.replace(/"/g, '""')}"`)
  lines.push(`"Generado por:","${params.operatorName.replace(/"/g, '""')}"`)
  lines.push(`"Fecha de generación:","${params.generatedAt}"`)
  lines.push(`"Moneda:","${params.currency}"`)
  lines.push('') // Línea en blanco separadora

  // Encabezados de columnas
  lines.push(params.headers.map(sanitizeCsvCell).join(','))

  // Filas de datos
  for (const row of params.rows) {
    lines.push(row.map(sanitizeCsvCell).join(','))
  }

  // Filas opcionales de resumen o totales
  if (params.summaryRows && params.summaryRows.length > 0) {
    lines.push('')
    lines.push('"--- RESUMEN Y TOTALES ---"')
    for (const sRow of params.summaryRows) {
      lines.push(sRow.map(sanitizeCsvCell).join(','))
    }
  }

  // Retornar con BOM UTF-8 (\uFEFF) para compatibilidad nativa con Excel en Windows
  return '\uFEFF' + lines.join('\r\n')
}

/**
 * Dispara la descarga del archivo CSV en el navegador del usuario.
 */
export function triggerCsvDownload(fileName: string, csvString: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', fileName)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

