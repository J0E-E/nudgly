import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import logoSvg from '../assets/logo.svg'
import './LandingScreen.css'

export function LandingScreen() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null
  if (isAuthenticated) return <Navigate to="/my-day" replace />

  return (
    <main className="landing-screen" aria-label="Welcome">
      <div className="landing-brand">
        <img src={logoSvg} alt="" className="landing-logo" />
        <span className="landing-brand-text">udgly</span>
      </div>
      <p className="landing-tagline">Gentle nudges for everything you don't have time to remember.</p>
      <div className="landing-actions">
        <Link to="/login" className="landing-btn landing-btn-primary">
          Log in
        </Link>
        <Link to="/register" className="landing-btn landing-btn-secondary">
          Create an account
        </Link>
      </div>
    </main>
  )
}
