// Minimal in-browser build manager using esbuild-wasm.
// Responsibilities:
// - Initialize esbuild-wasm (once).
// - Provide transpile(sourceFiles, entry) -> { outfileText, files } where files map filename->code (Esm).
// - Designed for use by PreviewManager to produce compiled JS for .ts/.tsx/.jsx inputs.
// Note: This is intentionally small and safe — it runs in main thread here for simplicity.
// For heavier workloads, move esbuild-wasm into a Worker.

let esbuildReady = false;
let esbuildInstance = null;
/* NEW: global promise so multiple callers await a single initialize */
let esbuildReadyPromise = null;

/* @tweakable [Controls whether esbuild-wasm runs in a Worker or the main thread. Set true to move heavy transforms off the main thread.] */
export const TWEAK_useWorker = true;

/* @tweakable [Default external resolver host used when rewiring bare imports for preview. For fast prototyping use esm.sh.] */
export const TWEAK_externalHost = 'https://esm.sh';

/* @tweakable [Preferred CDN for loading esbuild-wasm ESM wrapper. Use esm.sh for reliable ESM delivery.] */
export const TWEAK_esbuildCDN = 'https://esm.sh';

/* @tweakable [Custom wasm URL for esbuild-wasm — change this if you want to host the WASM file or use a mirror.] */
export const TWEAK_esbuildWasmURL = 'https://esm.sh/esbuild-wasm@0.17.19/esbuild.wasm';

/* @tweakable [When true, attempt to initialize esbuild-wasm for in-browser compilation of TS/TSX/JSX] */
export const TWEAK_enableInBrowserEsbuild = true;

/* @tweakable [When true, include full esbuild warnings/errors with file, location and text in the returned errors array] */
export const TWEAK_verboseBuildDiagnostics = true;

/**
 * Initialize esbuild-wasm (uses TWEAK_esbuildWasmURL)
 */
async function initEsbuild() {
  if (esbuildReady) return esbuildInstance;
  if (esbuildReadyPromise) return esbuildReadyPromise;

  esbuildReadyPromise = (async () => {
    // Polyfill minimal Node globals that some esbuild wrappers expect.
    if (typeof globalThis.module === 'undefined') globalThis.module = {};
    if (!globalThis.process) globalThis.process = { env: {} };
    if (!globalThis.fs) globalThis.fs = {}; // lightweight stub

    try {
      if (!TWEAK_enableInBrowserEsbuild) throw new Error('In-browser esbuild disabled via tweakable flag.');
      const esbuildModule = await import('https://esm.sh/esbuild-wasm@0.17.19');
      const wasmUrl = TWEAK_esbuildWasmURL;
      const tryInit = async (mod) => {
        if (mod && typeof mod.initialize === 'function') { await mod.initialize({ wasmURL: wasmUrl, worker: true }); return mod; }
        if (mod && mod.default && typeof mod.default.initialize === 'function') { await mod.default.initialize({ wasmURL: wasmUrl, worker: true }); return mod.default; }
        if (mod && mod.build && mod.transform) return mod;
        throw new Error('esbuild module does not expose initialize/build API (unexpected shape).');
      };
      esbuildInstance = await tryInit(esbuildModule);
      globalThis.__esbuild_initialized = true;
      esbuildReady = true;
      return esbuildInstance;
    } catch (e) {
      esbuildReadyPromise = null;
      console.error('esbuild init error:', e);
      throw e;
    }
  })();

  return esbuildReadyPromise;
}

/**
 * Transpile multiple source files and return bundled JS (esbuild bundle mode).
 * - sources: { 'index.tsx': '...', 'utils.ts': '...' }
 * - entry: the entry filename (must exist in sources)
 * Returns: { code: string, warnings: [], errors: [] }
 */
