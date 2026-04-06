import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import MobileApp from './App.mobile.jsx'

// Error display component
function ErrorDisplay({ error, errorInfo }) {
  return (
    <div style={{ 
      padding: 20, 
      background: '#ef4444', 
      color: 'white',
      fontFamily: 'monospace',
      fontSize: 14,
      wordBreak: 'break-word'
    }}>
      <h2 style={{ margin: '0 0 10px 0' }}>App Error</h2>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {error?.toString()}
        {errorInfo?.componentStack}
      </pre>
    </div>
  );
}

// Simple test component
function TestApp() {
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    console.log('TestApp: Component mounted');
    setLoaded(true);
    
    // Test if MobileApp is available
    console.log('MobileApp:', MobileApp);
    if (!MobileApp) {
      setError('MobileApp import failed - component is undefined');
    }
  }, []);

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!loaded) {
    return (
      <div style={{ 
        padding: 20, 
        fontFamily: 'system-ui, sans-serif',
        background: '#0f1117',
        color: '#e8eaf0',
        minHeight: '100vh'
      }}>
        <h1 style={{ color: '#f97316' }}>RentFlow Initializing...</h1>
        <p>Loading React components...</p>
      </div>
    );
  }

  // Render the actual app
  return <MobileApp />;
}

// Global error handler
window.onerror = function(msg, url, line, col, error) {
  console.error('Global error:', msg, url, line, col, error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding:20px;background:#ef4444;color:white;font-family:monospace">
      <h2>JavaScript Error</h2>
      <pre>${msg}\nLine: ${line}:${col}\n${error?.stack || ''}</pre>
    </div>`;
  }
  return true;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TestApp />
  </StrictMode>,
)
