import * as buildManager from './buildManager.js';

export class PreviewManager {
    constructor(app) {
        this.app = app;
        this.blobUrls = {}; // Store blob URLs to revoke later
        this.currentPreviewMode = 'desktop'; // Initialize preview mode, now managed only here
        this.previewFrame = document.getElementById('previewFrame'); // Get reference
        this.previewLoadingOverlay = document.getElementById('previewLoadingOverlay'); // Get reference

        /* @tweakable [Enable caching of build bundles per project id to speed repeated builds in this session] */
        this.TWEAK_enableBuildCache = true;
        /* @tweakable [Maximum number of cached builds to keep in-memory] */
        this.TWEAK_buildCacheLimit = 5;
        /* @tweakable [When true, attempts in-browser build even if lockfile suggests external tooling — may not perfectly emulate bun/npm/pnpm dev servers] */
        this.TWEAK_forceInBrowserBuild = true;
        /* @tweakable [When true, PreviewManager will attempt to spawn an in-browser build using buildManager (esbuild-wasm) for TS/TSX/JSX] */
        this.TWEAK_attemptInBrowserBuild = true;
        /* @tweakable [When true, display helpful dev-server guidance (and attempt a proxy simulation) when package.json / vite.config.* / bun.lockb exist] */
        this.TWEAK_enableDevServerFallback = true;

        // simple in-memory cache: { projectId: { bundleUrl, lockfile, timestamp, logs } }
        this._buildCache = {};

        this.setupIframeListeners(); // New method for iframe listeners
    }

    setupIframeListeners() {
        if (this.previewFrame) {
            this.previewFrame.onload = () => {
                this.hideLoadingOverlay();
                this.app.addConsoleMessage('info', 'Preview loaded successfully.');
            };
            // Note: iframe onerror is limited for cross-origin content.
            // For same-origin (blob URLs), it should work for network/scripting errors.
            this.previewFrame.onerror = () => {
                this.hideLoadingOverlay();
                this.app.addConsoleMessage('error', 'Preview failed to load. Check console for errors in the preview frame.');
                // Optionally inject a user-friendly error message into the iframe if it's completely blank
                if (this.previewFrame.contentDocument && (!this.previewFrame.contentDocument.body || this.previewFrame.contentDocument.body.children.length === 0)) {
                    this.previewFrame.contentDocument.open();
                    this.previewFrame.contentDocument.write(`
                        <style>
                            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f0f0; color: #333; text-align: center; flex-direction: column; }
                            h1 { color: #cc0000; }
                            p { margin-top: 10px; }
                        </style>
                        <h1>Preview Load Error</h1>
                        <p>There was an error loading the preview content.</p>
                        <p>This may be due to malformed HTML, CSS, or JavaScript.</p>
                        <p>Check the Console tab for more details from the preview environment.</p>
                    `);
                    this.previewFrame.contentDocument.close();
                }
            };
        }
    }

    showLoadingOverlay() {
        if (this.previewLoadingOverlay) {
            this.previewLoadingOverlay.classList.remove('hidden');
        }
    }

    hideLoadingOverlay() {
        if (this.previewLoadingOverlay) {
            this.previewLoadingOverlay.classList.add('hidden');
        }
    }

    // Helper to get MIME type based on file extension
    getFileMimeType(filename) {
        if (filename.endsWith('.html')) return 'text/html';
        if (filename.endsWith('.css')) return 'text/css';
        if (filename.endsWith('.js') || filename.endsWith('.cjs') || filename.endsWith('.mjs')) return 'application/javascript'; // Standard MIME type for JavaScript
        // Add more MIME types for common assets if needed (e.g., images)
        if (filename.endsWith('.png')) return 'image/png';
        if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
        if (filename.endsWith('.gif')) return 'image/gif';
        if (filename.endsWith('.svg')) return 'image/svg+xml';
        if (filename.endsWith('.webp')) return 'image/webp'; // Added webp
        if (filename.endsWith('.ico')) return 'image/x-icon'; // Favicon
        if (filename.endsWith('.avif')) return 'image/avif'; // AVIF image format
        if (filename.endsWith('.mp4')) return 'video/mp4';
        if (filename.endsWith('.webm')) return 'video/webm';
        if (filename.endsWith('.ogg')) return 'video/ogg';
        if (filename.endsWith('.mov')) return 'video/quicktime'; // Common MIME for .mov
        // For other text-based files, a generic text MIME type is usually fine
        if (filename.endsWith('.json')) return 'application/json';
        if (filename.endsWith('.md')) return 'text/markdown';
        if (filename.endsWith('.txt') || filename.endsWith('.gitignore') || filename.endsWith('.lock') || filename.endsWith('.toml') || filename.endsWith('.ini') || filename.endsWith('.cfg') || filename.endsWith('.d.ts') || filename.endsWith('robots.txt') || filename.endsWith('deploy.yml') || filename.endsWith('dockerfile') || filename.endsWith('procfile')) return 'text/plain'; // Added new text types including Dockerfile, Procfile
        if (filename.endsWith('.xml')) return 'application/xml';
        if (filename.endsWith('.yml') || filename.endsWith('.yaml')) return 'text/yaml';
        if (filename.endsWith('.env')) return 'text/plain';
        if (filename.endsWith('.jsx')) return 'text/jsx';
        if (filename.endsWith('.ts')) return 'application/typescript';
        if (filename.endsWith('.tsx')) return 'text/tsx';
        if (filename.endsWith('.d.ts')) return 'application/typescript'; // TypeScript declaration files
        return 'application/octet-stream'; // Default for unknown types
    }

