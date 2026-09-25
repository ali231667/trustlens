import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Navbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        <span className="navbar-logo-mark" />
        TrustLens
      </Link>

      <div className="navbar-pill">
        <Link to="/">Home</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/comparison">Compare</Link>
        <Link to="/about">How it works</Link>
        <Link to="/methodology">Methodology</Link>
        <Link to="/extension">Extension</Link>
      </div>

      <div className="navbar-actions">
        {user ? (
          <>
            <span className="navbar-username">{user.full_name}</span>
            <button
              className="navbar-link-button"
              onClick={() => { logout(); navigate('/') }}
            >
              Log out
            </button>
          </>
        ) : (
          <Link to="/login" className="navbar-link-button-link">Log in</Link>
        )}
        <Link to="/" className="navbar-cta">Start a scan</Link>
      </div>
    </nav>
  )
}

export default Navbar
