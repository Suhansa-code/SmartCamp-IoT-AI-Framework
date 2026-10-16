import React from 'react'
import { Routes, Route, useRouter } from './lib/router'
import { AuthProvider } from './lib/AuthContext'
import DashboardPage from './components/DashboardPage'
import DisasterMonitorPage from './components/disaster/DisasterMonitorPage'
import RegistrationScreen from './components/resources/RegistrationScreen'
import WristbandScanScreen from './components/resources/WristbandScanScreen'
import WristbandsScreen from './components/resources/WristbandsScreen'
import ChildEducationScreen from './components/childEducation/ChildEducationScreen'
import NetworkScreen from './components/resources/NetworkScreen'
import DeviceHealthScreen from './components/resources/DeviceHealthScreen'
import Navbar from './components/ui/layout/Navbar'
import ChildFlow from './components/ChildFlow'
import AuthorizePage from './components/AuthorizePage'
import ProtectedRoute from './components/ProtectedRoute'

function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-white" >
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 sm:py-8">
        {children}
      </main>
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
          <Route path="/wristbands" element={<WristbandsScreen />} />
          <Route path="/network" element={<NetworkScreen />} />
          <Route path="/devices" element={<DeviceHealthScreen />} />
          <Route path="/educationscreen" element={<ChildEducationScreen />} />
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
