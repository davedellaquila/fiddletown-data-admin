// Shared CSV utilities for all modules
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let cell = ''
  let inQuotes = false
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { 
          cell += '"'; 
          i++ 
        } else { 
          inQuotes = false 
        }
      } else {
        cell += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cur.push(cell); cell = '' }
      else if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = '' }
      else if (ch === '\r') { /* ignore */ }
      else cell += ch
    }
  }
  
  if (cell.length || cur.length) { 
    cur.push(cell); 
    rows.push(cur) 
  }
  
  return rows.filter(r => r.length && r.some(c => c.trim() !== ''))
}

export function toCSV(rows: any[], headers: string[]): string {
  const esc = (v: any) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map(h => esc(r[h])).join(','))
  }
  
  return lines.join('\n')
}

export function downloadCSV(data: any[], headers: string[], filename: string) {
  const csv = toCSV(data, headers)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function validateCSVHeaders(actualHeaders: string[], expectedHeaders: string[]): string[] {
  const errors: string[] = []
  const missingHeaders = expectedHeaders.filter(h => !actualHeaders.includes(h))
  
  if (missingHeaders.length > 0) {
    errors.push(`Missing required columns: ${missingHeaders.join(', ')}`)
  }
  
  return errors
}
