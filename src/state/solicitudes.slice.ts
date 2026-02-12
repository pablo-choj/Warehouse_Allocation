import type { Solicitud, EstadoSolicitud, Prioridad } from '../types/solicitudes'

export type SolicitudesState = {
  solicitudes: Solicitud[]
}

export type SolicitudesAction =
  | { type: 'set'; payload: Solicitud[] }
  | { type: 'add'; payload: Solicitud }
  | { type: 'updateEstado'; payload: { id: string; estado: EstadoSolicitud; comentario?: string; actor: string } }
  | { type: 'updatePrioridad'; payload: { id: string; prioridad: Prioridad } }
  | { type: 'appendHistorial'; payload: { id: string; evento: string; actor: string; nota?: string } }

export const initialSolicitudes: Solicitud[] = [
  {
    id: 'SOL-001',
    cliente: 'Demo Customer',
    pais: 'Chile',
    horaLocalChile: '10:45',
    emergencialDiario: true,
    accionSugerida: 'Ambas',
    estado: 'Pendiente',
    prioridad: 'Alta',
    solicitante: 'Operations Demo',
    fechaEnvioISO: new Date().toISOString(),
    slaHoras: 2,
    comentariosSolicitante: 'Need warehouse change and allocation to deliver today.',
    lineas: [
      {
        pedidoSAP: '45001234',
        posicion: '10',
        sku: 'SKU-001',
        cantidad: 120,
        almacenOrigen: '001A',
        almacenDestinoDeseado: '002B',
      },
    ],
    adjuntos: [{ nombre: 'lineas.xlsx' }],
    historial: [
      {
        fechaISO: new Date().toISOString(),
        actor: 'System',
        evento: 'Request created (mock)',
      },
    ],
  },
]

export function solicitudesReducer(state: SolicitudesState, action: SolicitudesAction): SolicitudesState {
  switch (action.type) {
    case 'set':
      return { solicitudes: action.payload }
    case 'add':
      return { solicitudes: [action.payload, ...state.solicitudes] }
    case 'updateEstado':
      return {
        solicitudes: state.solicitudes.map((s) =>
          s.id === action.payload.id
            ? {
                ...s,
                estado: action.payload.estado,
                historial: [
                  ...s.historial,
                  {
                    fechaISO: new Date().toISOString(),
                    actor: action.payload.actor,
                    evento: `Estado: ${action.payload.estado}`,
                    nota: action.payload.comentario,
                  },
                ],
              }
            : s,
        ),
      }
    case 'updatePrioridad':
      return {
        solicitudes: state.solicitudes.map((s) =>
          s.id === action.payload.id ? { ...s, prioridad: action.payload.prioridad } : s,
        ),
      }
    case 'appendHistorial':
      return {
        solicitudes: state.solicitudes.map((s) =>
          s.id === action.payload.id
            ? {
                ...s,
                historial: [
                  ...s.historial,
                  {
                    fechaISO: new Date().toISOString(),
                    actor: action.payload.actor,
                    evento: action.payload.evento,
                    nota: action.payload.nota,
                  },
                ],
              }
            : s,
        ),
      }
    default:
      return state
  }
}
