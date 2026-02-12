/// <reference types="vitest" />
import { describe, expect, it } from 'vitest'
import { construirSolicitud, validarLineas } from '../features/upload/upload.rules'

const sampleLineas = [
  {
    pedidoSAP: '4500',
    posicion: '10',
    sku: 'SKU1',
    cantidad: 10,
    almacenOrigen: 'A',
    almacenDestinoDeseado: 'B',
  },
]

describe('upload.rules', () => {
  it('valida lineas y detecta errores', () => {
    const invalid = validarLineas([
      { ...sampleLineas[0], cantidad: 0 },
    ])
    expect(invalid[0].esValida).toBe(false)
    expect(invalid[0].observaciones.length).toBeGreaterThan(0)
  })

  it('construye solicitud emergencial antes de 11:00', () => {
    const lineasValidadas = validarLineas(sampleLineas)
    const { solicitud } = construirSolicitud(lineasValidadas, '10:30', 'Cliente X', 'Solicitante')
    expect(solicitud?.emergencialDiario).toBe(true)
    expect(solicitud?.prioridad).toBe('Alta')
    expect(solicitud?.estado).toBe('Pendiente')
  })

  it('omite solicitud si hay errores', () => {
    const lineasValidadas = validarLineas([
      { ...sampleLineas[0], cantidad: 0 },
    ])
    const resultado = construirSolicitud(lineasValidadas, '12:00', 'Cliente X', 'Solicitante')
    expect(resultado.solicitud).toBeUndefined()
    expect(resultado.observacionesGlobales.join('\n')).toContain('No valid lines remain')
  })

  it('excluye lineas inválidas y crea solicitud con las válidas', () => {
    const lineasValidadas = validarLineas([
      sampleLineas[0],
      { ...sampleLineas[0], posicion: '20', cantidad: 0 },
    ])
    const resultado = construirSolicitud(lineasValidadas, '12:00', 'Cliente X', 'Solicitante')
    expect(resultado.solicitud).toBeDefined()
    expect(resultado.solicitud?.lineas.length).toBe(1)
    expect(resultado.observacionesGlobales.join('\n')).toContain('Excluded 1 line')
  })
})
