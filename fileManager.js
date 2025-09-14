/* @tweakable [Controls whether file operations log verbose debug info to the console] */
const FILE_MANAGER_VERBOSE = true;

/* Minimal FileManager used by index.html/app.js to avoid missing-module errors.
   Provides basic APIs expected by the rest of the app (load/save/list).
   This is intentionally small — it's a local in-browser stub that operates on
   localStorage and delegates cloud features to Puter.AI when available. */

export const FileManager = {
  async read(path) {
    if (FILE_MANAGER_VERBOSE) console.debug('[FileManager] read', path);
    try {
      const projKey = 'devspark_fs';
      const store = JSON.parse(localStorage.getItem(projKey) || '{}');
      return store[path] ?? null;
    } catch (e) {
      console.error('[FileManager] read error', e);
      return null;
    }
  },

  async write(path, content) {
    if (FILE_MANAGER_VERBOSE) console.debug('[FileManager] write', path);
    try {
      const projKey = 'devspark_fs';
      const store = JSON.parse(localStorage.getItem(projKey) || '{}');
      store[path] = content;
      localStorage.setItem(projKey, JSON.stringify(store));
      return true;
    } catch (e) {
      console.error('[FileManager] write error', e);
      return false;
    }
  },

  async list(prefix = '') {
    if (FILE_MANAGER_VERBOSE) console.debug('[FileManager] list', prefix);
    try {
      const projKey = 'devspark_fs';
      const store = JSON.parse(localStorage.getItem(projKey) || '{}');
      return Object.keys(store).filter(k => k.startsWith(prefix));
    } catch (e) {
      console.error('[FileManager] list error', e);
      return [];
    }
  },

  async remove(path) {
    if (FILE_MANAGER_VERBOSE) console.debug('[FileManager] remove', path);
    try {
      const projKey = 'devspark_fs';
      const store = JSON.parse(localStorage.getItem(projKey) || '{}');
      delete store[path];
      localStorage.setItem(projKey, JSON.stringify(store));
      return true;
    } catch (e) {
      console.error('[FileManager] remove error', e);
      return false;
    }
  }
};

if (typeof window !== 'undefined') {
  window.FileManager = FileManager;
}