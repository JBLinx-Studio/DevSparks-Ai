
import { useEffect } from 'react'
import './App.css'

function App() {
  useEffect(() => {
    // No-op: legacy app is isolated in an iframe for reliability
  }, []);

  return (
    <main style={{ height: '100vh', width: '100vw', overflow: 'hidden', margin: 0, padding: 0 }}>
      <iframe
        src="/legacy/index.html"
        title="VisionStack WebSim"
        style={{ border: 'none', width: '100%', height: '100%' }}
      />
    </main>
  );
}

export default App
