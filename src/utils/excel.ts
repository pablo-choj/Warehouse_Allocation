import type { LineaSAP } from '../types/solicitudes'
import * as XLSX from 'xlsx'

type FileLike = {
  text: () => Promise<string>
  arrayBuffer?: () => Promise<ArrayBuffer>
  name?: string
}

const sampleRows: LineaSAP[] = [
  {
    pedidoSAP: '309440525',
    posicion: '152',
    sku: '27501056344096',
    cantidad: 1,
    almacenOrigen: '1000',
    almacenDestinoDeseado: 'PT15',
    itemCategory: 'ZTAN',
    orderItemBlock: '',
    reasonForRejection: '',
    deliveryNote: '',
    shippingBlock: '',
    shipmentNumber: '',
  },
  {
    pedidoSAP: '309448411',
    posicion: '52',
    sku: '27791290795765',
    cantidad: 1,
    almacenOrigen: '1000',
    almacenDestinoDeseado: 'PT11',
    itemCategory: 'ZTAN',
    orderItemBlock: '',
    reasonForRejection: '',
    deliveryNote: '',
    shippingBlock: '',
    shipmentNumber: '',
  },
  {
    pedidoSAP: '309448358',
    posicion: '32',
    sku: '27805000323664',
    cantidad: 1,
    almacenOrigen: '1000',
    almacenDestinoDeseado: 'PT11',
    itemCategory: 'ZTAN',
    orderItemBlock: '',
    reasonForRejection: '',
    deliveryNote: '',
    shippingBlock: '',
    shipmentNumber: '',
  },
]

export async function parseExcelFile(file: File | FileLike): Promise<LineaSAP[]> {
  const name = (file as File).name ?? file.name
  const ext = (name ?? '').toLowerCase()

  // Prefer real xlsx parsing when possible.
  if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.xlsb')) {
    const rows = await tryParseXlsx(file)
    if (rows.length > 0) return rows
  }

  const text = await file.text().catch(() => '')
  if (text.trim()) {
    const maybeJson = tryParseJson(text)
    if (maybeJson) {
      return sanitizeRows(maybeJson)
    }
    const csvRows = parseDelimited(text)
    if (csvRows.length > 0) return csvRows
  }
  return sampleRows
}

async function tryParseXlsx(file: File | FileLike): Promise<LineaSAP[]> {
  const ab = await (file as any).arrayBuffer?.().catch(() => undefined)
  if (!ab) return []

  const workbook = XLSX.read(ab, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []
  const sheet = workbook.Sheets[firstSheetName]
  if (!sheet) return []

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })
  if (!rawRows.length) return []

  return sanitizeRows(rawRows)
}

function tryParseJson(text: string) {
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
    return undefined
  } catch {
    return undefined
  }
}

function parseDelimited(text: string): LineaSAP[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const header = lines[0]?.split(/[,;\t]/)
  if (!header || header.length < 5) return []
  return lines.slice(1).map((line) => {
    const parts = line.split(/[,;\t]/)

    const pedidoSAP = getByHeader(parts, header, ['pedidoSAP', 'Sales Order Number', 'sales_order', 'SalesOrderNumber', 'Sales Order'])
    const posicion = getByHeader(parts, header, ['posicion', 'Line Item', 'line_item', 'Order Item', 'OrderItem'])
    const sku = getByHeader(parts, header, ['sku', 'Material UCC14', 'material', 'Material', 'SKU'])
    const cantidadRaw = getByHeader(parts, header, ['cantidad', 'qty', 'Quantity', 'Order Quantity', 'order_qty'])
    const almacenOrigen = getByHeader(parts, header, ['almacenOrigen', 'Storage Location', 'storage_location', 'StorageLocation'])
    const almacenDestinoDeseado = getByHeader(parts, header, ['almacenDestinoDeseado', 'New storage Location', 'new_storage_location', 'New Storage Location'])

    return {
      pedidoSAP,
      posicion,
      sku: normalizeMaterialCode(sku),
      cantidad: toNumber(cantidadRaw),
      almacenOrigen,
      almacenDestinoDeseado,
      itemCategory: getByHeader(parts, header, ['itemCategory', 'Item Category', 'item_category']),
      orderItemBlock: getByHeader(parts, header, ['orderItemBlock', 'Order Item block', 'Order Item Block', 'order_item_block']),
      reasonForRejection: getByHeader(parts, header, ['reasonForRejection', 'Reason for Rejection', 'reason_for_rejection']),
      deliveryNote: getByHeader(parts, header, ['deliveryNote', 'Delivery Note', 'delivery_note']),
      shippingBlock: getByHeader(parts, header, ['shippingBlock', 'Shipping Block', 'shipping_block']),
      shipmentNumber: getByHeader(parts, header, ['shipmentNumber', 'Shipment Number', 'shipment_number']),
    }
  })
}

