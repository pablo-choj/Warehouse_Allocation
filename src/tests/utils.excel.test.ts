/// <reference types="vitest" />
import { describe, expect, it } from 'vitest'
import { parseExcelFile } from '../utils/excel'
import * as XLSX from 'xlsx'

function makeFile(contents: string) {
  return {
    text: async () => contents,
  }
}

describe('utils/excel', () => {
  it('parsea json válido', async () => {
    const file = makeFile(JSON.stringify([{ pedidoSAP: '1', posicion: '10', sku: 'SKU', cantidad: 5, almacenOrigen: 'A', almacenDestinoDeseado: 'B' }]))
    const rows = await parseExcelFile(file)
    expect(rows[0].pedidoSAP).toBe('1')
    expect(rows[0].cantidad).toBe(5)
  })

  it('parsea xlsx real', async () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'Sales Order Number': '45000001',
        'Line Item': '10',
        'Material UCC14': 'SKU-123',
        'Order Quantity': 2,
        'Storage Location': '1000',
        'New storage Location': 'PT15',
        'Item Category': 'ZTAN',
        'Order Item block': '',
        'Reason for Rejection': '',
        'Delivery Note': '',
        'Shipping Block': '',
        'Shipment Number': '',
      },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const ab = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const fileLike = {
      name: 'test.xlsx',
      text: async () => '',
      arrayBuffer: async () => ab,
    }

    const rows = await parseExcelFile(fileLike as any)
    expect(rows[0]?.pedidoSAP).toBe('45000001')
    expect(rows[0]?.almacenOrigen).toBe('1000')
    expect(rows[0]?.itemCategory).toBe('ZTAN')
  })

  it('retorna sample cuando no hay datos', async () => {
    const rows = await parseExcelFile(makeFile('', 'empty.json'))
    expect(rows.length).toBeGreaterThan(0)
  })
})
