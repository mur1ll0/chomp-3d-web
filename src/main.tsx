import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from './ErrorBoundary'

// Global error handler to log errors
window.addEventListener('error', (e) => console.error('GLOBAL ERROR:', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => console.error('UNHANDLED REJECTION:', e.reason));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