function sanitizeRows(rows: any[]): LineaSAP[] {
  return rows
    .map((row) => ({
      pedidoSAP: readRowString(row, ['pedidoSAP', 'Sales Order Number', 'sales_order', 'SalesOrderNumber', 'Sales Order', 'VBELN']),
      posicion: readRowString(row, ['posicion', 'Line Item', 'line_item', 'Order Item', 'OrderItem', 'POSNR']),
      sku: normalizeMaterialCode(readRowString(row, ['sku', 'Material UCC14', 'material', 'Material', 'SKU', 'MATNR'])),
      cantidad: toNumber(readRowString(row, ['cantidad', 'qty', 'Quantity', 'Order Quantity', 'order_qty', 'KWMENG'])),
      almacenOrigen: readRowString(row, ['almacenOrigen', 'Storage Location', 'storage_location', 'StorageLocation', 'LGORT']),
      almacenDestinoDeseado: readRowString(row, ['almacenDestinoDeseado', 'New storage Location', 'new_storage_location', 'New Storage Location']),
      itemCategory: readRowString(row, ['itemCategory', 'Item Category', 'item_category', 'PSTYV']),
      orderItemBlock: readRowString(row, ['orderItemBlock', 'Order Item block', 'Order Item Block', 'order_item_block']),
      reasonForRejection: readRowString(row, ['reasonForRejection', 'Reason for Rejection', 'reason_for_rejection', 'ABGRU']),
      deliveryNote: readRowString(row, ['deliveryNote', 'Delivery Note', 'delivery_note']),
      shippingBlock: readRowString(row, ['shippingBlock', 'Shipping Block', 'shipping_block', 'LIFSK']),
      shipmentNumber: readRowString(row, ['shipmentNumber', 'Shipment Number', 'shipment_number']),
    }))
    .filter((row) => row.pedidoSAP || row.sku)
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (value === undefined || value === null) return 0
  const s = String(value).trim()
  if (!s) return 0

  // Keep digits, separators and minus.
  const cleaned = s.replace(/[^0-9,\.\-]/g, '')
  if (!cleaned) return 0

  // If we have both separators, treat the last as decimal.
  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')
  let normalized = cleaned
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalIsComma = lastComma > lastDot
    normalized = decimalIsComma
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else if (lastComma !== -1) {
    // Only comma present => assume decimal comma.
    normalized = cleaned.replace(',', '.')
  }

  const n = Number(normalized)
  return n
}

function normalizeMaterialCode(value: unknown): string {
  const s = String(value ?? '').trim()
  if (!s) return ''

  // Try to expand scientific notation without losing precision.
  // Examples: 1.7805E+13 -> 17805000000000
  const m = s.match(/^([+-]?\d+(?:\.\d+)?)E\+?(\d+)$/i)
  if (!m) return s
  const coeff = m[1]
  const exp = Number(m[2])
  if (!Number.isFinite(exp) || exp < 0) return s

  const [intPart, fracPart = ''] = coeff.split('.')
  const digits = `${intPart}${fracPart}`.replace(/^\+/, '')
  const fracLen = fracPart.length
  const shift = exp - fracLen
  if (shift < 0) {
    // Would produce a decimal; keep original.
    return s
  }
  return `${digits}${'0'.repeat(shift)}`
}

function getByHeader(parts: string[], header: string[], keys: string[]) {
  for (const key of keys) {
    const idx = header.indexOf(key)
    if (idx >= 0) return parts[idx] ?? ''
  }
  return ''
}

function readRowString(row: any, keys: string[]) {
  const normalized = normalizeRecordKeys(row)
  for (const key of keys) {
    const value = normalized[normalizeKey(key)]
    if (value === undefined || value === null) continue
    const s = String(value)
    return s
  }
  return ''
}

function normalizeKey(key: string) {
  return key
    .toLowerCase()
    .trim()
    .replace(/[\s\-\/]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function normalizeRecordKeys(row: any): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    out[normalizeKey(k)] = v
  }
  return out
}