    showPreview() {
        const modal = document.getElementById('previewModal');
        modal.style.display = 'flex';
        // Ensure the correct mode is applied when showing the preview.
        // If the mode was changed while the modal was hidden, it will update now.
        this.setPreviewMode(this.currentPreviewMode);
        this.updatePreviewFrameContent(); // Always update content when showing preview
    }
    
    hidePreview() {
        document.getElementById('previewModal').style.display = 'none';
        this.previewFrame.src = 'about:blank'; // Clear iframe content

        // Revoke all created blob URLs to free memory
        for (const url of Object.values(this.blobUrls)) {
            URL.revokeObjectURL(url);
        }
        this.blobUrls = {}; // Reset stored blob URLs
        this.hideLoadingOverlay(); // Ensure loading overlay is hidden when preview closes
    }

    setPreviewMode(mode) {
        this.currentPreviewMode = mode;
        const previewContent = document.querySelector('#previewModal .preview-content');
        
        // Remove all mode classes
        previewContent.classList.remove('desktop-mode', 'tablet-mode', 'mobile-mode');

        // Add the new mode class
        previewContent.classList.add(`${mode}-mode`);

        // Update active state of buttons
        document.querySelectorAll('.preview-mode-buttons .btn-sm').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        this.updatePreviewFrameContent(); // Re-render content with new sizing
        // Route preview mode updates to the Console instead of top-right toasts
        this.app.addConsoleMessage('info', `Preview set to ${mode} mode.`);
    }

