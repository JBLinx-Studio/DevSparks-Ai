// New file: puter_services.js
// Lightweight frontend-only Puter service wrapper that programs can call directly.
// Relies on PuterShim (puter_integration.js) + Puter global SDK when available.
// Exposes: PuterService.auth, PuterService.fs, PuterService.kv, PuterService.ai, PuterService.host, and a runDiagnostics() helper.

const PuterService = {
  async ready() {
    // ensure PuterShim init sequence ran
    if (window.PuterShim && typeof window.PuterShim.init === 'function') {
      await window.PuterShim.init();
    }
    return window.Puter || null;
  },

  auth: {
    async currentUser() {
      await PuterService.ready();
      return (window.Puter && window.Puter.auth && window.Puter.auth.currentUser) || window.PuterShim?.user || null;
    },
    async signIn() {
      await PuterService.ready();
      if (window.Puter && window.Puter.auth && typeof window.Puter.auth.signIn === 'function') {
        return window.Puter.auth.signIn();
      }
      // fallback to PuterShim interactive
      return window.PuterShim?.ensureSignedInInteractive?.();
    },
    async signOut() {
      await PuterService.ready();
      if (window.Puter && window.Puter.auth && typeof window.Puter.auth.signOut === 'function') {
        return window.Puter.auth.signOut();
      }
      // best-effort clear
      window.PuterShim.user = null;
      if (window.Puter && window.Puter.auth) window.Puter.auth.currentUser = null;
      return true;
    },
    onAuthStateChanged(cb) {
      try {
        if (window.Puter && window.Puter.auth && typeof window.Puter.auth.onAuthStateChanged === 'function') {
          window.Puter.auth.onAuthStateChanged(cb);
        } else {
          window.addEventListener('puter:signin', (ev) => cb(ev.detail));
        }
      } catch (e) {
        console.warn('onAuthStateChanged not supported', e);
      }
    }
  },

  fs: {
    async writeFile(path, content, opts = {}) {
      await PuterService.ready();
      if (window.Puter && window.Puter.fs && typeof window.Puter.fs.writeFile === 'function') {
        return window.Puter.fs.writeFile(path, content, opts);
      }
      // fallback: store to localStorage namespace
      const store = JSON.parse(localStorage.getItem('devspark_fs') || '{}');
      store[path] = content;
      localStorage.setItem('devspark_fs', JSON.stringify(store));
      return true;
    },
    async readFile(path, opts = {}) {
      await PuterService.ready();
      if (window.Puter && window.Puter.fs && typeof window.Puter.fs.readFile === 'function') {
        return window.Puter.fs.readFile(path, opts);
      }
      const store = JSON.parse(localStorage.getItem('devspark_fs') || '{}');
      return store[path] ?? null;
    },
    async listFiles(prefix = '/') {
      await PuterService.ready();
      if (window.Puter && window.Puter.fs && typeof window.Puter.fs.listFiles === 'function') {
        return window.Puter.fs.listFiles(prefix);
      }
      const store = JSON.parse(localStorage.getItem('devspark_fs') || '{}');
      return Object.keys(store).filter(k => k.startsWith(prefix.replace(/^\//, '')));
    },
    async deleteFile(path) {
      await PuterService.ready();
      if (window.Puter && window.Puter.fs && typeof window.Puter.fs.deleteFile === 'function') {
        return window.Puter.fs.deleteFile(path);
      }
      const store = JSON.parse(localStorage.getItem('devspark_fs') || '{}');
      delete store[path];
      localStorage.setItem('devspark_fs', JSON.stringify(store));
      return true;
    },
    async rename(oldPath, newPath) {
      await PuterService.ready();
      try {
        const content = await PuterService.fs.readFile(oldPath);
        if (content == null) throw new Error('source not found');
        await PuterService.fs.writeFile(newPath, content);
        await PuterService.fs.deleteFile(oldPath);
        return true;
      } catch (e) {
        throw e;
      }
    },
    async mkdir(path) {
      await PuterService.ready();
      if (window.Puter && window.Puter.fs && typeof window.Puter.fs.mkdir === 'function') {
        return window.Puter.fs.mkdir(path);
      }
      return true;
    },
    async getUsage() {
      await PuterService.ready();
      if (window.Puter && window.Puter.fs && typeof window.Puter.fs.getUsage === 'function') {
        return window.Puter.fs.getUsage();
      }
      return null;
    }
  },

  kv: {
    async put(key, value) {
      await PuterService.ready();
      if (window.Puter && window.Puter.kv && typeof window.Puter.kv.put === 'function') {
        return window.Puter.kv.put(key, value);
      }
      const store = JSON.parse(localStorage.getItem('devspark_kv') || '{}');
      store[key] = value;
      localStorage.setItem('devspark_kv', JSON.stringify(store));
      return true;
    },
    async get(key) {
      await PuterService.ready();
      if (window.Puter && window.Puter.kv && typeof window.Puter.kv.get === 'function') {
        return window.Puter.kv.get(key);
      }
      const store = JSON.parse(localStorage.getItem('devspark_kv') || '{}');
      return store[key] ?? null;
    },
    async del(key) {
      await PuterService.ready();
      if (window.Puter && window.Puter.kv && typeof window.Puter.kv.del === 'function') {
        return window.Puter.kv.del(key);
      }
      const store = JSON.parse(localStorage.getItem('devspark_kv') || '{}');
      delete store[key];
      localStorage.setItem('devspark_kv', JSON.stringify(store));
      return true;
    },
    async incr(key, by = 1) {
      await PuterService.ready();
      if (window.Puter && window.Puter.kv && typeof window.Puter.kv.incr === 'function') {
        return window.Puter.kv.incr(key, by);
      }
      const cur = Number((await PuterService.kv.get(key)) || 0) + by;
      await PuterService.kv.put(key, String(cur));
      return cur;
    },
    async decr(key, by = 1) {
      return PuterService.kv.incr(key, -by);
    }
  },

  ai: {
    async chat(opts = {}) {
      await PuterService.ready();
      // Preferred order:
      // 1) PuterAPI (explicit API wrapper)
      // 2) PuterService (local wrapper)
      // 3) Puter native SDK (window.Puter.ai)
      // 4) PuterShim.ai (fallback shim)
      // 5) websim (only when inside websim)
      if (window.PuterAPI?.ai?.chat) return window.PuterAPI.ai.chat(opts);
      if (window.PuterService?.ai?.chat && window.PuterService !== PuterService) {
        // If another PuterService was attached earlier use it, otherwise prefer our local PuterService implementation (this module).
        return window.PuterService.ai.chat(opts);
      }
      if (window.Puter && window.Puter.ai && typeof window.Puter.ai.chat === 'function') return window.Puter.ai.chat(opts);
      if (window.PuterShim && typeof window.PuterShim.ai?.chat === 'function') return window.PuterShim.ai.chat(opts);
      if (window.websim && websim.chat && websim.chat.completions && typeof websim.chat.completions.create === 'function') {
        return websim.chat.completions.create(opts);
      }
      throw new Error('No AI chat provider available');
    },
    async txt2img(opts = {}) {
      await PuterService.ready();
      if (window.PuterAPI?.ai?.txt2img) return window.PuterAPI.ai.txt2img(opts);
      if (window.PuterService?.ai?.txt2img && window.PuterService !== PuterService) return window.PuterService.ai.txt2img(opts);
      if (window.Puter && window.Puter.ai && typeof window.Puter.ai.txt2img === 'function') return window.Puter.ai.txt2img(opts);
      if (window.PuterShim && typeof window.PuterShim.ai?.txt2img === 'function') return window.PuterShim.ai.txt2img(opts);
      if (window.websim && websim.imageGen) return websim.imageGen(opts);
      throw new Error('No image generation provider available');
    },
    async img2txt(opts = {}) {
      await PuterService.ready();
      if (window.PuterAPI?.ai?.img2txt) return window.PuterAPI.ai.img2txt(opts);
      if (window.PuterService?.ai?.img2txt) return window.PuterService.ai.img2txt(opts);
      if (window.Puter && window.Puter.ai && typeof window.Puter.ai.img2txt === 'function') return window.Puter.ai.img2txt(opts);
      if (window.PuterShim && typeof window.PuterShim.ai?.img2txt === 'function') return window.PuterShim.ai.img2txt(opts);
      throw new Error('Puter.ai.img2txt not available');
    },
    async txt2speech(opts = {}) {
      await PuterService.ready();
      if (window.PuterAPI?.ai?.txt2speech) return window.PuterAPI.ai.txt2speech(opts);
      if (window.PuterService?.ai?.txt2speech) return window.PuterService.ai.txt2speech(opts);
      if (window.Puter && window.Puter.ai && typeof window.Puter.ai.txt2speech === 'function') return window.Puter.ai.txt2speech(opts);
      if (window.PuterShim && typeof window.PuterShim.ai?.txt2speech === 'function') return window.PuterShim.ai.txt2speech(opts);
      if (window.websim && websim.textToSpeech) return websim.textToSpeech(opts);
      throw new Error('Puter.ai.txt2speech not available');
    }
  },

  host: {
    async createSite(opts = {}) {
      await PuterService.ready();
      if (window.Puter && window.Puter.host) {
        if (typeof window.Puter.host.createSite === 'function') return window.Puter.host.createSite(opts);
        if (typeof window.Puter.host.create === 'function') return window.Puter.host.create(opts);
      }
      throw new Error('Puter.host.createSite not available');
    },
    async deleteSite(opts = {}) {
      await PuterService.ready();
      if (window.Puter && window.Puter.host && typeof window.Puter.host.deleteSite === 'function') {
        return window.Puter.host.deleteSite(opts);
      }
      throw new Error('Puter.host.deleteSite not available');
    }
  },

  // quick diagnostics used by UI test button
  async runDiagnostics() {
    const out = { ok: false, auth: null, fs: null, kv: null, ai: null, host: null, user: null, details: {} };
    try {
      await PuterService.ready();
      out.user = await PuterService.auth.currentUser();
      out.auth = !!out.user;
      try {
        const list = await PuterService.fs.listFiles('/');
        out.fs = Array.isArray(list) ? `OK (${list.length} entries)` : 'no response';
      } catch (e) {
        out.fs = `error: ${e.message || e}`;
      }
      try {
        const key = `_devspark_test_${Date.now()}`;
        await PuterService.kv.put(key, 'ok');
        const v = await PuterService.kv.get(key);
        await PuterService.kv.del(key);
        out.kv = v === 'ok' ? 'OK' : `unexpected:${String(v)}`;
      } catch (e) {
        out.kv = `error: ${e.message || e}`;
      }
      try {
        if (window.Puter && window.Puter.ai && typeof window.Puter.ai.chat === 'function') {
          const resp = await PuterService.ai.chat({ model: 'gpt-5-nano', messages: [{ role: 'user', content: 'Ping' }], timeout: 8000 }).catch(() => null);
          out.ai = resp ? 'Ready' : 'No response';
        } else {
          out.ai = 'not available';
        }
      } catch (e) { out.ai = `error: ${e.message || e}`; }
      try {
        out.host = window.Puter && window.Puter.host ? 'available' : 'not available';
      } catch (e) { out.host = `error: ${e.message || e}`; }
      out.ok = true;
    } catch (err) {
      out.details.initError = String(err?.message || err);
    }
    return out;
  }
};

// Expose an Internal Scripts manifest so the Internal Scripts panel can quickly index,
// surface metadata, and let AIs reason about what each script does.
//
// Each internal script can call window.InternalScripts.register({ id, title, description, tags, version, path })
// to register itself. The UI can then call window.InternalScripts.getManifest() to show a compact, searchable list.
//
// @tweakable [maxManifestEntries — how many scripts to keep in the in-memory manifest for quick inspection]
/* @tweakable [maxManifestEntries] */
window.InternalScripts = (function () {
  const MAX = Number(window.__INTERNAL_SCRIPTS_MAX__ || 120) || 120;
  const store = new Map();

  function register(meta = {}) {
    try {
      if (!meta || !meta.id) throw new Error('InternalScripts.register requires an id');
      meta.registeredAt = new Date().toISOString();
      meta.sourcePreview = meta.sourcePreview || null; // optional short snippet
      store.set(meta.id, { ...meta });
      // prune if needed
      if (store.size > MAX) {
        const keys = Array.from(store.keys()).slice(0, store.size - MAX);
        keys.forEach(k => store.delete(k));
      }
      // broadcast so UI panels (and AI agents) can update live
      window.dispatchEvent(new CustomEvent('internal-scripts:updated', { detail: { id: meta.id, meta } }));
      return true;
    } catch (e) {
      console.warn('InternalScripts.register failed', e);
      return false;
    }
  }

  function getManifest() {
    return Array.from(store.values()).sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  }

  function get(id) {
    return store.get(id) || null;
  }

  function clear() {
    store.clear();
    window.dispatchEvent(new CustomEvent('internal-scripts:cleared'));
  }

  // Helper: create a lightweight manifest entry from a loaded script element
  async function ingestScriptElement(scriptEl) {
    try {
      const id = scriptEl.id || scriptEl.getAttribute('data-script-id') || `script:${Math.random().toString(36).slice(2,8)}`;
      const path = scriptEl.src || scriptEl.getAttribute('data-path') || null;
      let preview = null;
      if (!path && scriptEl.textContent) preview = scriptEl.textContent.trim().slice(0, 800);
      register({ id, title: scriptEl.getAttribute('data-title') || id, description: scriptEl.getAttribute('data-desc') || '', path, sourcePreview: preview, tags: ['auto-ingested'] });
      return id;
    } catch (e) { return null; }
  }

  // Auto-ingest <script data-internal-script> nodes so Internal Scripts panel is populated automatically
  try {
    const nodes = Array.from(document.querySelectorAll('script[data-internal-script]'));
    nodes.forEach(n => ingestScriptElement(n));
  } catch (e) {}

  return { register, getManifest, get, clear, ingestScriptElement };
}());

window.PuterService = PuterService;
export default PuterService;