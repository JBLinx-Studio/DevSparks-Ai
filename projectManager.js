/* @tweakable [Toggle verbose project manager debug logging] */
const PROJECT_MANAGER_VERBOSE = true;

/* Minimal ProjectManager stub to satisfy index.html imports and coordinate builds/previews.
   Exposes a few helpers used by the UI and delegates heavy work to buildManager/previewManager. */

import { bundleWithLock, detectEntry } from './buildManager.js';

export const ProjectManager = {
  async detectEntryPoint(files) {
    try {
      const entry = detectEntry(files || {});
      if (PROJECT_MANAGER_VERBOSE) console.debug('[ProjectManager] detected entry', entry);
      return entry;
    } catch (e) {
      console.warn('[ProjectManager] detectEntryPoint failed', e);
      return Object.keys(files || {})[0] || 'index.html';
    }
  },

  async bundleForPreview(files, options = {}) {
    // files: { filename: content }
    // options: { sourcemap, minify, packageJson }
    try {
      const entry = await this.detectEntryPoint(files);
      const result = await bundleWithLock(files, entry, {
        sourcemap: !!options.sourcemap,
        minify: !!options.minify,
        packageJson: options.packageJson || null
      });
      if (PROJECT_MANAGER_VERBOSE) console.debug('[ProjectManager] bundle result', result);
      return { entry, ...result };
    } catch (e) {
      console.error('[ProjectManager] bundleForPreview error', e);
      return { code: '', warnings: [], errors: [String(e)], lockfile: null };
    }
  },

  /* NEW: watchFilesAndAutoBuild
     - watches an in-memory files object for changes (simple diff-based) and triggers bundleForPreview
     - writes output into files['dist/bundle.js'] and returns bundle metadata
     - options.watchInterval: ms polling interval (default 800ms)
  */
  async watchFilesAndAutoBuild(filesRef, onBuilt = () => {}, options = {}) {
    const interval = options.watchInterval || 800;
    let lastSnapshot = JSON.stringify(Object.keys(filesRef || {}).sort().map(k => [k, (filesRef[k] || '').length]));

    const runBuild = async () => {
      try {
        const { entry, code, warnings, errors, lockfile } = await this.bundleForPreview(filesRef, { sourcemap: false, minify: false, packageJson: filesRef['package.json'] ? JSON.parse(filesRef['package.json']) : null });
        if (errors && errors.length) {
          console.warn('[ProjectManager] auto-build errors', errors);
        }
        if (code && code.length) {
          // place compiled bundle into project files under dist/bundle.js
          filesRef['dist/bundle.js'] = code;
          // Also ensure index.html references the bundle if present
          if (filesRef['index.html'] && !filesRef['index.html'].includes('dist/bundle.js')) {
            if (filesRef['index.html'].includes('</body>')) {
              filesRef['index.html'] = filesRef['index.html'].replace('</body>', `    <script src="./dist/bundle.js"></script>\n</body>`);
            } else {
              filesRef['index.html'] += `\n<script src="./dist/bundle.js"></script>\n`;
            }
          }
          // callback to let consumers refresh preview/save
          onBuilt({ entry, warnings, errors, lockfile, bundlePath: 'dist/bundle.js' });
        }
      } catch (e) {
        console.error('[ProjectManager] watchFilesAndAutoBuild build error', e);
      }
    };

    // initial build
    await runBuild();

    // simple polling watch loop (safe and low-dependency)
    const watcherId = setInterval(async () => {
      try {
        const snapshot = JSON.stringify(Object.keys(filesRef || {}).sort().map(k => [k, (filesRef[k] || '').length]));
        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot;
          if (PROJECT_MANAGER_VERBOSE) console.debug('[ProjectManager] detected file changes, triggering auto-build');
          await runBuild();
        }
      } catch (e) {
        console.error('[ProjectManager] watcher loop error', e);
      }
    }, interval);

    return {
      stop: () => clearInterval(watcherId)
    };
  }
};

if (typeof window !== 'undefined') window.ProjectManager = ProjectManager;