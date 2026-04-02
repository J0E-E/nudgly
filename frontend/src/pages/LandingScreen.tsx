import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import logoSvg from '../assets/logo.svg'
import './LandingScreen.css'

export function LandingScreen() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null
  if (isAuthenticated) return <Navigate to="/my-day" replace />

  return (
    <main id="landing-screen" className="landing-screen" aria-label="Welcome">
      <div id="landing-brand" className="landing-brand">
        <img id="landing-logo" src={logoSvg} alt="" className="landing-logo" />
        <span id="landing-brand-text" className="landing-brand-text">udgly</span>
      </div>
      <p id="landing-tagline" className="landing-tagline">Gentle nudges for everything you don't have time to remember.</p>
      <div id="landing-actions" className="landing-actions">
        <Link id="landing-login-link" to="/login" className="landing-btn landing-btn-primary">
          Log in
        </Link>
        <Link id="landing-register-link" to="/register" className="landing-btn landing-btn-secondary">
          Create an account
        </Link>
      </div>
    </main>
  )
}
