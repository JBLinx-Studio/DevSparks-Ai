/* New file: src/integrations/puter/puter_integration.ts
   Lovable-ready Puter integration (frontend-only)
   - Uses https://js.puter.com/v2/ when available
   - Popup sign-in (requires user gesture), persistent session in localStorage
   - Auto-creates user folder in Puter FS
   - Exposes runDiagnostics(), signIn(), signOut(), getUser(), ensureUserFolder()
   - Emits window events: 'puter:signin' and 'puter:signout'
   - @tweakable annotations provided for key values
*/

type PuterUser = { id?: string; username?: string; email?: string; [k: string]: any } | null;

/* @tweakable [Seconds to wait for Puter SDK to attach to window before using a safe shim] */
const SDK_WAIT_MS = 5000;
/* @tweakable [Base folder name inside Puter FS where projects/data are stored] */
const USER_FOLDER_BASE = 'devsparks';
/* @tweakable [Interactive sign-in popup timeout in ms (requires user gesture)] */
const SIGNIN_TIMEOUT_MS = 30000;
/* @tweakable [Whether to auto-create user folder on successful sign-in] */
const AUTO_CREATE_USER_FOLDER = true;

class PuterIntegration {
  user: PuterUser = null;
  initialized = false;

  constructor() {
    // start background init (non-blocking)
    this.initInBackground().catch((e) => console.warn('PuterIntegration init error', e));
  }

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  // wait for Puter SDK script to attach to window
  private async waitForSDK(timeout = SDK_WAIT_MS) {
    const start = Date.now();
    while ((window as any).Puter === undefined && Date.now() - start < timeout) {
      await this.sleep(150);
    }
    return !!(window as any).Puter;
  }

  // background initialization: prefer real SDK, otherwise create safe shim so app won't crash
  async initInBackground() {
    if (this.initialized) return;
    const present = await this.waitForSDK();
    if (!present) {
      // create minimal shim so other code won't throw (no network behavior)
      (window as any).Puter = (window as any).Puter || { auth: {}, fs: {}, kv: {}, ai: {}, host: {} };
      this.initialized = true;
      return;
    }

    // if SDK present, call init() if provided
    try {
      if (typeof (window as any).Puter.init === 'function') {
        await (window as any).Puter.init();
      }
    } catch (e) {
      console.warn('Puter.init() failed (non-fatal)', e);
    }

    // hydrate cached user
    try {
      this.user = (window as any).Puter?.auth?.currentUser ?? JSON.parse(localStorage.getItem('puter_user') || 'null');
      if (this.user) {
        localStorage.setItem('puter_user', JSON.stringify(this.user));
        // mirror into SDK
        try { (window as any).Puter.auth = (window as any).Puter.auth || {}; (window as any).Puter.auth.currentUser = this.user; } catch {}
      }
    } catch (e) {
      console.warn('hydrate puter user failed', e);
    }

    // listen for SDK auth events where available
    try {
      if ((window as any).Puter?.auth?.onAuthStateChanged) {
        (window as any).Puter.auth.onAuthStateChanged((u: any) => {
          this.user = u || null;
          if (u) localStorage.setItem('puter_user', JSON.stringify(u)); else localStorage.removeItem('puter_user');
          window.dispatchEvent(new CustomEvent('puter:signin', { detail: u }));
          if (!u) window.dispatchEvent(new CustomEvent('puter:signout'));
        });
      }
    } catch (e) {
      // ignore
    }

    // auto ensure user folder if user present
    if (AUTO_CREATE_USER_FOLDER && this.user) {
      try { await this.ensureUserFolder(); } catch (e) { /* non-fatal */ }
    }

    this.initialized = true;
  }

  // Public: interactive sign-in (must be called from user gesture)
  async signIn(): Promise<PuterUser> {
    await this.initInBackground();
    // prefer SDK signIn
    const sdk = (window as any).Puter;
    try {
      if (sdk?.auth && typeof sdk.auth.signIn === 'function') {
        const u = await sdk.auth.signIn();
        this.setUser(u);
        if (AUTO_CREATE_USER_FOLDER) await this.ensureUserFolder();
        return u;
      }
    } catch (e) {
      console.warn('Puter.auth.signIn failed, falling back to popup:', e);
    }

    // fallback: open known Puter sign-in URL and poll for identity
    const authUrl = 'https://js.puter.com/v2/signin'; // conservative; actual providers may vary
    const popup = window.open(authUrl, 'PuterSignIn', 'width=900,height=720');
    if (!popup) throw new Error('Popup blocked — allow popups for this site and retry (user gesture required)');

    const start = Date.now();
    while (Date.now() - start < SIGNIN_TIMEOUT_MS) {
      try {
        // try common whoami endpoints
        if (sdk?.identity && typeof sdk.identity.whoami === 'function') {
          const who = await sdk.identity.whoami().catch(() => null);
          if (who) { popup.close(); this.setUser(who); if (AUTO_CREATE_USER_FOLDER) await this.ensureUserFolder(); return who; }
        }
        if (sdk?.auth?.currentUser) {
          const cur = sdk.auth.currentUser;
          if (cur) { popup.close(); this.setUser(cur); if (AUTO_CREATE_USER_FOLDER) await this.ensureUserFolder(); return cur; }
        }
      } catch (err) {
        // ignore cross-origin or transient errors
      }
      if (popup.closed) break;
      await this.sleep(800);
    }

    try { popup.close(); } catch {}
    throw new Error('Interactive sign-in timed out or was cancelled');
  }

