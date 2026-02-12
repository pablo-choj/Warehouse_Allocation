import type { LineaSAP, Solicitud } from '../../types/solicitudes'
import { isEmergencialDiario } from '../../utils/timeCL'

export type LineaValidada = LineaSAP & {
  esValida: boolean
  observaciones: string[]
  recomendacion: string
}

export type ResultadoReglas = {
  lineasValidadas: LineaValidada[]
  observacionesGlobales: string[]
  solicitud?: Solicitud
}

export function validarLineas(lineas: LineaSAP[]): LineaValidada[] {
  return lineas.map((linea) => {
    const observaciones: string[] = []
    if (!linea.pedidoSAP || !linea.posicion) {
      observaciones.push('Missing order or line item')
    }
    if (!linea.sku) {
      observaciones.push('Missing SKU')
    }
    if (!Number.isFinite(linea.cantidad) || linea.cantidad <= 0) {
      observaciones.push('Quantity must be a number > 0')
    }
    // Destination can be blank or equal to origin for allocation-only scenarios.
    // We validate only core fields here and classify the scenario in recommendation text.
    const esValida = observaciones.length === 0
    let recomendacion: string

    const origin = (linea.almacenOrigen ?? '').trim().toUpperCase()
    const dest = (linea.almacenDestinoDeseado ?? '').trim().toUpperCase()

    if (!esValida) {
      recomendacion = `Flagged: ${observaciones.join('; ')}`
    } else if (origin === 'PT11' || dest === 'PT11') {
      recomendacion = 'Allocation only: do not create approval ticket'
    } else if (origin === 'PT15' || dest === 'PT15') {
      recomendacion = 'Approval required: create approval ticket + allocation ticket'
    } else if (!dest || dest === origin) {
      recomendacion = 'Allocation only: no warehouse change requested'
    } else {
      recomendacion = 'Allowed: warehouse change / allocation, open ticket with Stock Management'
    }

    return {
      ...linea,
      esValida,
      observaciones,
      recomendacion,
    }
  })
}

export function construirSolicitud(
  lineas: LineaValidada[],
  horaLocalChile: string,
  cliente: string,
  solicitante: string,
): ResultadoReglas {
  const observacionesGlobales: string[] = []

  const invalidas = lineas.filter((l) => !l.esValida)
  const validas = lineas.filter((l) => l.esValida)

  if (invalidas.length > 0) {
    observacionesGlobales.push(`Excluded ${invalidas.length} line(s) due to validation errors:`)

    const preview = invalidas.slice(0, 3)
    for (const l of preview) {
      const id = `${l.pedidoSAP || 'NO_ORDER'} / ${l.posicion || 'NO_LINE'}`
      const reason = l.observaciones.length ? l.observaciones.join('; ') : 'Unknown validation error'
      observacionesGlobales.push(`- ${id}: ${reason}`)
    }

    if (invalidas.length > preview.length) {
      observacionesGlobales.push(`+${invalidas.length - preview.length} more`)
    }
  }

  if (validas.length === 0) {
    observacionesGlobales.push('No valid lines remain after filtering and validation.')
    return { lineasValidadas: lineas, observacionesGlobales }
  }

  const emergencialDiario = isEmergencialDiario(horaLocalChile)
  const accionSugerida: Solicitud['accionSugerida'] = inferirAccion(validas)

  const solicitud: Solicitud = {
    id: generarIdSolicitud(),
    cliente,
    pais: 'Chile',
    horaLocalChile,
    emergencialDiario,
    lineas: validas.map((l) => ({
      pedidoSAP: l.pedidoSAP,
      posicion: l.posicion,
      sku: l.sku,
      cantidad: l.cantidad,
      almacenOrigen: l.almacenOrigen,
      almacenDestinoDeseado: l.almacenDestinoDeseado,
    })),
    accionSugerida,
    estado: 'Pendiente',
    prioridad: emergencialDiario ? 'Alta' : 'Media',
    solicitante,
    fechaEnvioISO: new Date().toISOString(),
    slaHoras: 2,
    comentariosSolicitante: emergencialDiario ? 'Daily emergency' : 'Standard allocation',
    historial: [
      {
        actor: 'System',
        evento: 'Request created',
        fechaISO: new Date().toISOString(),
        nota: emergencialDiario ? 'Marked emergency due to time window' : undefined,
      },
    ],
  }

  return { lineasValidadas: lineas, observacionesGlobales, solicitud }
}

function inferirAccion(lineas: LineaSAP[]): Solicitud['accionSugerida'] {
  const requiereCambioAlmacen = lineas.some((l) => {
    const dest = (l.almacenDestinoDeseado ?? '').trim()
    if (!dest) return false
    return dest !== (l.almacenOrigen ?? '').trim()
  })
  const requiereAlocacion = lineas.some((l) => l.cantidad > 0)
  if (requiereCambioAlmacen && requiereAlocacion) return 'Ambas'
  if (requiereCambioAlmacen) return 'Cambio de almacén'
  return 'Alocación'
}

function generarIdSolicitud() {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return `SOL-${random.slice(0, 8).toUpperCase()}`
}
