import type { ReactNode } from 'react'
import { ValidationForm } from '../features/validation/ValidationForm'

export type AppRoute = {
  path: string
  title: string
  description?: string
  element: ReactNode
}

export const routes: AppRoute[] = [
  {
    path: '/',
    title: 'Validación',
    description: 'Chequear Foundry vs Proxy en un solo lugar',
    element: <ValidationForm />,
  },
]

export function AppRoutes() {
  const [{ element }] = routes
  return <>{element}</>
}
