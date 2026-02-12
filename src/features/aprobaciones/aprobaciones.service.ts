import type { EstadoSolicitud, Solicitud } from '../../types/solicitudes'

export type Notificacion = {
  tipo: 'aprobador' | 'solicitante'
  mensaje: string
}

export function mockNotificar(tipo: Notificacion['tipo'], solicitud: Solicitud, detalle: string) {
  return new Promise<Notificacion>((resolve) => {
    setTimeout(() => {
      resolve({ tipo, mensaje: `${tipo} | ${solicitud.id}: ${detalle}` })
    }, 350)
  })
}

export function mockActualizarEstado(
  solicitud: Solicitud,
  estado: EstadoSolicitud,
  comentario?: string,
): Promise<Solicitud> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ...solicitud, estado, cambiosSugeridos: comentario })
    }, 450)
  })
}
