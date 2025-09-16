// Use global PuterShim (puter_integration.js exposes window.PuterShim). Avoid ESM import.
const PuterAPI = {
  async ensureInit() {
    await (window.PuterShim?.init?.() || Promise.resolve());
    if (!window.Puter && window.puter) window.Puter = window.puter;
    return window.Puter || window.puter;
  },

  fs: {
    async writeFile(path, content, opts = {}) {
      await PuterAPI.ensureInit();
      if (!window.Puter?.fs?.writeFile) throw new Error('Puter.fs.writeFile not available');
      return window.Puter.fs.writeFile(path, content, opts);
    },
    async readFile(path, opts = {}) {
      await PuterAPI.ensureInit();
      if (!window.Puter?.fs?.readFile) throw new Error('Puter.fs.readFile not available');
      return window.Puter.fs.readFile(path, opts);
    },
    async writeJson(path, obj) {
      await PuterAPI.ensureInit();
      if (window.Puter?.fs?.writeJson) return window.Puter.fs.writeJson(path, obj);
      return PuterAPI.fs.writeFile(path, JSON.stringify(obj, null, 2), { encoding: 'utf-8' });
    },
    async readJson(path) {
      await PuterAPI.ensureInit();
      if (window.Puter?.fs?.readJson) return window.Puter.fs.readJson(path);
      const txt = await PuterAPI.fs.readFile(path, { encoding: 'utf-8' });
      return JSON.parse(txt);
    },
    async listFiles(path = '/') {
      await PuterAPI.ensureInit();
      if (window.Puter?.fs?.listFiles) return window.Puter.fs.listFiles(path);
      return [];
    },
    async deleteFile(path) {
      await PuterAPI.ensureInit();
      if (window.Puter?.fs?.deleteFile) return window.Puter.fs.deleteFile(path);
      throw new Error('Puter.fs.deleteFile not available');
    },
    async rename(oldPath, newPath) {
      await PuterAPI.ensureInit();
      const content = await PuterAPI.fs.readFile(oldPath, { encoding: 'utf-8' }).catch(() => null);
      if (content == null) throw new Error('Source file not found for rename');
      await PuterAPI.fs.writeFile(newPath, content);
      await PuterAPI.fs.deleteFile(oldPath);
      return true;
    },
    async mkdir(path) {
      await PuterAPI.ensureInit();
      if (window.Puter?.fs?.mkdir) return window.Puter.fs.mkdir(path);
      return true;
    },
    async getUsage() {
      await PuterAPI.ensureInit();
      if (window.Puter?.fs?.getUsage) return window.Puter.fs.getUsage();
      return null;
    }
  },

  kv: {
    async put(key, value) {
      await PuterAPI.ensureInit();
      if (!window.Puter?.kv?.put) throw new Error('Puter.kv.put not available');
      return window.Puter.kv.put(key, value);
    },
    async get(key) {
      await PuterAPI.ensureInit();
      if (!window.Puter?.kv?.get) return null;
      return window.Puter.kv.get(key);
    },
    async del(key) {
      await PuterAPI.ensureInit();
      if (!window.Puter?.kv?.del) throw new Error('Puter.kv.del not available');
      return window.Puter.kv.del(key);
    },
    async incr(key, by = 1) {
      await PuterAPI.ensureInit();
      if (window.Puter?.kv?.incr) return window.Puter.kv.incr(key, by);
      const cur = Number((await PuterAPI.kv.get(key)) || 0) + by;
      await PuterAPI.kv.put(key, String(cur));
      return cur;
    },
    async decr(key, by = 1) {
      return PuterAPI.kv.incr(key, -by);
    }
  },

  ai: {
    async chat(opts = {}) {
      await PuterAPI.ensureInit();
      if (!window.Puter?.ai?.chat) throw new Error('Puter.ai.chat not available');
      return window.Puter.ai.chat(opts);
    },
    async txt2img(opts = {}) {
      await PuterAPI.ensureInit();
      if (!window.Puter?.ai?.txt2img) throw new Error('Puter.ai.txt2img not available');
      return window.Puter.ai.txt2img(opts);
    },
    async img2txt(opts = {}) {
      await PuterAPI.ensureInit();
      if (!window.Puter?.ai?.img2txt) throw new Error('Puter.ai.img2txt not available');
      return window.Puter.ai.img2txt(opts);
    },
    async txt2speech(opts = {}) {
      await PuterAPI.ensureInit();
      if (!window.Puter?.ai?.txt2speech) throw new Error('Puter.ai.txt2speech not available');
      return window.Puter.ai.txt2speech(opts);
    }
  },

  host: {
    async createSite(opts = {}) {
      await PuterAPI.ensureInit();
      if (window.Puter?.host && typeof window.Puter.host.createSite === 'function') {
        return window.Puter.host.createSite(opts);
      }
      if (window.Puter?.host && typeof window.Puter.host.create === 'function') {
        return window.Puter.host.create(opts.folder || opts);
      }
      throw new Error('Puter.host.createSite not available');
    },
    async deleteSite(opts = {}) {
      await PuterAPI.ensureInit();
      if (window.Puter?.host && typeof window.Puter.host.deleteSite === 'function') {
        return window.Puter.host.deleteSite(opts);
      }
      throw new Error('Puter.host.deleteSite not available');
    }
  }
};

window.PuterAPI = PuterAPI;
export default PuterAPI;