import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from './lib/router'
import App from './App'
import { ToastProvider } from './components/ui/Toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <RouterProvider>
        <App />
      </RouterProvider>
    </ToastProvider>
  </React.StrictMode>,
)
