import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HealthScreen } from './pages/HealthScreen'
import './App.css'

/**
 * Root app: routing skeleton. Single route for health screen in Epic 1.
 */
function App() {
  return (
    <div id="app-root">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HealthScreen />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
