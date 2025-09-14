
import { useEffect, useRef, useState, useCallback } from 'react'
import './App.css'

function App() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [src, setSrc] = useState(() => `/legacy/index.html?ts=${Date.now()}`);

  const reloadFrame = useCallback(() => {
    setAttempt((a) => a + 1);
    setSrc(`/legacy/index.html?ts=${Date.now()}`);
  }, []);

  useEffect(() => {
    // No-op: legacy app is isolated in an iframe for reliability
  }, []);

  const handleLoad = useCallback(() => {
    // Verify the iframe actually rendered content; retry once if blank
    try {
      const doc = frameRef.current?.contentDocument;
      const isBlank = !doc || !doc.body || doc.body.children.length === 0;
      if (isBlank && attempt < 2) {
        reloadFrame();
        return;
      }
    } catch {
      // Cross-origin or other access issue: best-effort single retry
      if (attempt < 2) reloadFrame();
    }
  }, [attempt, reloadFrame]);

  const handleError = useCallback(() => {
    if (attempt < 2) reloadFrame();
  }, [attempt, reloadFrame]);

  return (
    <main style={{ height: '100vh', width: '100vw', overflow: 'hidden', margin: 0, padding: 0 }}>
      <iframe
        ref={frameRef}
        src={src}
        title="VisionStack WebSim"
        style={{ border: 'none', width: '100%', height: '100%' }}
        onLoad={handleLoad}
        onError={handleError}
      />
    </main>
  );
}

export default App
