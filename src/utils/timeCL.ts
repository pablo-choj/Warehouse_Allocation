export function isEmergencialDiario(horaLocalChile: string) {
  const [hh, mm] = horaLocalChile.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return false
  if (hh < 11) return true
  if (hh === 11 && mm === 0) return true
  return false
}

export function requiereJustificacion(horaLocalChile: string) {
  return !isEmergencialDiario(horaLocalChile)
}
