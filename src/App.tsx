
import { useEffect } from 'react'
import './App.css'

function App() {
  useEffect(() => {
    // Load the legacy WebSim app after React mounts
    const loadLegacyApp = async () => {
      try {
        // Clear the React root and replace with WebSim HTML structure
        document.body.innerHTML = '';
        
        // Load the original index.html content
        const response = await fetch('/index.html');
        const html = await response.text();
        
        // Extract just the body content
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const bodyContent = doc.body.innerHTML;
        document.body.innerHTML = bodyContent;

        // Load legacy CSS
        if (!document.querySelector('link[href="/styles.css"]')) {
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

        // Wait a moment for DOM to settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize the legacy app
        const { App } = await import('/app.js');
        if (App && !window.__legacyAppInstance) {
          window.__legacyAppInstance = new App();
          console.log('VisionStack WebSim app initialized successfully');
        }
      } catch (error) {
        console.error('Failed to load WebSim app:', error);
        // Fallback: show a simple loading message
        document.body.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Inter, sans-serif; background: #f7f7f7;">
            <div style="text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <h1 style="color: #3b82f6; margin-bottom: 16px; font-size: 24px;">VisionStack</h1>
              <p style="color: #666; margin-bottom: 8px;">Loading WebSim interface...</p>
              <p style="color: #999; font-size: 14px;">Error: ${error.message}</p>
              <p style="color: #999; font-size: 12px; margin-top: 16px;">Check console for details</p>
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
