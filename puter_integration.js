// Minimal Puter integration shim for root page (no TS imports)
// Exposes window.PuterIntegration and window.lovablePuter using the Puter SDK if present.

(async () => {
  try {
    const sdk = window.Puter || {};
    const api = {
      async signIn() {
        if (sdk?.auth?.signIn) {
          const u = await sdk.auth.signIn();
          try { if (sdk?.auth) sdk.auth.currentUser = u; } catch {}
          return u;
        }
        throw new Error('Puter SDK auth.signIn not available');
      },
      async signOut() {
        if (sdk?.auth?.signOut) return sdk.auth.signOut();
      },
      async getUser() {
        return sdk?.auth?.currentUser ?? null;
      },
      async runDiagnostics() {
        const out = { ok: false, auth: null, fs: null, kv: null, ai: null };
        try { out.auth = !!(sdk?.auth?.currentUser); } catch {}
        try { out.fs = !!sdk?.fs; } catch {}
        try { out.kv = !!sdk?.kv; } catch {}
        try { out.ai = !!sdk?.ai; } catch {}
        out.ok = !!out.auth; // relaxed
        return out;
      }
    };
    window.PuterIntegration = window.PuterIntegration || api;
    window.lovablePuter = window.lovablePuter || api;
    console.info('Root Puter shim ready');
  } catch (e) {
    console.warn('Root Puter shim failed', e);
  }
})();