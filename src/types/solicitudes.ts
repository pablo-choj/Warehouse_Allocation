export type EstadoSolicitud = 'Pendiente' | 'En revisión' | 'Observada' | 'Aprobada' | 'Rechazada'
export type Prioridad = 'Alta' | 'Media' | 'Baja'

export interface LineaSAP {
  pedidoSAP: string
  posicion: string
  sku: string
  cantidad: number
  almacenOrigen: string
  almacenDestinoDeseado: string

  // Optional SAP columns used for filtering during upload
  itemCategory?: string
  orderItemBlock?: string
  reasonForRejection?: string
  deliveryNote?: string
  shippingBlock?: string
  shipmentNumber?: string
}

export interface Solicitud {
  id: string
  cliente: string
  pais: 'Chile'
  horaLocalChile: string // HH:mm
  emergencialDiario: boolean
  justificacionFueraHorario?: string
  lineas: LineaSAP[]
  accionSugerida: 'Cambio de almacén' | 'Alocación' | 'Ambas'
  estado: EstadoSolicitud
  prioridad: Prioridad
  solicitante: string
  fechaEnvioISO: string
  slaHoras?: number
  comentariosSolicitante?: string
  cambiosSugeridos?: string
  adjuntos?: { nombre: string; url?: string }[]
  historial: { fechaISO: string; actor: string; evento: string; nota?: string }[]
}
