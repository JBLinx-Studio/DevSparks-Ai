// Lightweight runtime wrapper (root) for Lovable / plain-browser usage.
// This file bridges the TS module at /src/integrations/puter/puter_integration.ts
// to a plain ES module consumers expect (index.html references /puter_integration.js).
//
// It intentionally keeps surface area minimal and mirrors the default export onto window.
// No bundler required — runs as an ES module in browsers that support import maps or bare imports.

import puterIntegrationModule from '/src/integrations/puter/puter_integration.ts';

(async () => {
  try {
    const puter = (puterIntegrationModule && (puterIntegrationModule.default || puterIntegrationModule)) || puterIntegrationModule;
    // ensure init started
    if (puter && typeof puter.initInBackground === 'function') {
      await puter.initInBackground().catch(() => {});
    }
    // Expose to window for legacy scripts
    window.PuterIntegration = puter;
    window.lovablePuter = window.lovablePuter || {
      signIn: async () => puter.signIn && puter.signIn(),
      signOut: async () => puter.signOut && puter.signOut(),
      runDiagnostics: async () => puter.runDiagnostics && puter.runDiagnostics(),
      getUser: async () => puter.getUser && puter.getUser()
    };
    console.info('puter_integration.js: PuterIntegration ready');
  } catch (e) {
    console.warn('puter_integration.js: failed to initialize PuterIntegration', e);
    // create safe shims so legacy code doesn't break
    window.PuterIntegration = window.PuterIntegration || {
      signIn: async () => { throw new Error('PuterIntegration not available'); },
      signOut: async () => {},
      runDiagnostics: async () => ({ ok: false, reason: 'not-initialized' }),
      getUser: async () => null
    };
    window.lovablePuter = window.lovablePuter || window.PuterIntegration;
  }
})();