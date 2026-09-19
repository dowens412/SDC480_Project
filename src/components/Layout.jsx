import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Clear the locally stored user and return to the login screen.
  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">TW</div>

            <div>
              <h2>Townside Web</h2>
              <p>Client Portal</p>
            </div>
          </div>

          <nav className="nav-links">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/search">Search</NavLink>
            <NavLink to="/leads">Leads</NavLink>
            <NavLink to="/jobs">Jobs</NavLink>
            <NavLink to="/customers">Customers</NavLink>
            <NavLink to="/account">Account</NavLink>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="business-name">
            <span>Business</span>
            <strong>{user?.businessName}</strong>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Townside Web</p>
            <h1>Client Lead & Job Dashboard</h1>
          </div>

          <div className="user-chip">{user?.name}</div>
        </header>

        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
