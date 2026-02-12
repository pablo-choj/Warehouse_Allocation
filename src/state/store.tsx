import { createContext, useContext, useMemo, useReducer } from 'react'
import type React from 'react'
import { initialSolicitudes, solicitudesReducer } from './solicitudes.slice'
import type { SolicitudesAction, SolicitudesState } from './solicitudes.slice'

const StoreContext = createContext<
  | {
      state: SolicitudesState
      dispatch: React.Dispatch<SolicitudesAction>
    }
  | undefined
>(undefined)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(solicitudesReducer, { solicitudes: initialSolicitudes })
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) {
    throw new Error('StoreProvider missing')
  }
  return ctx
}