    async updatePreviewFrameContent() {
        // Add null checks to prevent errors
        if (!this.previewFrame || !this.app.currentProject) { // Removed modal.style.display check to allow updates even if hidden
            return;
        }

        this.showLoadingOverlay(); // Show loading before starting to build the content
        this.previewFrame.src = 'about:blank'; // Clear iframe while preparing new content

        // Revoke previous blob URLs before creating new ones for a fresh render
        for (const url of Object.values(this.blobUrls)) {
            URL.revokeObjectURL(url);
        }
        this.blobUrls = {}; // Reset stored blob URLs

        // 1. Create Blob URLs for ALL current files and build an import map for JS modules
        const fileBlobMap = {}; // Maps original filename to its blob URL (or direct URL for external images)
        const importMapEntries = {}; // Maps original filename (e.g., './app.js') to its blob URL for importmap

        for (const filename in this.app.currentFiles) {
            const content = this.app.currentFiles[filename];
            const mimeType = this.getFileMimeType(filename);

            // Special handling for image files that might contain direct URLs (e.g., generated images)
            if (filename.match(/\.(png|jpe?g|gif|svg|mp4|webm|ogg|mov|webp|ico|avif)$/i) && (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://')))) {
                fileBlobMap[filename] = content; // Store the direct external URL
                // No blob URL for these, so don't add to this.blobUrls for revocation
            } else {
                // Ensure null content (from local storage size limits) is treated as empty string for blob creation
                const blob = new Blob([content || ''], { type: mimeType });
                const url = URL.createObjectURL(blob);
                fileBlobMap[filename] = url;
                this.blobUrls[filename] = url; // Store all blob URLs for later revocation in hidePreview

                // Only pure JavaScript files (JS, CJS, MJS) should be added to import map for now
                if (filename.endsWith('.js') || filename.endsWith('.cjs') || filename.endsWith('.mjs')) {
                    importMapEntries[`./${filename}`] = url;
                }
            }
        }

        // 2. Determine the main HTML file
        let mainHtmlFilename = 'index.html'; // Always prefer index.html
        if (!this.app.currentFiles.hasOwnProperty('index.html')) {
            // If no index.html, find the first available .html file
            mainHtmlFilename = Object.keys(this.app.currentFiles).find(name => name.endsWith('.html'));
        }

        let htmlContent = '';
        if (mainHtmlFilename && this.app.currentFiles[mainHtmlFilename]) { 
            htmlContent = this.app.currentFiles[mainHtmlFilename];
        } else {
            // Default HTML if no HTML file name was found or content is missing
            htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview - No HTML File</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f0f0; color: #333; text-align: center; flex-direction: column; }
        h1 { color: #cc0000; }
        p { margin-top: 10px; }
    </style>
</head>
<body>
    <div>
        <h1>No Main HTML File Found</h1>
        <p>Please ensure your project contains an 'index.html' file, or at least one HTML file to preview.</p>
        <p>If you just created an empty project, you might need to add content.</p>
    </div>
</body>
</html>`;
        }

        // Parse the HTML content into a Document for safe DOM manipulation.
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Detect uncompiled source files that require a build step (ts/tsx/jsx)
        const uncompiledCandidates = Object.keys(this.app.currentFiles || {}).filter(name =>
            /\.(ts|tsx|jsx)$/.test(name)
        );
        const compiledJsExists = uncompiledCandidates.some(name => {
            const possibleJs = name.replace(/\.(ts|tsx|jsx)$/, '.js');
            return this.app.currentFiles.hasOwnProperty(possibleJs);
        });
        if (uncompiledCandidates.length > 0 && !compiledJsExists) {
            // Attempt an in-browser transpile + bundle using our local buildManager (esbuild-wasm)
            if (buildManager && typeof buildManager.bundleWithLock === 'function') {
                try {
                    this.app.addConsoleMessage('info', `Preview: Detected ${uncompiledCandidates.length} uncompiled source file(s). Attempting in-browser transpile...`);
                    // Ensure package.json and essential local helper files exist so the bundle can reference them locally
                    if (!this.app.currentFiles['package.json']) {
                        const defaultPkg = { name: this.app.currentProject?.name || 'preview-project', version: '1.0.0', dependencies: {} };
                        this.app.currentFiles['package.json'] = JSON.stringify(defaultPkg, null, 2);
                        this.app.addConsoleMessage('info', 'No package.json found — generated a minimal package.json for preview reproducibility.');
                    }
                    if (!this.app.currentFiles['tsconfig.json']) {
                        this.app.currentFiles['tsconfig.json'] = JSON.stringify({
                            compilerOptions: { target: "ES2020", module: "ESNext", jsx: "react-jsx", strict: false, esModuleInterop: true },
                            include: ["src", "src/**/*"]
                        }, null, 2);
                        this.app.addConsoleMessage('info', 'No tsconfig.json found — added a basic tsconfig.json for preview builds.');
                    }
                    if (!this.app.currentFiles['bun.lockb']) {
                        this.app.currentFiles['bun.lockb'] = ''; // placeholder to hint bun projects (non-blocking)
                    }

                    const entry = buildManager.detectEntry(this.app.currentFiles);
                    const { code, warnings, errors, lockfile } = await buildManager.bundleWithLock(this.app.currentFiles, entry, { sourcemap: false, minify: false, packageJson: JSON.parse(this.app.currentFiles['package.json'] || '{}') });
                    // Persist simple lockfile into project for traceability (non-blocking)
                    if (lockfile && this.app.currentProject) {
                        this.app.currentProject.packageLock = lockfile;
                        this.app.addConsoleMessage('info', 'Generated lightweight preview lockfile and attached to project.');
                        await this.app.saveCurrentProject?.();
                    }
                    if ((errors && errors.length) || (warnings && warnings.length)) {
                        if (warnings && warnings.length) this.app.addConsoleMessage('warn', `Transpile warnings: ${warnings.join(' | ')}`);
                        if (errors && errors.length) {
                            // Provide more structured error output and list likely-missing imports
                            errors.forEach(errText => {
                                this.app.addConsoleMessage('error', `Transpile error: ${errText}`);
                            });
                            this.app.addConsoleMessage('error', `Transpile failed. Missing or unresolved imports listed above. If you see "Missing file" messages, ensure those files exist in the project (e.g., src/App.tsx, src/index.css).`);
                        }
                    }
                    if (errors && errors.length) {
                        // Build failed — render an informative error page inside the preview iframe
                        const errorHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Build Errors</title><style>body{font-family:sans-serif;padding:24px;background:#fff;color:#111} pre{background:#f7f7f9;padding:12px;border-radius:6px;overflow:auto;border:1px solid #eee}</style></head><body><h1>Preview Build Failed</h1><p>In-browser bundling failed with the following error(s):</p><pre>${(errors||[]).map(e=>String(e)).join('\n\n')}</pre><p>Check the Console panel for more details.</p></body></html>`;
                        const errBlob = new Blob([errorHtml], { type: 'text/html' });
                        const errUrl = URL.createObjectURL(errBlob);
                        this.blobUrls['__main__'] = errUrl;
                        this.previewFrame.src = errUrl;
                        this.hideLoadingOverlay();
                        return; // stop further processing
                    } else if (code) {
                        // Inject transpiled bundle as a virtual file and include in importMap / blobs
                        const bundleName = '__in_memory_bundle__.js';
                        const blob = new Blob([code], { type: 'application/javascript' });
                        const bundleUrl = URL.createObjectURL(blob);
                        this.blobUrls[bundleName] = bundleUrl;
                        fileBlobMap[bundleName] = bundleUrl;
                        importMapEntries[`./${bundleName}`] = bundleUrl;
                        this.app.addConsoleMessage('success', `In-browser transpile successful — injecting ${bundleName} into preview.`);
                        // Ensure index.html links the bundle if not already referencing JS module
                        if (htmlContent && !htmlContent.includes(bundleName)) {
                            // Prefer to append before </body>
                            if (htmlContent.includes('</body>')) {
                                htmlContent = htmlContent.replace('</body>', `<script src=\"./${bundleName}\"></script>\\n</body>`);
                            } else {
                                htmlContent += `\\n<script src=\"./${bundleName}\"></script>\\n`;
                            }
                        }
                    }
                } catch (e) {
                    this.app.addConsoleMessage('error', `In-browser transpile failed: ${e.message || e}`);
                }
            } else {
                // Warn user in console + app UI that these files need compilation
                this.app.addConsoleMessage('warn', `Preview note: ${uncompiledCandidates.length} TypeScript/JSX source file(s) detected (${uncompiledCandidates.join(', ')}). Ensure compiled .js outputs exist for them to run in the preview.`);
            }
        }

