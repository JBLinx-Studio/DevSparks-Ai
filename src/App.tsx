/*
new file: src/App.tsx
Provides a lightweight React wrapper that loads the legacy app from /legacy/index.html in an iframe,
detects whether websim is available, and exposes Puter session info to the iframe via postMessage.
Includes @tweakable annotations for tweaking legacy path.
*/
import React, { useEffect, useRef, useState } from 'react';

/* @tweakable [URL path for the legacy app to load inside iframe] */
const LEGACY_PATH = '/legacy/index.html';

/* @tweakable [Heading font-family (applies --heading-font CSS variable) — set to 'Klasky Csupo New' or another uploaded font name] */
const HEADING_FONT = "Klasky Csupo New, 'Sunkissed Forest', 'Space Mono', sans-serif";

export default function App() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  /* @tweakable [Prefer Websim when available; fallback to Puter otherwise] */
  const [aiSource, setAiSource] = useState<string>(() => {
    const useWebsim = typeof (window as any).websim !== 'undefined';
    return useWebsim ? 'websim' : 'puter';
  });
  const [puterUser, setPuterUser] = useState<any>(null);

  useEffect(() => {
    // Apply the chosen heading font to the document root so CSS uses it via var(--heading-font)
    try { document.documentElement.style.setProperty('--heading-font', HEADING_FONT); } catch (e) {}
  }, []);

  useEffect(() => {
    const onSign = (ev: any) => setPuterUser(ev?.detail || null);
    window.addEventListener('puter:signin', onSign as EventListener);
    try {
      const stored = localStorage.getItem('puter_session');
      if (stored) setPuterUser(JSON.parse(stored));
    } catch {}
    return () => window.removeEventListener('puter:signin', onSign as EventListener);
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!e.data) return;
      // Legacy requests the host's AI selection
      if (e.data.type === 'legacy:request-ai-source') {
        iframeRef.current?.contentWindow?.postMessage({ type: 'host:ai-source', aiSource }, '*');
      }
      // Mirror Puter session from legacy -> host (persist)
      if (e.data.type === 'legacy:puter-session') {
        try {
          localStorage.setItem('puter_session', JSON.stringify(e.data.user));
          setPuterUser(e.data.user);
          // broadcast to other parts of host if needed
          window.dispatchEvent(new CustomEvent('puter:signin', { detail: e.data.user }));
        } catch {}
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [aiSource]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: 12,
          borderBottom: '1px solid #e6e6e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ fontWeight: 700 }}>VisionStack</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#444' }}>
            AI Source: <strong>{aiSource}</strong>
          </div>
          <div style={{ fontSize: 13, color: '#444' }}>
            Puter: <strong>{puterUser ? (puterUser.username || puterUser.id) : 'Not connected'}</strong>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <section style={{ width: 420, borderRight: '1px solid #eee', padding: 12, overflow: 'auto' }}>
          <h4 style={{ marginTop: 0 }}>Control</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setAiSource((s) => (s === 'websim' ? 'puter' : 'websim'))}
            >
              Toggle AI Source
            </button>
            <button
              onClick={() => {
                if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
              }}
            >
              Reload Legacy UI
            </button>
          </div>
        </section>

        <section style={{ flex: 1, position: 'relative' }}>
          <iframe
            ref={iframeRef}
            src={LEGACY_PATH}
            title="Legacy VisionStack"
            style={{ width: '100%', height: '100%', border: '0' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
           /* Provide initial handshake once iframe loads so legacy can request aiSource/session */
           onLoad={() => {
             try {
               // send current aiSource and puter session proactively
               iframeRef.current?.contentWindow?.postMessage({ type: 'host:ai-source', aiSource }, '*');
               const sess = localStorage.getItem('puter_session');
               if (sess) iframeRef.current?.contentWindow?.postMessage({ type: 'host:puter-session', user: JSON.parse(sess) }, '*');
             } catch (e) { /* no-op */ }
           }}
          />
        </section>
      </main>
    </div>
  );
}