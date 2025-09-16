// New file: puter-init.js
// Lightweight Puter initializer: checks sign-in on load, shows a clickable sign-in banner if needed,
// initializes a user folder, writes a last-login KV entry, and exposes testing/migration helpers.

(async function puterInit() {
  // normalize Puter global (SDK may expose lowercase `puter`)
  if (!window.Puter && window.puter) window.Puter = window.puter;
  const PUTER = window.Puter || window.PuterService || window.PuterShim || null;
  // disable legacy red status banner; use white popup instead
  let statusEl = null;
  function setStatus(text, ok = false) { /* no-op */ }

  // safe API access helpers (best-effort)
  const api = {
    async isSignedIn() {
      try {
        if (window.Puter && window.Puter.auth && typeof window.Puter.auth.isSignedIn === 'function') return window.Puter.auth.isSignedIn();
        if (window.PuterService && window.PuterService.auth) return !!(await window.PuterService.auth.currentUser());
        if (window.Puter && window.Puter.auth && window.Puter.auth.currentUser) return !!window.Puter.auth.currentUser;
      } catch (e) { /* ignore */ }
      return false;
    },
    async getUser() {
      try {
        if (window.Puter && window.Puter.auth && typeof window.Puter.auth.getUser === 'function') return window.Puter.auth.getUser();
        if (window.Puter && window.Puter.identity && typeof window.Puter.identity.whoami === 'function') return window.Puter.identity.whoami();
        if (window.PuterService && window.PuterService.auth) return window.PuterService.auth.currentUser();
        return window.Puter?.auth?.currentUser || null;
      } catch (e) { return null; }
    },
    async signIn() {
      if (window.Puter && window.Puter.auth && typeof window.Puter.auth.signIn === 'function') return window.Puter.auth.signIn();
      if (window.PuterService && window.PuterService.auth && typeof window.PuterService.auth.signIn === 'function') return window.PuterService.auth.signIn();
      // fallback: open Puter sign-in URL in popup (best-effort)
      const url = 'https://puter.com/action/sign-in?embedded_in_popup=true';
      const w = window.open(url, 'PuterSignIn', 'width=900,height=720');
      // wait briefly for whoami to become available (non-blocking, best-effort)
      const start = Date.now();
      while (Date.now() - start < SIGNIN_TIMEOUT_MS) {
        const u = await api.getUser();
        if (u) { try { w?.close(); } catch {} return u; }
        await new Promise(r => setTimeout(r, 800));
      }
      throw new Error('Interactive sign-in timed out or was blocked.');
    },
    async fsMkdir(path) {
      try {
        if (window.Puter && window.Puter.fs && typeof window.Puter.fs.mkdir === 'function') return window.Puter.fs.mkdir(path);
        if (window.PuterService && window.PuterService.fs && typeof window.PuterService.fs.mkdir === 'function') return window.PuterService.fs.mkdir(path);
        return true;
      } catch (e) { console.warn('fs.mkdir failed', e); return false; }
    },
    async fsWrite(path, content) {
      try {
        if (window.Puter && window.Puter.fs && typeof window.Puter.fs.writeFile === 'function') return window.Puter.fs.writeFile(path, content);
        if (window.PuterService && window.PuterService.fs && typeof window.PuterService.fs.writeFile === 'function') return window.PuterService.fs.writeFile(path, content);
        // best-effort fallback to PuterAPI shim names
        if (window.Puter && window.Puter.fs && typeof window.Puter.fs.write === 'function') return window.Puter.fs.write(path, content);
      } catch (e) { console.warn('fs.write fallback failed', e); }
      throw new Error('No Puter.fs.write available');
    },
    async kvPut(k, v) {
      try {
        if (window.Puter && window.Puter.kv && typeof window.Puter.kv.put === 'function') return window.Puter.kv.put(k, v);
        if (window.PuterService && window.PuterService.kv && typeof window.PuterService.kv.put === 'function') return window.PuterService.kv.put(k, v);
        if (window.Puter && window.Puter.kv && typeof window.Puter.kv.set === 'function') return window.Puter.kv.set(k, v);
      } catch (e) { console.warn('kv put failed', e); }
      try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch { return false; }
    },
    async kvGet(k) {
      try {
        if (window.Puter && window.Puter.kv && typeof window.Puter.kv.get === 'function') return window.Puter.kv.get(k);
        if (window.PuterService && window.PuterService.kv && typeof window.PuterService.kv.get === 'function') return window.PuterService.kv.get(k);
        if (window.Puter && window.Puter.kv && typeof window.Puter.kv.getItem === 'function') return window.Puter.kv.getItem(k);
      } catch (e) { console.warn('kv get failed', e); }
      const v = localStorage.getItem(k); try { return JSON.parse(v); } catch { return v; }
    },
    async aiChat(opts) {
      try {
        if (window.Puter && window.Puter.ai && typeof window.Puter.ai.chat === 'function') return window.Puter.ai.chat(opts);
        if (window.PuterService && window.PuterService.ai && typeof window.PuterService.ai.chat === 'function') return window.PuterService.ai.chat(opts);
        if (window.websim && websim.chat && websim.chat.completions && typeof websim.chat.completions.create === 'function') return websim.chat.completions.create(opts);
      } catch (e) { console.warn('ai chat failed', e); }
      throw new Error('No AI chat provider available');
    }
  };

  // tweakable variables
  /* @tweakable [base folder for user data in Puter FS] */
  const USER_FOLDER_BASE = 'devsparks'; /* @tweakable user folder base (change if you namespace differently) */
  /* @tweakable [interactive sign-in timeout in ms] */
  const SIGNIN_TIMEOUT_MS = 30000;

  async function afterSignInInit(user) {
    try {
      const id = user?.id || user?.sub || user?.username || user?.name || 'user';
      const folder = `${USER_FOLDER_BASE}/${id}`;
      await api.fsMkdir(folder).catch(() => {});
      await api.kvPut('devsparks_lastLogin', new Date().toISOString()).catch(() => {});
      setStatus(`Puter: Connected (${user?.name || user?.username || id})`, true);
      // Expose helpers
      window.puterUserFolder = folder;
      // update projects sidebar badge now that sign-in completed
      try { await window.checkAndSetProjectBadge?.(); } catch(e){/* non-fatal */ }
      window.puterTestAI = async (prompt = 'Hello from VisionStack test') => {
        // call Puter AI if available; use small wrapper
        try {
          // try structured call for Puter.ai.chat
          const result = await api.aiChat({ messages: [{ role: 'user', content: prompt }], json: false });
          return result;
        } catch (e) {
          console.error('puterTestAI error', e);
          throw e;
        }
      };
      window.migrateLocalToPuter = async (opts = {}) => {
        // naive migration: copy keys from localStorage that look like project files
        const prefix = opts.prefix || 'project_file:'; // default heuristic
        const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
        for (const k of keys) {
          const filename = k.slice(prefix.length);
          const content = localStorage.getItem(k);
          try {
            await api.fsWrite(`${folder}/${filename}`, content);
            console.log('migrated', filename);
          } catch (e) {
            console.warn('migrate write failed for', filename, e);
          }
        }
        return true;
      };
    } catch (e) {
      console.error('afterSignInInit error', e);
      setStatus('Puter: Connected — init failed (see console)', false);
    }
  }

  // main flow: check signed in; if yes initialize; otherwise show clickable banner to sign in
  try {
    const signed = await api.isSignedIn();
    if (signed) {
      const user = await api.getUser();
      if (user) {
        await afterSignInInit(user);
        return;
      }
    }
  } catch (e) {
    console.warn('isSignedIn check failed', e);
  }

  // not signed -> show white Puter sign-in popup if available (no red banner)
  try { if (window.puterSignIn && typeof window.puterSignIn.show === 'function') window.puterSignIn.show(); } catch (e) {}
  // Also dispatch a gentle hint event (no UI)
  try { window.dispatchEvent(new CustomEvent('puter:needs-signin')); } catch {}

  // Expose tiny KV helpers for preferred AI model with Puter-first fallback
  window.getPreferredModel = async function() {
    try {
      if (window.Puter && window.Puter.kv && typeof window.Puter.kv.get === 'function') {
        const v = await window.Puter.kv.get('preferredModel'); if (v) return v;
      }
      if (window.PuterService && window.PuterService.kv && typeof window.PuterService.kv.get === 'function') {
        const v = await window.PuterService.kv.get('preferredModel'); if (v) return v;
      }
    } catch (e) { console.warn('getPreferredModel kv.get failed', e); }
    return localStorage.getItem('preferredModel') || 'gpt-5-nano';
  };

  window.setPreferredModel = async function(model) {
    try {
      if (window.Puter && window.Puter.kv && typeof window.Puter.kv.put === 'function') {
        await window.Puter.kv.put('preferredModel', model);
      } else if (window.PuterService && window.PuterService.kv && typeof window.PuterService.kv.put === 'function') {
        await window.PuterService.kv.put('preferredModel', model);
      } else {
        localStorage.setItem('preferredModel', model);
      }
      return true;
    } catch (e) {
      console.error('setPreferredModel failed', e);
      try { localStorage.setItem('preferredModel', model); } catch {}
      return false;
    }
  };

  // Helper: check auth + user folder stat to set the Projects sidebar badge
  window.checkAndSetProjectBadge = async function() {
    try {
      const signed = await api.isSignedIn();
      const statusEl = document.getElementById('cloudStorageStatus');
      if (!statusEl) return;
      if (!signed) { statusEl.textContent = 'Cloud Storage: Local (Puter.AI not connected)'; statusEl.className = 'cloud-storage-status disconnected'; return; }
      const user = await api.getUser();
      const folder = `devsparks/${user?.id || user?.sub || user?.username || 'user'}`;
      // attempt stat, create if missing
      try { await api.fsMkdir(folder); await (window.Puter?.fs?.stat ? window.Puter.fs.stat(folder) : Promise.resolve()); } catch(e){ /* ignore */ }
      statusEl.textContent = `Cloud Storage: Connected (Puter.AI${user?.username ? ` - ${user.username}` : ''})`; statusEl.className = 'cloud-storage-status connected';
    } catch (e) {
      console.error('checkAndSetProjectBadge', e);
      const statusEl = document.getElementById('cloudStorageStatus');
      if (statusEl) { statusEl.textContent = 'Cloud Storage: Local (Puter.AI not connected)'; statusEl.className = 'cloud-storage-status disconnected'; }
    }
  };

  // expose a lightweight test method on window to allow external callers to trigger the same flow
  window.__puterInit = { statusEl, setStatus };
  // run initial badge check after puter-init completes (best-effort)
  try { window.checkAndSetProjectBadge?.(); } catch(e){/* ignore */}
})()