        // Detect multi-file build-required projects (TypeScript/TSX, Vite configs, presence of lockfiles/package managers)
        const hasTS = Object.keys(this.app.currentFiles || {}).some(n => n.endsWith('.ts') || n.endsWith('.tsx'));
        const hasViteTsConfig = this.app.currentFiles && (this.app.currentFiles['vite.config.ts'] || this.app.currentFiles['vite.config.js']);
        const hasPackageJson = this.app.currentFiles && this.app.currentFiles['package.json'];
        const hasLockfile = this.app.currentFiles && (this.app.currentFiles['bun.lockb'] || this.app.currentFiles['package-lock.json'] || this.app.currentFiles['pnpm-lock.yaml']);

        /* @tweakable [Preferred package manager when multiple lockfiles or package.json exist. Allowed values: 'bun','npm','pnpm','auto'] */
        const PREFERRED_PACKAGE_MANAGER = this.app.config?.preferredPackageManager || 'auto';

        // If project requires a build step / dev server, do NOT attempt to run as plain static preview.
        if ((hasTS || hasViteTsConfig || (hasPackageJson && hasLockfile)) && !this.app.forceStaticPreview) {
            // Recommend the correct manager based on lockfiles, with fallback to package.json + preference
            let detectedManager = 'npm';
            if (this.app.currentFiles['bun.lockb']) detectedManager = 'bun';
            else if (this.app.currentFiles['pnpm-lock.yaml']) detectedManager = 'pnpm';
            else if (this.app.currentFiles['package-lock.json']) detectedManager = 'npm';
            else if (PREFERRED_PACKAGE_MANAGER !== 'auto') detectedManager = PREFERRED_PACKAGE_MANAGER;

            // Compose clear actionable message for user / orchestrator to run proper dev server instead of static render
            const reasonParts = [];
            if (hasTS) reasonParts.push('TypeScript/TSX files present');
            if (hasViteTsConfig) reasonParts.push('Vite config found');
            if (hasLockfile) reasonParts.push('Lockfile detected');
            const reason = reasonParts.join(', ');

            this.app.addConsoleMessage('warn', `Preview paused: project appears to need a build/dev server (${reason}).`);
            this.app.addConsoleMessage('info', `Suggested steps: run '${detectedManager} install' then '${detectedManager === 'bun' ? 'bun dev' : "npm run dev"}' (or 'vite dev') in a real environment. Preview will not execute raw .ts/.tsx or config files.`);

            // Render an informative in-iframe placeholder explaining why we won't render raw files
            const placeholderHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview Requires Build</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#111}main{max-width:680px;padding:28px;border-radius:12px;border:1px solid #eee;box-shadow:0 6px 24px rgba(0,0,0,0.06)}h1{margin:0 0 8px;font-size:20px}p{margin:8px 0;color:#333}code{background:#f6f8fa;padding:4px 6px;border-radius:6px;font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;}</style></head><body><main><h1>Preview blocked: build step required</h1><p>This project contains source files that must be compiled or served via a dev server (TypeScript / Vite / bundler).</p><p>Recommended commands (run locally):</p><ol><li><code>${detectedManager} install</code></li><li><code>${detectedManager === 'bun' ? 'bun dev' : "npm run dev"}</code> or <code>vite dev</code></li></ol><p>If you want to force a static in-browser attempt, enable the <code>forceStaticPreview</code> flag on the app instance (not recommended for TS/TSX projects).</p></main></body></html>`;

            const blob = new Blob([placeholderHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            this.blobUrls['__main__'] = url;
            this.previewFrame.src = url;
            this.hideLoadingOverlay();
            return; // stop further processing to avoid trying to run raw sources
        }

        // Add after computing importMapEntries and BEFORE injecting import map into the doc.head
        /* @tweakable [Host used to resolve bare imports at preview runtime — will map package names to this ESM CDN with the version from package.json] */
        const PREVIEW_EXTERNAL_HOST = buildManager && buildManager.TWEAK_externalHost ? buildManager.TWEAK_externalHost : 'https://esm.sh';

        // If project has a package.json (or attached dependencies), map bare imports to the ESM host so externalized imports from esbuild resolve.
        try {
            const pkg = this.app.currentProject && (this.app.currentProject.packageJson || this.app.currentProject['package.json'])
                      ? (this.app.currentProject.packageJson || JSON.parse(this.app.currentProject['package.json'] || '{}'))
                      : null;
            if (pkg && pkg.dependencies) {
                Object.entries(pkg.dependencies).forEach(([name, ver]) => {
                    // prefer exact mapping only when not already provided by importMapEntries
                    if (!importMapEntries[name]) {
                        // Normalize version (strip semver ranges for CDN-friendly mapping if needed)
                        let verTag = ver && typeof ver === 'string' ? ver.replace(/^[\^~<>]=?/, '') : '';
                        if (!verTag) verTag = 'latest';
                        importMapEntries[name] = `${PREVIEW_EXTERNAL_HOST}/${name}@${verTag}`;
                        // Also support mapping common subpaths (e.g., react/jsx-runtime)
                        importMapEntries[`${name}/`] = `${PREVIEW_EXTERNAL_HOST}/${name}@${verTag}/`;
                    }
                });
            }
        } catch (e) {
            this.app.addConsoleMessage('warn', `Preview import map generation failed: ${e.message}`);
        }

        // Inject the generated import map into the <head> section
        if (Object.keys(importMapEntries).length > 0) {
            const importMapScript = doc.createElement('script');
            importMapScript.type = 'importmap';
            importMapScript.textContent = JSON.stringify({ imports: importMapEntries }, null, 2);
            // doc.head is guaranteed to exist by DOMParser when parsing text/html
            doc.head.prepend(importMapScript); 
        }

        // Inject console interception script
        const consoleInterceptorScript = doc.createElement('script');
        consoleInterceptorScript.textContent = `
(function() {
    const originalConsole = { ...window.console };
    const consoleMethods = ['log', 'warn', 'error', 'info', 'debug'];

    consoleMethods.forEach(methodName => {
        window.console[methodName] = function(...args) {
            // Call the original console method
            originalConsole[methodName].apply(originalConsole, args);

            // Send message to parent window
            try {
                const message = args.map(arg => {
                    if (typeof arg === 'object' && arg !== null) {
                        try {
                            // Attempt to stringify, handle circular references
                            const cache = new Set();
                            const jsonString = JSON.stringify(arg, (key, value) => {
                                if (typeof value === 'object' && value !== null) {
                                    if (cache.has(value)) {
                                        // Circular reference found, discard key
                                        return '[Circular]';
                                    }
                                    // Store value in our collection
                                    cache.add(value);
                                }
                                return value;
                            });
                            return jsonString;
                        } catch (e) {
                            return String(arg); // Fallback for other stringify errors
                        }
                    }
                    return String(arg);
                }).join(' ');

                window.parent.postMessage({
                    type: 'console-log',
                    data: {
                        method: methodName,
                        message: message,
                        timestamp: new Date().toISOString()
                    }
                }, '*'); // Use '*' for development, narrow origin in production
            } catch (e) {
                // Fallback for extreme cases where postMessage fails
                originalConsole.error('Failed to post console message to parent:', e);
            }
        };
    });

    // Capture unhandled errors as well
    window.addEventListener('error', (event) => {
        originalConsole.error('Uncaught Error:', event.message, 'at', event.filename, ':', event.lineno, ':', event.colno);
        window.parent.postMessage({
            type: 'console-log',
            data: {
                method: 'error',
                message: \`Uncaught Error: \${event.message} at \${event.filename}:\${event.lineno}:\${event.colno}\`,
                timestamp: new Date().toISOString()
            }
        }, '*');
    });

    window.addEventListener('unhandledrejection', (event) => {
        originalConsole.error('Unhandled Promise Rejection:', event.reason);
        window.parent.postMessage({
            type: 'console-log',
            data: {
                method: 'error',
                message: \`Unhandled Promise Rejection: \${event.reason}\`,
                timestamp: new Date().toISOString()
            }
        }, '*');
    });

})();
`;
        doc.head.appendChild(consoleInterceptorScript); 

        // Rewrite relative paths for linked resources within the HTML to their Blob URLs (or direct URLs for external images)
        // This makes sure CSS, JS, and image files linked in the HTML can be loaded by the iframe.
        
        // Rewrite CSS <link> tags
        doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                const cleanHref = href.startsWith('./') ? href.substring(2) : href;
                if (fileBlobMap[cleanHref]) {
                    link.setAttribute('href', fileBlobMap[cleanHref]);
                }
            }
        });

        // Rewrite <script> tags
        doc.querySelectorAll('script[src]').forEach(script => {
            const src = script.getAttribute('src');
            if (src) {
                const cleanSrc = src.startsWith('./') ? src.substring(2) : src; // Get relative filename
                const filenameLower = cleanSrc.toLowerCase();
                const fileExtension = filenameLower.split('.').pop();

                const shouldIgnoreAsScript =
                    this._nonExecutableScriptExtensions.includes(fileExtension) ||
                    this._nonExecutableScriptFilenames.includes(filenameLower) ||
                    this._nonExecutableScriptFilenames.some(pattern => {
                        // Special handling for patterns like "*.config.js" if needed, but for now exact matches in _nonExecutableScriptFilenames
                        // are sufficient as it lists full filenames.
                        if (pattern.startsWith('*.')) { // e.g., "*.config.js"
                            return filenameLower.endsWith(pattern.substring(1));
                        }
                        return false;
                    }) ||
                    filenameLower.startsWith('.github/workflows'); // Explicitly ignore workflow files

                if (shouldIgnoreAsScript) {
                    this.app.addConsoleMessage('warn', `Preview: Ignoring script tag for non-browser-executable file: "${cleanSrc}". It likely requires a build step.`);
                    script.removeAttribute('src'); // Remove src to prevent browser from fetching/executing
                    script.type = 'text/plain'; // Change type to prevent execution while keeping the tag for inspection
                    // Optionally add informative text: script.textContent = `// Content for ${cleanSrc} requires a build step.`;
                } else if (fileBlobMap[cleanSrc]) {
                    // It's a potentially executable JS file.
                    // If it's a module script and a recognized JS module extension, set src for import map.
                    // Otherwise, for classic scripts, use direct blob URL.
                    if (script.type === 'module' && ['js', 'cjs', 'mjs'].includes(fileExtension)) {
                        script.setAttribute('src', `./${cleanSrc}`); // For importmap resolution
                    } else {
                        script.setAttribute('src', fileBlobMap[cleanSrc]); // Direct blob URL for classic scripts
                    }
                }
            }
        });

        // Rewrite <img> tags
        doc.querySelectorAll('img[src]').forEach(img => {
            const src = img.getAttribute('src');
            if (src) {
                const cleanSrc = src.startsWith('./') ? src.substring(2) : src;
                if (fileBlobMap[cleanSrc]) {
                    img.setAttribute('src', fileBlobMap[cleanSrc]);
                }
            }
        });

        // Rewrite <link rel="icon"> (favicons)
        doc.querySelectorAll('link[rel*="icon"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                const cleanHref = href.startsWith('./') ? href.substring(2) : href;
                if (fileBlobMap[cleanHref]) {
                    link.setAttribute('href', fileBlobMap[cleanHref]);
                }
            }
        });

        // 4. Inject content of any unreferenced CSS/JS files directly into the HTML
        // This ensures that all CSS and JS content from the project is applied, even if not explicitly linked
        // in the main HTML file.
        let cssToInject = '';
        let jsToInject = ''; // This will only contain pure JavaScript

        for (const filename in this.app.currentFiles) {
            // Skip the main HTML file as it's already processed
            if (filename === mainHtmlFilename) continue;

            // Skip image/video files that are just URLs, they need to be referenced by <img>/<video> tags or CSS naturally
            if (filename.match(/\.(png|jpe?g|gif|svg|mp4|webm|ogg|mov|webp|ico|avif)$/i) && (typeof this.app.currentFiles[filename] === 'string' && (this.app.currentFiles[filename].startsWith('http://') || this.app.currentFiles[filename].startsWith('https://')))) {
                continue;
            }

            // Check if CSS file is already linked in the HTML using its original name or blob URL
            const isCssLinked = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).some(link => {
                const href = link.getAttribute('href');
                const cleanHref = href ? (href.startsWith('./') ? href.substring(2) : href) : '';
                return cleanHref === filename || href === fileBlobMap[filename];
            });

            if (filename.endsWith('.css') && !isCssLinked) {
                cssToInject += this.app.currentFiles[filename] + '\n';
            }

            // Check if JS file is already linked/scripted in the HTML using its original name or blob URL
            const isJsScripted = Array.from(doc.querySelectorAll('script[src]')).some(script => {
                const src = script.getAttribute('src');
                const cleanSrc = src ? (src.startsWith('./') ? src.substring(2) : src) : '';
                return cleanSrc === filename || src === fileBlobMap[filename] || (script.type === 'module' && src === `./${filename}`);
            });

            // Only inject pure JavaScript files (ending with .js, .cjs, or .mjs) that are not explicitly linked.
            // Files with .ts, .tsx, .jsx, .d.ts extensions are NOT directly executable by the browser without a build step,
            // so we do not attempt to inject them as executable scripts in the preview.
            // Also exclude files that are explicitly non-executable as defined in _nonExecutableScriptFilenames or _nonExecutableScriptExtensions
            const filenameLower = filename.toLowerCase();
            const fileExtension = filenameLower.split('.').pop();
            const shouldExcludeFromDirectInjection =
                this._nonExecutableScriptExtensions.includes(fileExtension) ||
                this._nonExecutableScriptFilenames.includes(filenameLower) ||
                filenameLower.startsWith('.github/workflows');

            if ((filename.endsWith('.js') || filename.endsWith('.cjs') || filename.endsWith('.mjs')) && !isJsScripted && !shouldExcludeFromDirectInjection) {
                jsToInject += this.app.currentFiles[filename] + '\n';
            }
            // All other file types (e.g., .ts, .tsx, .jsx, .d.ts, config files) are not injected as executable scripts.
            // They are still editable and visible in the file tree.
        }

        // Add collected CSS to a <style> tag in the head
        if (cssToInject) {
            const styleTag = doc.createElement('style');
            styleTag.textContent = cssToInject;
            doc.head.appendChild(styleTag);
        }

        // Add collected JS to a <script> tag (classic) at the end of the body or html
        if (jsToInject) {
            const scriptTag = doc.createElement('script');
            scriptTag.textContent = jsToInject;
            // doc.body is guaranteed to exist by DOMParser when parsing text/html
            doc.body.appendChild(scriptTag);
        }

        // Final HTML content as a string
        let finalHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
        
        // Create a blob for the complete, modified HTML and set it as the iframe's source
        const blob = new Blob([finalHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        this.blobUrls['__main__'] = url; // Store the main HTML blob URL for revocation
        
        this.previewFrame.src = url;
    }

    /**
     * Build & Preview: Attempts to perform an isolated in-browser build for projects that require it,
     * or falls back to the existing static preview flow. Streams build logs into the preview frame
     * when failures occur and caches successful bundles per project id.
     *
     * Behavior:
     *  - If a lockfile indicates bun/npm/pnpm, we will attempt an in-browser bundle with esbuild via buildManager.
     *  - On success, inject resulting bundle and show preview.
     *  - On error, render build logs in the preview iframe so users can debug.
     *
     * Note: This simulates the requested "run detected package manager" behavior by using an in-browser bundler
     * (esbuild-wasm). Running real `npm install` / `bun install` is not possible in-browser; instead this
     * attempts a deterministic in-memory bundling and provides actionable feedback.
     */
    async buildAndPreview() {
        if (!this.app || !this.app.currentProject) {
            this.app?.addConsoleMessage('warn', 'No project loaded to build.');
            return;
        }

        const files = this.app.currentFiles || {};
        const hasPackageJson = !!files['package.json'];
        const hasViteConfig = !!files['vite.config.ts'] || !!files['vite.config.js'];
        const hasBunLock = !!files['bun.lockb'];
        const hasTS = Object.keys(files).some(n => n.endsWith('.ts') || n.endsWith('.tsx'));
        const hasJSX = Object.keys(files).some(n => n.endsWith('.jsx') || n.endsWith('.tsx'));

        // If a dev-server style project is detected and dev-server fallback is enabled, provide explicit instructions and logs.
        if (this.TWEAK_enableDevServerFallback && (hasPackageJson || hasViteConfig || hasBunLock)) {
            const detectedManager = hasBunLock ? 'bun' : 'npm';
            const suggestedInstall = detectedManager === 'bun' ? 'bun install' : 'npm install';
            const suggestedDev = detectedManager === 'bun' ? 'bun dev' : 'npm run dev';

            // Provide detailed console-oriented build logs rather than throwing UI modal blocking errors
            this.app.addConsoleMessage('warn', `Detected a project that likely requires a dev server (package.json/vite config/lockfile present).`);
            this.app.addConsoleMessage('info', `Recommended local steps: 1) ${suggestedInstall}  2) ${suggestedDev} (or 'vite dev').`);
            this.app.addConsoleMessage('info', `DevSpark cannot run system package managers inside the browser. You can either run the dev server locally and paste the running preview URL in the "Open in New Window" dialog, or allow DevSpark to attempt an in-browser bundle if supported.`);

            // Render an informative placeholder page inside the preview iframe with commands and copyable instructions
            const placeholderHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview Requires Build / Dev Server</title><style>body{font-family:system-ui,Roboto,Arial;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#111}main{max-width:720px;padding:28px;border-radius:12px;border:1px solid #eee}code{display:block;background:#f6f8fa;padding:8px;border-radius:6px;margin:8px 0;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;}</style></head><body><main><h1>Build / Dev Server Required</h1><p>This project contains configuration or lockfiles that indicate it needs to run via a dev server (TypeScript / Vite / bundler).</p><p>Suggested local commands:</p><code>${suggestedInstall}</code><code>${suggestedDev}</code><p>DevSpark will attempt an in-browser build for TypeScript/JSX when possible, but cannot run external package managers or full Vite dev servers inside the browser.</p><p>Check the Console panel for build logs and errors. If you have a running local dev server, open it in a new tab and paste the URL into the browser address bar to preview.</p></main></body></html>`;
            const blob = new Blob([placeholderHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            this.blobUrls['__main__'] = url;
            this.previewFrame.src = url;
            this.hideLoadingOverlay();
            return;
        }

        // If TypeScript/JSX present and in-browser build is allowed, attempt to bundle via buildManager
        if (this.TWEAK_attemptInBrowserBuild && (hasTS || hasJSX)) {
            try {
                this.app.addConsoleMessage('info', 'Attempting in-browser compilation (esbuild-wasm) for TS/TSX/JSX sources...');
                const packageJson = files['package.json'] ? JSON.parse(files['package.json']) : null;
                const entry = await import('./buildManager.js').then(m => m.detectEntry(files));
                const buildResult = await import('./buildManager.js').then(m => m.bundleWithLock(files, entry, { sourcemap: false, minify: false, packageJson }));

                if (buildResult.warnings && buildResult.warnings.length) {
                    buildResult.warnings.forEach(w => this.app.addConsoleMessage('warn', `Build warning: ${w}`));
                }
                if (buildResult.errors && buildResult.errors.length) {
                    buildResult.errors.forEach(err => this.app.addConsoleMessage('error', `Build error: ${err}`));
                    // Render build error page inside preview iframe with logs
                    const errorHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Build Errors</title><style>body{font-family:system-ui;padding:24px;background:#fff;color:#111} pre{background:#f7f7f9;padding:12px;border-radius:6px;overflow:auto;border:1px solid #eee}</style></head><body><h1>Preview Build Failed</h1><p>In-browser bundling failed with the following error(s):</p><pre>${(buildResult.errors||[]).map(e=>String(e)).join('\n\n')}</pre><p>See the Console panel for full build logs.</p></body></html>`;
                    const eBlob = new Blob([errorHtml], { type: 'text/html' });
                    const eUrl = URL.createObjectURL(eBlob);
                    this.blobUrls['__main__'] = eUrl;
                    this.previewFrame.src = eUrl;
                    this.hideLoadingOverlay();
                    return;
                }

                if (buildResult.code && buildResult.code.length) {
                    const bundleBlob = new Blob([buildResult.code], { type: 'application/javascript' });
                    const bundleUrl = URL.createObjectURL(bundleBlob);
                    this.blobUrls['__in_memory_bundle__'] = bundleUrl;

                    let indexHtml = files['index.html'] || (`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title></head><body><div id="app"></div></body></html>`);
                    const scriptTag = `<script type="module" src="${bundleUrl}"></script>`;
                    if (!indexHtml.includes(scriptTag)) {
                        if (indexHtml.includes('</body>')) {
                            indexHtml = indexHtml.replace('</body>', `${scriptTag}\n</body>`);
                        } else {
                            indexHtml += `\n${scriptTag}\n`;
                        }
                    }

                    const finalBlob = new Blob([indexHtml], { type: 'text/html' });
                    const finalUrl = URL.createObjectURL(finalBlob);
                    this.blobUrls['__main__'] = finalUrl;

                    this.previewFrame.src = finalUrl;
                    this.hideLoadingOverlay();
                    this.app.addConsoleMessage('success', 'In-browser build succeeded and preview updated.');
                    return;
                }
            } catch (err) {
                this.app.addConsoleMessage('error', `In-browser build exception: ${err.message || err}`);
                const errorHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Build Exception</title></head><body><h1>Build Exception</h1><pre>${String(err)}</pre><p>See console for details.</p></body></html>`;
                const eBlob = new Blob([errorHtml], { type: 'text/html' });
                const eUrl = URL.createObjectURL(eBlob);
                this.blobUrls['__main__'] = eUrl;
                this.previewFrame.src = eUrl;
                this.hideLoadingOverlay();
                return;
            }
        }

        // Fallback: run normal static preview flow
        this.app.addConsoleMessage('info', 'Running standard static preview flow.');
        this.hideLoadingOverlay();
        this.updatePreviewFrameContent();
    }
}