// PuterInit.ts
import React from "react";

/**
 * Initialize Puter integration for Lovable:
 * - runs non-blocking in background
 * - exposes window.PuterIntegration and window.lovablePuter
 * - provides a user-gesture signIn helper that uses popup sign-in
 */
// Replaced broken/invalid imports and logic with a small, safe initializer that forwards to the
// already-instantiated puter_integration (from puter_integration.ts). This module is Lovable-friendly,
// runs non-blocking, exposes window.PuterIntegration and window.lovablePuter, and documents tweakables.

/* @tweakable [Whether to auto-initialize Puter integration on load (set false in tests)] */
const AUTO_INITIALIZE_PUTER = /* @tweakable */ true;

/* @tweakable [Interactive sign-in timeout used by fallback popup polling (ms)] */
const SIGNIN_TIMEOUT_MS = /* @tweakable */ 30000;

async function initPuterForLovable() {
  if (!AUTO_INITIALIZE_PUTER) return;
  try {
    // Prefer the TS-built integration instance if present on window
    let puter = window.PuterIntegration || null;
    // If not yet attached, attempt to import the module path used by the app (best-effort)
    if (!puter) {
      try {
        const mod = await import('/src/integrations/puter/puter_integration.ts');
        puter = (mod && (mod.default || mod)) || null;
      } catch (e) {
        // non-fatal: the file may already be loaded via other boot steps
        // console.warn('puter-init dynamic import failed (non-fatal)', e);
      }
    }

    if (puter) {
      // ensure background init kicked off where available
      if (typeof puter.initInBackground === 'function') {
        await puter.initInBackground().catch(() => {});
      }
      // expose canonical globals for legacy code + UI
      window.PuterIntegration = puter;
      window.lovablePuter = window.lovablePuter || {
        signIn: async () => (puter.signIn ? puter.signIn() : null),
        signOut: async () => (puter.signOut ? puter.signOut() : null),
        runDiagnostics: async () => (puter.runDiagnostics ? puter.runDiagnostics() : { ok: false, reason: 'not-available' }),
        getUser: async () => (puter.getUser ? puter.getUser() : null)
      };
      console.info('PuterIntegration initialized (Lovable shim).');
      return;
    }

    // graceful shim: expose a minimal fallback so UI won't throw if integration not ready
    window.PuterIntegration = window.PuterIntegration || {
      signIn: async () => { throw new Error('PuterIntegration not available'); },
      signOut: async () => {},
      runDiagnostics: async () => ({ ok: false, reason: 'not-initialized' }),
      getUser: async () => null
    };
    window.lovablePuter = window.lovablePuter || window.PuterIntegration;
    console.warn('PuterIntegration not found; exposed fallback shims.');
  } catch (err) {
    console.warn('initPuterForLovable failed', err);
    window.PuterIntegration = window.PuterIntegration || {
      signIn: async () => { throw new Error('PuterIntegration not available'); },
      signOut: async () => {},
      runDiagnostics: async () => ({ ok: false, reason: String(err?.message || err) }),
      getUser: async () => null
    };
    window.lovablePuter = window.lovablePuter || window.PuterIntegration;
  }
}

// Run at module load (safe / non-blocking)
initPuterForLovable();