export async function bundleSources(sources, entry, options = {}) {
  if (TWEAK_enableInBrowserEsbuild) {
    await initEsbuild();
  } else {
    return { code: '', warnings: [], errors: ['In-browser esbuild is disabled (TWEAK_enableInBrowserEsbuild=false).'] };
  }

  // Improved in-memory loader/resolver: handles relative imports, ./ and ../ resolution, and returns non-fatal warnings for missing files
  const loaderPlugin = (sources) => ({
    name: 'in-memory-loader',
    setup(build) {
      const normalize = (base, rel) => {
        try {
          // base may be like 'inmemory:/src/main.tsx' or 'inmemory:/src/dir/'; create base URL
          const baseUrl = new URL(base.startsWith('inmemory:/') ? `inmemory:///${base.replace(/^inmemory:\//, '')}` : `inmemory:///${base}`);
          const resolved = new URL(rel, baseUrl).pathname;
          // strip leading slash
          return resolved.replace(/^\//, '');
        } catch {
          // fallback naive resolution
          if (rel.startsWith('/')) return rel.replace(/^\//, '');
          if (rel.startsWith('./') || rel.startsWith('../')) {
            const baseDir = base.replace(/[^/]*$/, '');
            return (baseDir + rel).replace(/^\.\//, '').replace(/\/\.\//g, '/');
          }
          return rel;
        }
      };

      build.onResolve({ filter: /.*/ }, args => {
        // If path is already an in-memory URL, keep it internal (don't mark external)
        if (args.path.startsWith('inmemory:/') || args.path.startsWith('inmemory:')) {
          return { path: args.path, namespace: 'inmemory' };
        }
        // treat bare imports (package names) as external so preview importmap can map them
        if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
          return { external: true };
        }
        const importer = args.importer || '';
        const resolved = normalize(importer || args.resolveDir || '', args.path);
        return { path: `inmemory:/${resolved}`, namespace: 'inmemory' };
      });

      build.onLoad({ filter: /.*/, namespace: 'inmemory' }, async (args) => {
        const path = args.path.replace(/^inmemory:\//, '');
        if (sources[path] != null) {
          const ext = (path.split('.').pop() || '').toLowerCase();
          const loaderMap = { ts: 'ts', tsx: 'tsx', jsx: 'jsx', css: 'css', json: 'json', js: 'js', mjs: 'js', cjs: 'js' };
          const loader = loaderMap[ext] || 'js';
          return { contents: sources[path], loader };
        }
        // Graceful fallback: don't crash the bundle — return a small safe module + emit a warning.
        // This prevents esbuild from failing hard on optional/missing files (we still surface warnings).
        const ext = (path.split('.').pop() || '').toLowerCase();
        const fallbackLoader = ext === 'css' ? 'css' : (ext === 'json' ? 'json' : 'js');
        // Attach a non-fatal warning so callers/logs can show precise missing-import diagnostics
        return {
          contents: (fallbackLoader === 'css') ? '/* missing css fallback */' : (fallbackLoader === 'json' ? '{}' : 'export {};'),
          loader: fallbackLoader,
          warnings: [{
            text: `In-memory loader: Missing file "${path}". Importers should ensure this file exists in the project.`,
            location: { file: args.path }
          }]
        };
      });
    }
  });

  // Before calling esbuildInstance.build, filter sources to only supported loaders so YAML / workflows are not passed.
  const supportedExts = ['js','mjs','cjs','ts','tsx','jsx','css','json'];
  const filteredSources = {};
  Object.keys(sources || {}).forEach(k => {
    const ext = (k.split('.').pop() || '').toLowerCase();
    if (supportedExts.includes(ext)) filteredSources[k] = sources[k];
  });

  // Default entry fallback to src/main.tsx if available
  const entryPoint = (entry && filteredSources[entry]) ? entry
                    : (filteredSources['src/main.tsx'] ? 'src/main.tsx'
                    : Object.keys(filteredSources)[0]);

  if (!entryPoint) return { code: '', warnings: [], errors: ['No browser-executable entry found among sources (skipped non-code files).'] };

  try {
    const result = await esbuildInstance.build({
      // Use the in-memory namespace absolute path for the entry so esbuild does not treat it as an external bare path.
      // This prevents errors like: "The entry point 'src/main.tsx' cannot be marked as external"
      entryPoints: [`inmemory:/${entryPoint}`],
      bundle: true,
      write: false,
      format: 'esm',
      sourcemap: options.sourcemap ? 'inline' : false,
      minify: !!options.minify,
      plugins: [ loaderPlugin(sources) ],
      logLevel: 'silent',
      loader: { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.jsx': 'jsx', '.css': 'css', '.json': 'json' },
      target: ['es2020'],
      // Enable CSS bundling for in-memory builds
      outdir: 'out', // Required for CSS bundling even when write: false
      splitting: false,
      // Bundle CSS into JS when write: false
      inject: []
    });

    // result.outputFiles contains bundled code and potentially CSS
    let code = '';
    let cssContent = '';
    
    if (result.outputFiles && result.outputFiles.length > 0) {
      // Find JS and CSS output files
      const jsFile = result.outputFiles.find(f => f.path.endsWith('.js'));
      const cssFile = result.outputFiles.find(f => f.path.endsWith('.css'));
      
      code = jsFile ? jsFile.text : '';
      cssContent = cssFile ? cssFile.text : '';
      
      // If CSS content exists, inject it into the JS bundle
      if (cssContent) {
        const cssInjection = `
// Auto-injected CSS from bundling
const css = \`${cssContent.replace(/`/g, '\\`')}\`;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
`;
        code = cssInjection + '\n' + code;
      }
    }
    
    // Optionally format diagnostics into text strings for better console visibility
    const formatDiag = (d) => {
      if (!d) return '';
      const loc = d.location ? `${d.location.file || ''}:${d.location.line || '?'}:${d.location.column || '?'}` : '';
      return `${d.plugin ? `[plugin:${d.plugin}] ` : ''}${loc} ${d.text || String(d)}`;
    };
    const warnings = (result.warnings || []).map(w => formatDiag(w));
    const errors = (result.errors || []).map(e => formatDiag(e));
    return { code, warnings, errors };
  } catch (err) {
    // normalize and optionally expand esbuild error objects into precise diagnostics
    const raw = err || {};
    let messages = [];
    if (Array.isArray(raw.errors) && raw.errors.length) {
      messages = raw.errors.map(e => {
        const loc = e.location ? `${e.location.file || ''}:${e.location.line || '?'}:${e.location.column || '?'}` : '';
        return `${e.plugin ? `[plugin:${e.plugin}] ` : ''}${loc} ${e.text || e.message || JSON.stringify(e)}`;
      });
    } else if (raw.message) {
      messages = [raw.message];
    } else {
      messages = [String(raw)];
    }
    // If tweakable full diagnostics enabled, attach stack / object
    if (TWEAK_verboseBuildDiagnostics && raw.stack) {
      messages.push(String(raw.stack));
    }
    // Ensure messages are unique and clear for console/UI
    const unique = Array.from(new Set(messages.map(m => String(m))));
    return { code: '', warnings: [], errors: unique };
  }
}

/**
 * Quick helper: detect entry from sources (prefers index.tsx, index.ts, index.jsx, index.js)
 */
export function detectEntry(sources) {
  /* @tweakable [List of preferred code entry filenames to try when detecting bundle entry] */
  const candidates = ['src/main.tsx','index.tsx','index.ts','index.jsx','index.js','main.tsx','main.ts','src/main.js','src/index.tsx','src/index.ts','src/index.js'];
  for (const c of candidates) if (sources[c]) return c;
  // Fallback: choose the first source that has a browser-executable code extension
  const preferredExts = ['ts','tsx','jsx','js','mjs','cjs'];
  const firstCode = Object.keys(sources || {}).find(k => preferredExts.includes((k.split('.').pop() || '').toLowerCase()));
  if (firstCode) return firstCode;
  // Last resort: return the first available file (keeps previous behavior)
  return Object.keys(sources)[0];
}

/**
 * Generate a very small, deterministic "package-lock.json"-style object for a given package.json
 * This is intentionally lightweight and deterministic (does not fetch registry metadata).
 * It helps consumers produce a lock-like file for previews/CI where a real lockfile isn't available.
 *
 * NOTE: This does not replace a true npm-shrinkwrap / npm ci lockfile. Use only for preview reproducibility.
 *
 * @param {object} pkg package.json object (must include dependencies or devDependencies)
 * @returns {object} simple lockfile object (stringify and save as package-lock.json if desired)
 */
export function generateSimpleLockfile(pkg = {}) {
  const lock = {
    name: pkg.name || 'project',
    version: pkg.version || '1.0.0',
    lockfileVersion: 1,
    requires: true,
    packages: {
      '': {
        name: pkg.name || 'project',
        version: pkg.version || '1.0.0',
        dependencies: {}
      }
    },
    dependencies: {}
  };

  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  for (const [name, ver] of Object.entries(deps)) {
    // Create a deterministic pinned resolution using the provided range (no network).
    // We wrap the version range in a pseudo-resolved field to indicate "pinned-as-range".
    lock.packages[''].dependencies[name] = ver;
    lock.dependencies[name] = {
      version: ver,
      resolved: `${TWEAK_externalHost}/${name}@${ver}`,
      integrity: null,
      dev: !!(pkg.devDependencies && pkg.devDependencies[name])
    };
  }

  return lock;
}

/**
 * Convenience: create a preview bundle and an accompanying "package-lock" for the project.
 * - sources: map filename -> content
 * - entry: entry filename
 * - options: { packageJson: object|null, sourcemap, minify }
 *
 * Returns { code, warnings, errors, lockfile } where lockfile is a JS object ready for JSON.stringify.
 */
export async function bundleWithLock(sources, entry, options = {}) {
  const chosenEntry = entry || detectEntry(sources) || 'src/main.tsx';
  const { code, warnings, errors } = await bundleSources(sources, chosenEntry, options);
  let lockfile = null;
  if (options.packageJson) {
    lockfile = generateSimpleLockfile(options.packageJson);
  }
  return { code, warnings, errors, lockfile };
}

export default {
  initEsbuild,
  bundleSources,
  detectEntry,
  generateSimpleLockfile,
  bundleWithLock
};