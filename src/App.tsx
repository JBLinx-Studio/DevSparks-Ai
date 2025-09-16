
import { useEffect } from 'react'
import './App.css'

function App() {
  useEffect(() => {
    // Load the legacy WebSim app after React mounts
    const loadLegacyApp = async () => {
      try {
        // First ensure the DOM structure exists for the legacy app
        const appContainer = document.querySelector('.app-container');
        if (!appContainer) {
          document.body.innerHTML = '';
          // Load the original index.html content
          const response = await fetch('/index.html');
          const html = await response.text();
          // Extract just the body content
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const bodyContent = doc.body.innerHTML;
          document.body.innerHTML = bodyContent;
        }

        // Load legacy CSS
        if (!document.querySelector('link[href="styles.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = '/styles.css';
          document.head.appendChild(link);
        }

        // Load Google Fonts
        if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
          const fontsLink = document.createElement('link');
          fontsLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap';
          fontsLink.rel = 'stylesheet';
          document.head.appendChild(fontsLink);
        }

        // Load Puter SDK
        if (!window.Puter) {
          const puterScript = document.createElement('script');
          puterScript.src = 'https://js.puter.com/v2/';
          document.head.appendChild(puterScript);
          await new Promise(resolve => puterScript.onload = resolve);
        }

        // Initialize the legacy app
        const { App } = await import('/app.js');
        if (App && !window.__legacyAppInstance) {
          window.__legacyAppInstance = new App();
          console.log('VisionStack legacy app initialized');
        }
      } catch (error) {
        console.error('Failed to load legacy app:', error);
        // Fallback: show a simple loading message
        document.body.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Inter, sans-serif;">
            <div style="text-align: center;">
              <h1 style="color: #3b82f6; margin-bottom: 16px;">VisionStack</h1>
              <p style="color: #666;">Loading your WebSim project...</p>
              <p style="color: #999; font-size: 14px; margin-top: 16px;">If this persists, check console for errors.</p>
            </div>
          </div>
        `;
      }
    };

    loadLegacyApp();
  }, []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      {/* The legacy VisionStack app will take over the entire viewport */}
    </div>
  );
}

export default App
