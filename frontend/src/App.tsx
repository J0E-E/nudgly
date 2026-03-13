import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AppHeader } from './components/AppHeader'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HealthScreen } from './pages/HealthScreen'
import { LoginScreen } from './pages/LoginScreen'
import { RegisterScreen } from './pages/RegisterScreen'
import { PasswordResetRequestScreen } from './pages/PasswordResetRequestScreen'
import { PasswordResetConfirmScreen } from './pages/PasswordResetConfirmScreen'
import { AuthCallbackScreen } from './pages/AuthCallbackScreen'
import './App.css'

/**
 * Root app: auth-protected home; public auth routes for login, register, password reset.
 */
function App() {
  return (
    <div id="app-root">
      <AuthProvider>
        <BrowserRouter>
          <AppHeader />
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HealthScreen />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/register" element={<RegisterScreen />} />
            <Route
              path="/reset-password"
              element={<PasswordResetRequestScreen />}
            />
            <Route
              path="/reset-password/confirm"
              element={<PasswordResetConfirmScreen />}
            />
            <Route path="/auth/callback" element={<AuthCallbackScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  )
}

export default App
