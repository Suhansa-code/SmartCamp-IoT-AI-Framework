import React from 'react'
import { Routes, Route, useRouter } from './lib/router'
import { AuthProvider } from './lib/AuthContext'
import DashboardPage from './components/resources/DashboardPage'
import DisasterMonitorPage from './components/resources/DisasterMonitorPage'
import RegistrationScreen from './components/resources/RegistrationScreen'
import WristbandScanScreen from './components/resources/WristbandScanScreen'
import ChildEducationScreen from './components/childEducation/ChildEducationScreen'
import PredictionScreen from './components/resources/PredictionScreen'
import NetworkScreen from './components/resources/NetworkScreen'
import Navbar from './components/Navbar'
import ChildFlow from './components/ChildFlow'
import AuthorizePage from './components/AuthorizePage'
import ProtectedRoute from './components/ProtectedRoute'

function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar />
      <div className="p-6">{children}</div>
    </div>
  )
}

function AdminRoutes() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/disaster" element={<DisasterMonitorPage />} />
          <Route path="/registration" element={<RegistrationScreen />} />
          <Route path="/wristband" element={<WristbandScanScreen />} />
          <Route path="/prediction" element={<PredictionScreen />} />
          <Route path="/network" element={<NetworkScreen />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function AppContent() {
  const { path } = useRouter()
  if (path.startsWith('/child')) {
    return <ChildFlow />
  }
  if (path === '/authorize') {
    return <AuthorizePage />
  }
  return <AdminRoutes />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
