/* @tweakable [Controls whether legacy scripts are auto-mounted inside the React LegacyHost] */
const ENABLE_LEGACY_MOUNT = true;

/* @tweakable [List of legacy script paths to mount into the DOM (order is important). These are the old in-page scripts that expect global scope.] */
const LEGACY_SCRIPTS = [
  'app.js',
  'previewManager.js',
  'chatManager.js',
  'githubManager.js'
];

/**
 * LegacyHost
 * A lightweight React component that mounts legacy global scripts into the page
 * inside a detached DOM node so their globals (window.*) are still available but
 * they remain encapsulated from React rendering. This preserves the old behavior
 * (app.js, previewManager.js, chatManager.js, githubManager.js) while allowing
 * your new app to run under React/Vite.
 */
export default function LegacyHost() {
  // Only mount in browsers that need it
  if (typeof window === 'undefined' || !ENABLE_LEGACY_MOUNT) {
    return null;
  }

  // Ensure scripts are only injected once
  if (!window.__DEVSPARK_LEGACY_MOUNTED__) {
    window.__DEVSPARK_LEGACY_LEGACY_NODE__ = document.createElement('div');
    window.__DEVSPARK_LEGACY_LEGACY_NODE__.id = 'devspark-legacy-node';
    window.__DEVSPARK_LEGACY_LEGACY_NODE__.style.display = 'none';
    document.body.appendChild(window.__DEVSPARK_LEGACY_LEGACY_NODE__);

    (async function injectScripts() {
      for (const src of LEGACY_SCRIPTS) {
        try {
          // Load as module if file declares exports; otherwise fall back to classic script injection.
          // We attempt dynamic import first to leverage ESM in modern environments (Vite dev).
          try {
            await import(/* @vite-ignore */ `./${src}`);
            // imported successfully as module
          } catch (e) {
            // fallback: append classic script so scripts that rely on globals execute
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = `./${src}`;
              s.async = false; // preserve execution order
              s.onload = () => resolve();
              s.onerror = (err) => {
                console.error('Failed to load legacy script via <script>: ', src, err);
                resolve(); // don't block other scripts
              };
              window.__DEVSPARK_LEGACY_LEGACY_NODE__.appendChild(s);
            });
          }
        } catch (err) {
          console.error('Error injecting legacy script', src, err);
        }
      }

      // Mark mounted so we don't inject again
      window.__DEVSPARK_LEGACY_MOUNTED__ = true;

      // If the legacy app exposes an entry initializer, call it to ensure legacy lifecycle runs.
      try {
        if (window.App && typeof window.App === 'function' && !window.__DEVSPARK_LEGACY_APP_STARTED__) {
          // In many legacy setups App is constructed on DOMContentLoaded; call it defensively.
          try {
            // If App is a class that auto-instantiates internally, skip
            // Otherwise create a global instance so older code referencing `window.appInstance` finds it.
            window.__legacyAppInstance = new window.App();
            window.__DEVSPARK_LEGACY_APP_STARTED__ = true;
            console.info('Legacy App initialized via LegacyHost.');
          } catch (e) {
            // not constructable — ignore
            console.info('Legacy App constructor not invoked (likely auto-initialized).');
          }
        }
      } catch (e) {
        console.warn('Error starting legacy App instance:', e);
      }
    })();
  }

  // Render nothing visible - this component just ensures scripts are loaded
  return null;
}
```
