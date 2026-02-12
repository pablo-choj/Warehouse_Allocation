import { createBrowserRouter, Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { UploadView } from '../features/upload/UploadView'
import { AprobacionesView } from '../features/aprobaciones/AprobacionesView'

function ShellLayout() {
  const location = useLocation()
  const currentYear = new Date().getFullYear()
  const navItems = [
    { path: '/upload', label: 'Upload & Simulate' },
    { path: '/aprobaciones', label: 'Approvals' },
  ]

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-eyebrow">Order to Cash</p>
          <h1>Control Tower</h1>
          <p className="app-subtitle">Warehouse change, allocation, and approvals</p>
        </div>
        <nav className="app-nav" aria-label="Secciones">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path)
            return (
              <Link key={item.path} to={item.path} className={active ? 'app-nav__link app-nav__link--active' : 'app-nav__link'}>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <span>&copy; {currentYear} Command Center</span>
        <span>Build {import.meta.env.MODE}</span>
      </footer>
    </div>
  )
}

function NotFound() {
  return (
    <div className="panel">
      <p className="eyebrow">404</p>
      <h2>Page not found</h2>
      <p>Check the URL or go back to Upload.</p>
      <Link to="/upload" className="ui-button ui-button--primary">
        Go to Upload
      </Link>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    element: <ShellLayout />,
    children: [
      { path: '/', element: <Navigate to="/upload" replace /> },
      { path: '/upload', element: <UploadView /> },
      { path: '/aprobaciones', element: <AprobacionesView /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