  // Public: sign out
  async signOut() {
    const sdk = (window as any).Puter;
    try {
      if (sdk?.auth && typeof sdk.auth.signOut === 'function') await sdk.auth.signOut();
    } catch (e) { console.warn('Puter signOut error', e); }
    this.user = null;
    localStorage.removeItem('puter_user');
    try { if (sdk?.auth) sdk.auth.currentUser = null; } catch {}
    window.dispatchEvent(new CustomEvent('puter:signout'));
  }

  // get in-memory user or ask SDK
  async getUser(): Promise<PuterUser> {
    await this.initInBackground();
    const sdk = (window as any).Puter;
    this.user = this.user ?? (sdk?.auth?.currentUser ?? null);
    return this.user;
  }

  setUser(u: PuterUser) {
    this.user = u;
    try { if (u) localStorage.setItem('puter_user', JSON.stringify(u)); else localStorage.removeItem('puter_user'); } catch {}
    try { (window as any).Puter.auth = (window as any).Puter.auth || {}; (window as any).Puter.auth.currentUser = u; } catch {}
    window.dispatchEvent(new CustomEvent('puter:signin', { detail: u }));
    /* @tweakable [Persist session to sessionStorage as well to survive some third-party cookie restrictions] */
    try { if (u) sessionStorage.setItem('puter_user_session', JSON.stringify(u)); } catch {}
  }

  // ensure user folder exists in Puter FS (best-effort)
  async ensureUserFolder(): Promise<string | null> {
    await this.initInBackground();
    if (!this.user) return null;
    const id = (this.user.id || this.user.username || 'user').toString();
    const folder = `${USER_FOLDER_BASE}/${id}`;
    const sdk = (window as any).Puter;
    try {
      if (sdk?.fs) {
        // prefer stat -> mkdir
        if (typeof sdk.fs.stat === 'function') {
          await sdk.fs.stat(folder).catch(async () => { if (typeof sdk.fs.mkdir === 'function') await sdk.fs.mkdir(folder); });
        } else if (typeof sdk.fs.mkdir === 'function') {
          await sdk.fs.mkdir(folder);
        }
        // expose for app use
        (window as any).puterUserFolder = folder;
        return folder;
      }
    } catch (e) {
      console.warn('ensureUserFolder error', e);
    }
    return null;
  }

  // run diagnostics for Auth, FS, KV, AI, Hosting and return structured result
  async runDiagnostics(): Promise<Record<string, any>> {
    await this.initInBackground();
    const out: Record<string, any> = { ok: false, auth: null, user: null, fs: null, kv: null, ai: null, host: null, details: {} };
    const sdk = (window as any).Puter;

    try {
      // Auth
      try {
        const user = sdk?.auth?.currentUser ?? this.user ?? null;
        out.auth = !!user;
        out.user = user;
      } catch (e) { out.details.authError = String(e); out.auth = false; }

      // FS
      try {
        if (sdk?.fs) {
          if (typeof sdk.fs.listFiles === 'function') {
            const list = await sdk.fs.listFiles('/').catch(() => null);
            out.fs = Array.isArray(list) ? { ok: true, count: list.length } : { ok: false, note: 'no response' };
          } else {
            out.fs = { ok: true, note: 'fs API present (no listFiles)' };
          }
        } else out.fs = { ok: false, note: 'fs missing' };
      } catch (e) { out.fs = { ok: false, error: String(e) }; }

      // KV
      try {
        if (sdk?.kv && typeof sdk.kv.put === 'function') {
          const probe = `_visionstack_probe_${Date.now()}`;
          await sdk.kv.put(probe, 'ok').catch(() => {});
          const v = await sdk.kv.get(probe).catch(() => null);
          try { if (typeof sdk.kv.del === 'function') await sdk.kv.del(probe).catch(() => {}); } catch {}
          out.kv = { ok: v === 'ok', value: v };
        } else out.kv = { ok: false, note: 'kv missing' };
      } catch (e) { out.kv = { ok: false, error: String(e) }; }

      // AI
      try {
        if (sdk?.ai && typeof sdk.ai.chat === 'function') {
          const resp = await sdk.ai.chat({ model: 'gpt-5-nano', messages: [{ role: 'user', content: 'Ping' }], stream: false }).catch(() => null);
          out.ai = { ok: !!resp, raw: resp ? (typeof resp === 'string' ? resp.slice(0, 200) : resp) : null };
        } else out.ai = { ok: false, note: 'ai missing' };
      } catch (e) { out.ai = { ok: false, error: String(e) }; }

      // Hosting
      try {
        out.host = { ok: !!(sdk?.host && (typeof sdk.host.createSite === 'function' || typeof sdk.host.create === 'function')) };
      } catch (e) { out.host = { ok: false, error: String(e) }; }

      out.ok = out.auth && out.fs?.ok && out.kv?.ok && (out.ai?.ok || out.ai?.note === 'ai missing'); // flexible
    } catch (err) {
      out.details.globalError = String(err);
    }
    return out;
  }
}

// instantiate and expose
const puterIntegration = new PuterIntegration();
(window as any).PuterIntegration = puterIntegration;

// Expose a simple global helper for UI and Lovable integration
;(window as any).lovablePuter = {
  getUser: () => puterIntegration.getUser(),
  signIn: () => puterIntegration.signIn(),
  signOut: () => puterIntegration.signOut(),
  runDiagnostics: () => puterIntegration.runDiagnostics()
};

export default puterIntegration;