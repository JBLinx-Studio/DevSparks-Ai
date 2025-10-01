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
      if (window.Puter && window.Puter.ai && typeof window.Puter.ai.chat === 'function') {
        return window.Puter.ai.chat(opts);
      }
      throw new Error('Puter.ai.chat not available in this environment');
    },
    async txt2img(opts = {}) {
      await PuterService.ready();
      if (window.Puter && window.Puter.ai && typeof window.Puter.ai.txt2img === 'function') {
        return window.Puter.ai.txt2img(opts);
      }
      throw new Error('Puter.ai.txt2img not available');
    },
    async img2txt(opts = {}) {
      await PuterService.ready();
      if (window.Puter && window.Puter.ai && typeof window.Puter.ai.img2txt === 'function') {
        return window.Puter.ai.img2txt(opts);
      }
      throw new Error('Puter.ai.img2txt not available');
    },
    async txt2speech(opts = {}) {
      await PuterService.ready();
      if (window.Puter && window.Puter.ai && typeof window.Puter.ai.txt2speech === 'function') {
        return window.Puter.ai.txt2speech(opts);
      }
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

window.PuterService = PuterService;
export default PuterService;