
import { useEffect } from 'react'
import './App.css'

function App() {
  useEffect(() => {
    // Load the VisionStack WebSim app
    const loadWebSimApp = async () => {
      try {
        // Clear React content and load WebSim
        document.body.innerHTML = '';
        
        // Load the WebSim HTML structure
        const response = await fetch('/legacy.html');
        const html = await response.text();
        
        // Parse and extract content
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Insert import map first (before any modules)
        const importMap = doc.querySelector('script[type="importmap"]');
        if (importMap) {
          document.head.prepend(importMap.cloneNode(true));
        }

        // Set body content
        document.body.innerHTML = doc.body.innerHTML;

        // Load WebSim styles
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/styles.css';
        document.head.appendChild(link);

        // Load Google Fonts
        const fonts = document.createElement('link');
        fonts.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap';
        fonts.rel = 'stylesheet';
        document.head.appendChild(fonts);

        // Load Puter SDK
        const puterScript = document.createElement('script');
        puterScript.src = 'https://js.puter.com/v2/';
        document.head.appendChild(puterScript);
        await new Promise(resolve => puterScript.onload = resolve);

        // Initialize WebSim app
        await new Promise(resolve => setTimeout(resolve, 200));
        const { App } = await import(/* @vite-ignore */ '/app.js');
        if (App) {
          new App();
          console.log('VisionStack WebSim loaded successfully');
        }
      } catch (error) {
        console.error('Failed to load VisionStack:', error);
        document.body.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Inter, sans-serif; background: #f7f7f7;">
            <div style="text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <h1 style="color: #3b82f6; margin-bottom: 16px;">VisionStack</h1>
              <p style="color: #666;">Failed to load WebSim interface</p>
              <p style="color: #999; font-size: 14px; margin-top: 8px;">Error: ${error.message}</p>
            </div>
          </div>
        `;
      }
    };

    loadWebSimApp();
  }, []);

  return null;
}

export default App

