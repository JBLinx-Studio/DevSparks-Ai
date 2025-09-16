
import { useEffect, useRef, useState, useCallback } from 'react'
import './App.css'

function App() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [src, setSrc] = useState('/legacy/index.html');

  useEffect(() => {
    // No-op: legacy app is isolated in an iframe for reliability
  }, []);

  const reloadFrame = useCallback(() => {
    setAttempt((a) => a + 1);
    // Cache-bust once if there was an error
    setSrc(`/legacy/index.html?ts=${Date.now()}`);
  }, []);

  // Watchdog: if the iframe stays blank for 2s, retry once
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const doc = frameRef.current?.contentDocument;
        const isBlank = !doc || !doc.body || doc.body.children.length === 0;
        if (isBlank && attempt < 1) reloadFrame();
      } catch {
        if (attempt < 1) reloadFrame();
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [src, attempt, reloadFrame]);

  const handleError = useCallback(() => {
    if (attempt < 2) reloadFrame();
  }, [attempt, reloadFrame]);

  return (
    <main style={{ height: '100vh', width: '100vw', overflow: 'hidden', margin: 0, padding: 0, position: 'relative' }}>
      <iframe
        ref={frameRef}
        src={src}
        title="VisionStack WebSim"
        style={{ border: 'none', width: '100%', height: '100%' }}
        onError={handleError}
      />
      {attempt >= 2 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}>Preview failed to load. Try reloading the legacy app.</div>
            <button onClick={reloadFrame}>Reload Legacy Preview</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App
