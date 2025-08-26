export class PreviewManager {
    constructor(app) {
        this.app = app;
        this.blobUrls = {}; // Store blob URLs to revoke later
        this.currentPreviewMode = 'desktop'; // Initialize preview mode, now managed only here
        this.previewFrame = document.getElementById('previewFrame'); // Get reference
        this.previewLoadingOverlay = document.getElementById('previewLoadingOverlay'); // Get reference

        /* @tweakable List of file extensions that should NOT be executed as scripts in the preview. These files typically require a build step (e.g., transpilation). */
        this._nonExecutableScriptExtensions = ['ts', 'tsx', 'jsx', 'd.ts', 'json', 'yml', 'yaml', 'env', 'txt', 'md', 'xml', 'toml', 'ini', 'cfg', 'dockerfile', 'procfile'];
        /* @tweakable List of specific filenames (without path) that, even if they have a .js extension, should NOT be executed as scripts in the preview (e.g., Node.js config files, other non-browser JS). */
        this._nonExecutableScriptFilenames = [
            'webpack.config.js', 'rollup.config.js', 'vite.config.js', 'vite.config.ts',
            'tailwind.config.js', 'postcss.config.js', 'eslint.config.js', 'babel.config.js', 'jest.config.js',
            'package.json', 'package-lock.json', 'bun.lockb',
            'README.md', 'LICENSE', 'Dockerfile', 'Procfile',
            '.gitignore', '.eslintrc', '.prettierrc', '.editorconfig', '.gitattributes', '.npmrc', '.nvmrc',
            'deploy.yml', 'robots.txt',
            'components.json',
            'tsconfig.app.json', 'tsconfig.json', 'tsconfig.node.json'
        ];

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

    updatePreviewFrameContent() {
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

        // 3. Parse HTML content into a DOM and prepare for modifications
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
            // Warn user in console + app UI that these files need compilation
            this.app.addConsoleMessage('warn', `Preview note: ${uncompiledCandidates.length} TypeScript/JSX source file(s) detected (${uncompiledCandidates.join(', ')}). Ensure compiled .js outputs exist for them to run in the preview.`);
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
}