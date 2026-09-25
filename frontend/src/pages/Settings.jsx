import { Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import '../components/Navbar.css'
import './Settings.css'
import { useAuth } from '../context/AuthContext'

function Settings() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="settings-page">
      <div className="glow-backdrop" />
      <Navbar />

      <div className="settings-hero">
        <div className="eyebrow-chip">
          <span className="eyebrow-dot" />
          ACCOUNT
        </div>
        <h1 className="settings-title">Manage your account</h1>
        <p className="settings-lede">Update your details, change your password, or close your account.</p>
      </div>

      <div className="settings-content">
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-tag tag-green">PROFILE</span>
            <h2>Personal details</h2>
          </div>
          <div className="settings-field">
            <label>Full name</label>
            <input type="text" defaultValue={user.full_name} />
          </div>
          <div className="settings-field">
            <label>Email</label>
            <input type="email" defaultValue={user.email} />
          </div>
          <button className="settings-save">Save changes</button>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-tag tag-amber">SECURITY</span>
            <h2>Password</h2>
          </div>
          <div className="settings-field">
            <label>Current password</label>
            <input type="password" placeholder="••••••••" />
          </div>
          <div className="settings-field">
            <label>New password</label>
            <input type="password" placeholder="••••••••" />
          </div>
          <button className="settings-save">Update password</button>
        </div>

        <div className="settings-card card-danger">
          <div className="settings-card-header">
            <span className="settings-card-tag tag-red">DANGER ZONE</span>
            <h2>Delete account</h2>
          </div>
          <p className="settings-danger-text">
            This permanently deletes your scan history and account. This cannot be undone.
          </p>
          <button className="settings-delete">Delete my account</button>
        </div>
      </div>
    </div>
  )
}

export default Settings
