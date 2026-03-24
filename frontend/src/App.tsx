import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryProvider } from './providers/QueryProvider'
import { AuthProvider } from './contexts/AuthContext'
import { AppHeader } from './components/AppHeader'
import { OfflineBanner } from './components/OfflineBanner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { TasksScreen } from './pages/TasksScreen'
import { HealthScreen } from './pages/HealthScreen'
import { LoginScreen } from './pages/LoginScreen'
import { RegisterScreen } from './pages/RegisterScreen'
import { PasswordResetRequestScreen } from './pages/PasswordResetRequestScreen'
import { PasswordResetConfirmScreen } from './pages/PasswordResetConfirmScreen'
import { AuthCallbackScreen } from './pages/AuthCallbackScreen'
import { ProfileScreen } from './pages/ProfileScreen'
import { SettingsPlaceholderScreen } from './pages/SettingsPlaceholderScreen'
import { ListsScreen } from './pages/ListsScreen'
import { ListDetailScreen } from './pages/ListDetailScreen'
import { PushNotificationRegistrar } from './components/PushNotificationRegistrar'
import { BottomNav } from './components/BottomNav'
import { ToastProvider } from './contexts/ToastContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { NotificationSocketBridge } from './components/NotificationSocketBridge'
import './App.css'

/**
 * Root app: auth-protected home; public auth routes for login, register, password reset.
 */
function App() {
  return (
    <div id="app-root">
      <QueryProvider>
        <AuthProvider>
          <PushNotificationRegistrar />
          <BrowserRouter>
            <NotificationProvider>
            <ToastProvider>
            <NotificationSocketBridge />
            <AppHeader />
            <OfflineBanner />
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Navigate to="/tasks" replace />} />
                <Route
                  path="/tasks"
                  element={
                    <ProtectedRoute>
                      <TasksScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/health"
                  element={
                    <ProtectedRoute>
                      <HealthScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfileScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lists"
                  element={
                    <ProtectedRoute>
                      <ListsScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lists/:id"
                  element={
                    <ProtectedRoute>
                      <ListDetailScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPlaceholderScreen />
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
            </ErrorBoundary>
            <BottomNav />
            </ToastProvider>
            </NotificationProvider>
          </BrowserRouter>
        </AuthProvider>
      </QueryProvider>
    </div>
  )
}

export default App
