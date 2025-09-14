import { ChatManager } from "chatManager";
import { GitHubManager } from "githubManager";
import { PreviewManager } from "previewManager";
import { marked } from "marked";
import DOMPurify from "dompurify";

export class App {
    constructor() {
        this.currentProject = null;
        this.projects = [];
        this.conversationHistory = [];
        this.currentFiles = {};
        this.currentFile = 'index.html';
        this.currentMainPanel = 'code';
        this.currentPlayingAudio = null;
        this.activeContextMenu = null;
        this.imagePreviewOverlay = null;
        this.generatedImageUrl = null;
        this.videoPreviewOverlay = null;
        this.generatedVideoUrl = null;

        // NEW: track pinned files in current project (simple Set of filenames)
        this.pinnedFiles = new Set();

        this.puterEnabled = false;
        this.puterUser = null;
        this.currentUser = null;
        this.speechEnabled = JSON.parse(localStorage.getItem('speechEnabled') || 'true');
        this.voicePreference = localStorage.getItem('voicePreference') || 'en-female';
        this.availableVoices = [
            { id: "en-female", name: "English (Female)" },
            { id: "en-male", name: "English (Male)" },
            { id: "es-female", name: "Spanish (Female)" },
            { id: "es-male", name: "Spanish (Male)" },
            { id: "fr-female", name: "French (Female)" },
            { id: "fr-male", name: "French (Male)" },
            { id: "de-female", name: "German (Female)" },
            { id: "de-male", name: "German (Male)" },
            { id: "it-female", name: "Italian (Female)" },
            { id: "it-male", name: "Italian (Male)" },
            { id: "pt-female", name: "Portuguese (Female)" },
            { id: "pt-male", "name": "Portuguese (Male)" },
            { id: "pl-female", name: "Polish (Female)" },
            { id: "pl-male", name: "Polish (Male)" },
            { id: "tr-female", name: "Turkish (Female)" },
            { id: "tr-male", name: "Turkish (Male)" },
            { id: "ru-female", name: "Russian (Female)" },
            { id: "ru-male", name: "Russian (Male)" },
            { id: "nl-female", name: "Dutch (Female)" },
            { id: "nl-male", name: "Dutch (Male)" },
            { id: "cs-female", name: "Czech (Female)" },
            { id: "cs-male", name: "Czech (Male)" },
            { id: "ar-female", name: "Arabic (Female)" },
            { id: "ar-male", name: "Arabic (Male)" },
            { id: "zh-female", name: "Chinese (Female)" },
            { id: "zh-male", name: "Chinese (Male)" },
            { id: "hu-female", name: "Hungarian (Female)" },
            { id: "hu-male", name: "Hungarian (Male)" },
            { id: "ko-female", name: "Korean (Female)" },
            { id: "ko-male", name: "Korean (Male)" },
            { id: "hi-female", name: "Hindi (Female)" },
            { id: "hi-male", name: "Hindi (Male)" }
        ];

        // Pre-populate a curated list of selectable assistants (either Websim or Puter-hosted models).
        // Use provider id format "<backend>:<model>" where backend is "websim" or "puter".
        this.availableAIProviders = [
            { id: 'websim', name: 'Websim AI (Default)' }
        ];

        // add Puter provider option so users can select it in Settings (frontend-only if PuterService present)
        this.availableAIProviders.push({ id: 'puter:default', name: 'Puter AI (Account)' });
        this.availableAIProviders.push({ id: 'puter:kimmy-k2', name: 'Kimmy K2 (Puter)' });
        this.availableAIProviders.push({ id: 'puter:gemini-2.5-flash', name: 'Gemini 2.5 Flash (Puter)' });
        this.availableAIProviders.push({ id: 'websim:gpt5-mini', name: 'gpt5 Mini (Websim)' });
        this.availableAIProviders.push({ id: 'websim:gpt5-nano', name: 'gpt5 Nano (Websim - default)' });

        // Load persisted AI provider selection (fallback to websim:gpt5-nano)
        this.aiProvider = localStorage.getItem('aiProvider') || 'websim:gpt5-nano';
        this.aiApiKey = localStorage.getItem('aiApiKey') || '';

        this.notificationSound = new Audio();
        this.createNotificationSound();

        this.chatManager = new ChatManager(this);
        this.githubManager = new GitHubManager(this);
        this.previewManager = new PreviewManager(this);

        this.monacoEditor = null; // Monaco editor instance

        this.setupEventListeners();
        this.updateCodeEditor();
        this.renderFileTree();
        this.switchMainPanel(this.currentMainPanel);
        this.updateSpeechControlsUI();
        this.githubManager.checkGithubConnection();

        this.initCurrentUser().then(() => {
            this.initPuterStorage().then(() => {
                this.setupPuterEventListeners(); // Set up Puter sign-in button
                if (this.conversationHistory.length === 0) {
                    this.chatManager.sendInitialWelcomeMessage();
                }
            });
        });

        /* @tweakable Maximum height for images embedded in chat comments, in pixels. */
        this.maxHeightCommentImage = 300; 
        /* @tweakable Maximum width for images embedded in chat comments, in pixels. */
        this.maxWidthCommentImage = 800; 
        /* @tweakable Max size (in characters) for a file's content to be stored directly in browser's local storage. Files larger than this will have their content omitted from local storage to prevent QuotaExceededError. They will appear empty unless re-synced from GitHub or fetched from cloud storage (Puter.AI). */
        this.localStorageFileSizeLimit = 500 * 1024; 

        /* @tweakable Default entry point for the simulated build process. This file's content (and linked dependencies) will be combined into the output bundle. Note: Only pure JavaScript files (ending .js, .cjs, .mjs) are processed by this simulated build. TypeScript/JSX files are not transpiled. */
        this._webpackEntryFile = 'src/main.js'; 
        /* @tweakable Default output path and filename for the simulated build bundle. */
        this._webpackOutputBundle = 'dist/bundle.js';
        /* @tweakable The message to display when the simulated build process is complete. */
        this._buildSuccessMessage = "Simulated build complete. Check the preview to see changes from bundled files!";
        /* @tweakable The default URL to display for a simulated deployment. */
        this.mockDeploymentUrl = 'https://your-app-deployed.websim.dev';
        /* @tweakable An array of messages to cycle through for mock deployment status. */
        this.mockDeploymentStatusMessages = [
            'Initializing deployment...',
            'Building project assets...',
            'Deploying to server...',
            'Running health checks...',
            'Deployment successful!'
        ];
        /* @tweakable The duration in milliseconds for each phase of the mock deployment animation. */
        this.mockDeploymentPhaseDuration = 1500;

        /* @tweakable List of internal scripts to show in the Internal Scripts panel (path strings relative to app root) */
        this._internalScriptPaths = [
            'app.js', 'chatManager.js', 'githubManager.js', 'previewManager.js',
            'commentsManager.js', 'storageManager.js', 'uiManager.js', 'buildWorker.js',
            'utils.js', 'configParser.js', 'liveReload.js', 'settingsManager.js',
            'projectManager.js', 'fileManager.js', 'buildManager.js', 'styles.css', 'index.html', 'file1.js'
        ];

        /* @tweakable [Enable/disable sketch theme globally] */ 
        this.enableSketchTheme = true;
        /* @tweakable [Sketch stroke width in px for borders and outlines] */ 
        this.sketchStrokeWidth = 2;
        /* @tweakable [Sketch ink darkness 0..1] */ 
        this.sketchInkOpacity = 0.9;
        /* @tweakable [X/Y offset for hand-drawn feel] */ 
        this.sketchOffset = { x: 1, y: 1 };
        /* @tweakable [Tilt in degrees for subtle hand-drawn tilt] */ 
        this.sketchTiltDegrees = 0.35;
        /* @tweakable [Primary accent color (blue) for sketch highlights] */ 
        this.sketchPrimary = '#2563EB';
        /* @tweakable [Accent yellow color] */ 
        this.sketchAccentYellow = '#F5C400';

        this.reasoningMode = 'casual';

        this.applySketchVars();
    }

    async initCurrentUser() {
        try {
            this.currentUser = await window.websim.getCurrentUser();
            this.addConsoleMessage('info', `Websim user detected: ${this.currentUser.username} (ID: ${this.currentUser.id})`);
            this.updateAccountInfoUI();
        } catch (error) {
            this.addConsoleMessage('error', `Failed to get current Websim user: ${error.message}.`);
            console.error('Websim getCurrentUser error:', error);
        }
    }

    async initPuterStorage() {
        try {
            // Wait for Puter SDK to load
            let retries = 0;
            while (!window.Puter && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                retries++;
            }
            
            if (window.Puter) {
                this.addConsoleMessage('info', 'Puter.AI SDK detected. Attempting to connect to cloud storage...');
                await Puter.init();
                
                // Check if user is already signed in
                try {
                    this.puterUser = await Puter.identity.whoami();
                    this.puterEnabled = true;
                    this.addConsoleMessage('success', `Puter.AI cloud storage connected for user: ${this.puterUser.username}. Projects will be saved to the cloud.`);
                    this.updatePuterStatusUI();
                    this.updateAccountInfoUI();
                } catch (whoamiError) {
                    // User not signed in yet
                    this.addConsoleMessage('info', 'Puter.AI SDK ready but user not signed in. Click "Sign In to Puter" to connect.');
                    this.updatePuterStatusUI();
                }

                this.addConsoleMessage('info', 'Note: Your DevSpark AI account is automatically linked to your Websim/Puter.AI session. No separate signup/login is required for these platform features.');

                const localStorageProjects = this._loadProjectsFromLocal();
                let puterProjects = [];
                try {
                    puterProjects = await this._loadProjectsFromPuter();
                } catch (error) {
                    this.addConsoleMessage('warn', `Could not load projects from Puter.AI initially: ${error.message}. Checking local storage.`);
                }

                if (localStorageProjects.length > 0 && (!puterProjects || puterProjects.length === 0)) {
                    this.addConsoleMessage('info', 'Local projects found. Migrating projects from local storage to Puter.AI cloud storage...');
                    this.projects = localStorageProjects;
                    await this._saveProjectsToPuter();
                    localStorage.removeItem('projects');
                    this.addConsoleMessage('success', 'Projects migrated to Puter.AI cloud storage successfully!');
                } else {
                    this.projects = puterProjects;
                    if (puterProjects.length > 0) {
                        this.addConsoleMessage('info', 'Projects loaded from Puter.AI cloud storage.');
                    } else if (localStorageProjects.length > 0) {
                        this.addConsoleMessage('warn', 'No projects found in Puter.AI cloud, but local projects exist. Loading from local storage. These projects will NOT sync to the cloud unless explicitly saved to Puter.AI later. Puter.AI cloud storage will show as disconnected for this session.');
                    } else {
                        this.addConsoleMessage('info', 'No projects found in Puter.AI or local storage.');
                    }
                }
            } else {
                this.addConsoleMessage('error', 'Puter.AI SDK not found (window.Puter is undefined). Cloud storage features are unavailable. Using local storage for projects.');
                this.puterEnabled = false;
            }

            if (this.projects.length === 0) {
                this.addConsoleMessage('info', 'No projects exist. Creating a default "My First Project".');
                await this.createNewProject('My First Project', 'A new project for web development.');
            } else if (!this.currentProject || !this.projects.some(p => p.id === this.currentProject.id)) {
                this.addConsoleMessage('info', `Loading the first available project: "${this.projects[0].name}".`);
                await this.loadProject(this.projects[0]);
    }

    // Set up Puter sign-in/sign-out event listeners
    setupPuterEventListeners() {
        const signInBtn = document.getElementById('puterOptionsSignInBtn');
        const signOutBtn = document.getElementById('puterOptionsSignOutBtn');
        const storageInfoBtn = document.getElementById('puterOptionsStorageInfoBtn');

        if (signInBtn) {
            signInBtn.addEventListener('click', async () => {
                try {
                    signInBtn.disabled = true;
                    signInBtn.textContent = 'Signing in...';
                    
                    if (window.Puter && Puter.auth) {
                        // This should trigger the Puter sign-in popup
                        this.puterUser = await Puter.auth.signIn();
                        this.puterEnabled = true;
                        this.addConsoleMessage('success', `Successfully signed in to Puter.AI as: ${this.puterUser.username}`);
                        this.updatePuterStatusUI();
                        this.updateAccountInfoUI();
                        
                        // Try to load projects from Puter cloud
                        await this.loadProjects();
                    } else {
                        throw new Error('Puter SDK not available');
                    }
                } catch (error) {
                    console.error('Puter sign-in error:', error);
                    this.addConsoleMessage('error', `Failed to sign in to Puter.AI: ${error.message}`);
                } finally {
                    signInBtn.disabled = false;
                    signInBtn.textContent = 'Sign In to Puter';
                }
            });
        }

        if (signOutBtn) {
            signOutBtn.addEventListener('click', async () => {
                try {
                    if (window.Puter && Puter.auth) {
                        await Puter.auth.signOut();
                    }
                    this.puterUser = null;
                    this.puterEnabled = false;
                    this.addConsoleMessage('info', 'Signed out from Puter.AI');
                    this.updatePuterStatusUI();
                    this.updateAccountInfoUI();
                } catch (error) {
                    console.error('Puter sign-out error:', error);
                    this.addConsoleMessage('error', `Failed to sign out: ${error.message}`);
                }
            });
        }

        if (storageInfoBtn) {
            storageInfoBtn.addEventListener('click', async () => {
                try {
                    if (this.puterEnabled && window.Puter) {
                        const usage = await Puter.fs.usage();
                        const userInfo = this.puterUser || await Puter.identity.whoami();
                        
                        const info = `
**Puter.AI Storage Info:**
- User: ${userInfo.username}
- Used: ${(usage.used / 1024 / 1024).toFixed(2)} MB
- Available: ${(usage.available / 1024 / 1024).toFixed(2)} MB
- Total: ${((usage.used + usage.available) / 1024 / 1024).toFixed(2)} MB`;
                        
                        this.addConsoleMessage('info', info);
                    } else {
                        this.addConsoleMessage('warn', 'Puter.AI not connected. Please sign in first.');
                    }
                } catch (error) {
                    console.error('Storage info error:', error);
                    this.addConsoleMessage('error', `Failed to get storage info: ${error.message}`);
                }
            });
        }
    }
            this._renderProjectListUI();
        } catch (error) {
            this.addConsoleMessage('error', `Failed to initialize Puter.AI cloud storage: ${error.message}. Cloud storage features are unavailable. Falling back to local storage.`);
            console.error('Puter.AI init error:', error);
            this.puterEnabled = false;
            this.projects = this._loadProjectsFromLocal();
            if (this.projects.length === 0) {
                this.addConsoleMessage('info', 'No local projects. Creating a default "My First Project".');
                await this.createNewProject('My First Project', 'A fresh start!');
            } else if (!this.currentProject || !this.projects.some(p => p.id === this.currentProject.id)) {
                this.addConsoleMessage('info', `Loading project from local storage: "${this.projects[0].name}".`);
                await this.loadProject(this.projects[0]);
            }
            this._renderProjectListUI();
        }
        this.updatePuterStatusUI();
    }

    updatePuterStatusUI() {
        // Update main status display
        const statusDiv = document.getElementById('cloudStorageStatus');
        if (statusDiv) {
            if (this.puterEnabled && this.puterUser) {
                statusDiv.textContent = `Cloud Storage: Connected (Puter.AI - ${this.puterUser.username})`;
                statusDiv.className = 'cloud-storage-status connected';
            } else if (window.Puter) {
                statusDiv.textContent = 'Cloud Storage: Ready (Puter.AI - Click sign in)';
                statusDiv.className = 'cloud-storage-status disconnected';
            } else {
                statusDiv.textContent = 'Cloud Storage: Local (Puter.AI not available)';
                statusDiv.className = 'cloud-storage-status disconnected';
            }
        }
        
        // Update settings modal buttons
        const accountStatus = document.getElementById('puterAccountStatus');
        const signInBtn = document.getElementById('puterOptionsSignInBtn');
        const signOutBtn = document.getElementById('puterOptionsSignOutBtn');
        const storageInfoBtn = document.getElementById('puterOptionsStorageInfoBtn');
        const accountDetails = document.getElementById('puterAccountDetails');
        
        if (accountStatus) {
            if (this.puterEnabled && this.puterUser) {
                accountStatus.textContent = `Connected as: ${this.puterUser.username}`;
                accountStatus.style.color = 'var(--color-success)';
            } else if (window.Puter) {
                accountStatus.textContent = 'Puter SDK ready - Not signed in';
                accountStatus.style.color = 'var(--color-warning)';
            } else {
                accountStatus.textContent = 'Puter SDK not available';
                accountStatus.style.color = 'var(--color-error)';
            }
        }
        
        if (signInBtn && signOutBtn) {
            if (this.puterEnabled && this.puterUser) {
                signInBtn.style.display = 'none';
                signOutBtn.style.display = 'inline-block';
            } else {
                signInBtn.style.display = 'inline-block';
                signOutBtn.style.display = 'none';
            }
        }
        
        if (accountDetails) {
            if (this.puterEnabled && this.puterUser) {
                accountDetails.style.display = 'block';
                accountDetails.innerHTML = `
                    <strong>Account:</strong> ${this.puterUser.username}<br>
                    <strong>User ID:</strong> ${this.puterUser.id || 'N/A'}<br>
                    <strong>Email:</strong> ${this.puterUser.email || 'N/A'}
                `;
            } else {
                accountDetails.style.display = 'none';
            }
        }
    }

    setupEventListeners() {
        this.imagePreviewOverlay = document.getElementById('imagePreviewOverlay');
        this.videoPreviewOverlay = document.getElementById('videoPreviewOverlay');

        document.getElementById('sendBtn').addEventListener('click', () => this.chatManager.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.chatManager.sendMessage();
            }
        });

        document.getElementById('newProjectBtn').addEventListener('click', () => this.createNewProject());

        document.getElementById('githubBtn').addEventListener('click', () => this.githubManager.showGithubModal());
        document.getElementById('connectGithubBtn').addEventListener('click', () => this.githubManager.connectGithub());
        document.getElementById('syncBtn').addEventListener('click', () => this.githubManager.syncToGithub());
        // Small, non-breaking enhancement: create a local checkpoint snapshot for the current project
        document.getElementById('checkpointBtn')?.addEventListener('click', () => this.createCheckpoint());

        document.getElementById('previewBtn').addEventListener('click', () => this.previewManager.showPreview());
        // New: build & preview button triggers a (safe) in-browser build pipeline
        /* @tweakable [Label for the build button shown inside the Preview modal] */
        this.buildButtonLabel = 'Build & Compile';
        // Wire Build button inside the Preview modal to trigger an in-browser compile/bundle
        document.getElementById('buildCompileBtn')?.addEventListener('click', () => this.previewManager.buildAndPreview());
        // Keep the legacy hidden button in-place for backward compatibility but update its text (hidden)
        const legacyBuildBtn = document.getElementById('buildPreviewBtn');
        if (legacyBuildBtn) { legacyBuildBtn.textContent = this.buildButtonLabel; legacyBuildBtn.title = this.buildButtonLabel; }

        document.getElementById('closePreviewBtn').addEventListener('click', () => this.previewManager.hidePreview());

        document.getElementById('refreshPreviewBtn').addEventListener('click', () => this.refreshPreview());
        document.getElementById('openNewWindowBtn').addEventListener('click', () => this.openPreviewInNewWindow());
        document.getElementById('fullscreenPreviewBtn').addEventListener('click', () => this.toggleFullscreenPreview());

        document.getElementById('desktopPreviewBtn').addEventListener('click', () => this.previewManager.setPreviewMode('desktop'));
        document.getElementById('tabletPreviewBtn').addEventListener('click', () => this.previewManager.setPreviewMode('tablet'));
        document.getElementById('mobilePreviewBtn').addEventListener('click', () => this.previewManager.setPreviewMode('mobile'));

        document.getElementById('closeGithubModal').addEventListener('click', () => this.githubManager.hideGithubModal());

        document.getElementById('optionsBtn').addEventListener('click', () => this.showOptionsModal());
        document.getElementById('closeOptionsModal').addEventListener('click', () => this.hideOptionsModal());

        document.getElementById('mainPanelTabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('panel-tab')) {
                this.switchMainPanel(e.target.dataset.panel);
            }
        });

        document.getElementById('addFileBtnSidebar').addEventListener('click', () => this.addFile());
        document.getElementById('uploadFileBtnSidebar').addEventListener('click', () => this.uploadFile());

        document.getElementById('fileTreeContainer').addEventListener('click', (e) => {
            const target = e.target;

            // Toggle "more" menu
            const moreBtn = target.closest('.file-more-btn');
            if (moreBtn) {
                e.stopPropagation();
                const file = moreBtn.dataset.file;
                const item = moreBtn.closest('.tree-file-item');
                const menu = item.querySelector('.more-menu');
                // Close any open menus first
                document.querySelectorAll('.more-menu').forEach(m => { if (m !== menu) m.style.display = 'none'; m?.closest('.tree-file-item')?.classList?.remove('more-open'); });
                // Position menu under button and toggle
                if (menu.style.display === 'flex' || menu.style.display === 'block') {
                    menu.style.display = 'none';
                    item.classList.remove('more-open'); // hide state
                } else {
                    menu.style.display = 'flex';
                    menu.style.flexDirection = 'column';
                    // Position menu using button viewport position so it aligns with the clicked 3-dots.
                    // Use getBoundingClientRect and account for page scroll so menu appears next to the button reliably.
                    const rect = moreBtn.getBoundingClientRect();
                    const computedTop = rect.bottom + window.scrollY + 6; // small gap below the button
                    const computedLeft = Math.max(8, rect.left + window.scrollX); // align left edge to button (clamped)
                    menu.style.top = `${computedTop}px`;
                    menu.style.left = `${computedLeft}px`;
                    // Constrain menu width so it doesn't become unexpectedly very wide
                    menu.style.minWidth = '140px';
                    menu.style.maxWidth = '320px';
                    item.classList.add('more-open'); // show state so button stays visible
                }
                return;
            }

            // Handle clicks on items inside the more-menu
            const moreItem = target.closest('.more-menu-item');
            if (moreItem) {
                e.stopPropagation();
                const action = moreItem.dataset.action;
                const filename = moreItem.dataset.file;
                // hide menus
                document.querySelectorAll('.more-menu').forEach(m => m.style.display = 'none');

                switch (action) {
                    case 'open':
                        this.switchFile(filename);
                        break;
                    case 'preview':
                        {
                            // If media URL, open appropriate overlay; otherwise select file and open full preview modal
                            const fileContent = this.currentFiles[filename];
                            if (filename.match(/\.(png|jpe?g|gif|svg|webp|ico|avif)$/i) && typeof fileContent === 'string' && (fileContent.startsWith('http://') || fileContent.startsWith('https://'))) {
                                this.generatedImageUrl = fileContent;
                                this.showImagePreviewOverlay();
                            } else if (filename.match(/\.(mp4|webm|ogg|mov)$/i) && typeof fileContent === 'string' && (fileContent.startsWith('http://') || fileContent.startsWith('https://'))) {
                                this.generatedVideoUrl = fileContent;
                                this.showVideoPreviewOverlay();
                            } else {
                                // Open file in editor then show the Live Preview modal (so user sees that file in context)
                                this.switchFile(filename);
                                this.previewManager.showPreview();
                            }
                        }
                        break;
                    case 'download':
                        {
                            const fileContent = this.currentFiles[filename];
                            const mimeType = this.previewManager.getFileMimeType(filename);
                            const urlToDownload = (typeof fileContent === 'string' && (fileContent.startsWith('http://') || fileContent.startsWith('https://')))
                                                 ? fileContent
                                                 : URL.createObjectURL(new Blob([fileContent || ''], { type: mimeType }));
                            this.downloadFile(urlToDownload, filename);
                        }
                        break;
                    case 'rename':
                        this.renameFile(filename);
                        break;
                    case 'delete':
                        this.deleteFile(filename);
                        break;
                    case 'pin':
                        // Toggle pin state for file
                        if (this.pinnedFiles.has(filename)) {
                            this.pinnedFiles.delete(filename);
                            this.addConsoleMessage('info', `Unpinned ${filename}`);
                            this.showTemporaryFeedback(`Unpinned ${filename}`, 'info');
                        } else {
                            this.pinnedFiles.add(filename);
                            this.addConsoleMessage('info', `Pinned ${filename}`);
                            this.showTemporaryFeedback(`Pinned ${filename}`, 'success');
                        }
                        this.renderFileTree();
                        break;
                    case 'mention':
                        // Ask ChatManager to analyze / mention this specific file
                        if (this.chatManager && typeof this.chatManager.analyzeFile === 'function') {
                            this.chatManager.analyzeFile(filename);
                        } else {
                            // Fallback: post a simple assistant message summarizing first lines
                            const content = this.currentFiles[filename] || '';
                            const snippet = content.slice(0, 800);
                            this.addMessage('assistant', `Quick summary for ${filename}:\n\n\`\`\`\n${snippet}\n\`\`\`\n(Truncated)`);
                        }
                        break;
                }
                return;
            }

            // If click elsewhere, close any open more menus
            document.querySelectorAll('.more-menu').forEach(m => { m.style.display = 'none'; m.closest('.tree-file-item')?.classList?.remove('more-open'); });

            const deleteBtn = target.closest('.delete-file-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const filename = deleteBtn.dataset.file;
                this.deleteFile(filename);
                return;
            }

            const renameBtn = target.closest('.rename-file-btn');
            if (renameBtn) {
                e.stopPropagation();
                const filename = renameBtn.dataset.file;
                this.renameFile(filename);
                return;
            }

            const downloadBtn = target.closest('.download-file-btn');
            if (downloadBtn) {
                e.stopPropagation();
                const filename = downloadBtn.dataset.file;
                const fileContent = this.currentFiles[filename];
                const mimeType = this.previewManager.getFileMimeType(filename);
                const urlToDownload = (typeof fileContent === 'string' && (fileContent.startsWith('http://') || fileContent.startsWith('https://')))
                                     ? fileContent
                                     : URL.createObjectURL(new Blob([fileContent || ''], { type: mimeType })); 
                this.downloadFile(urlToDownload, filename);
                return;
            }

            const fileItemDiv = target.closest('.tree-file-item');
            if (fileItemDiv) {
                const filename = fileItemDiv.dataset.file;
                const fileContent = this.currentFiles[filename];

                const isMediaFileByExtension = filename.match(/\.(png|jpe?g|gif|svg|mp4|webm|ogg|mov|webp|ico|avif)$/i);

                if (isMediaFileByExtension && typeof fileContent === 'string' && (fileContent.startsWith('http://') || fileContent.startsWith('https://'))) {
                    if (filename.match(/\.(png|jpe?g|gif|svg|webp|ico|avif)$/i)) {
                        this.generatedImageUrl = fileContent;
                        this.showImagePreviewOverlay();
                    } else if (filename.match(/\.(mp4|webm|ogg|mov)$/i)) {
                        this.generatedVideoUrl = fileContent;
                        this.showVideoPreviewOverlay();
                    }
                    return;
                }

                const fileNameSpan = target.closest('.file-name');
                if (fileNameSpan || target === fileItemDiv) {
                    this.switchFile(filename);
                }
                return;
            }
        });

        // Accessibility: allow keyboard activation of the 3-dot file menu (Enter / Space)
        document.getElementById('fileTreeContainer').addEventListener('keydown', (e) => {
            const btn = e.target.closest?.('.file-more-btn');
            if (!btn) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });

        document.getElementById('projectList').addEventListener('click', async (e) => {
            const renameBtn = e.target.closest('.rename-project-btn');
            const deleteBtn = e.target.closest('.delete-project-btn');
            const projectItem = e.target.closest('.project-item');

            if (!projectItem) return;

            const projectId = projectItem.dataset.projectId;

            if (renameBtn) {
                e.stopPropagation();
                await this.renameProject(projectId);
            } else if (deleteBtn) {
                e.stopPropagation();
                await this.deleteProjectEntry(projectId);
            }
        });

        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('speaker-icon') || e.target.closest('.speaker-icon')) {
                const speakerBtn = e.target.closest('.speaker-icon');
                const messageText = speakerBtn.dataset.messageContent;
                const originalVoice = speakerBtn.dataset.originalVoice;

                let audioUrl = speakerBtn.dataset.audioUrl;

                if (!audioUrl || originalVoice !== this.voicePreference) {
                    this.addConsoleMessage('debug', `Regenerating audio for message using voice: ${this.voicePreference}`);
                    try {
                        const speechResult = await websim.textToSpeech({
                            text: messageText,
                            voice: this.voicePreference
                        });
                        audioUrl = speechResult.url;
                        speakerBtn.dataset.audioUrl = audioUrl;
                        speakerBtn.dataset.originalVoice = this.voicePreference;
                    } catch (speechError) {
                        console.error("Error regenerating text-to-speech:", speechError);
                        this.addConsoleMessage('error', 'Failed to generate speech for welcome message.');
                        return;
                    }
                }

                if (this.currentPlayingAudio) {
                    this.currentPlayingAudio.pause();
                    this.currentPlayingAudio.currentTime = 0;
                    this.currentPlayingAudio = null;
                }

                if (audioUrl) {
                    const audio = new Audio(audioUrl);
                    this.currentPlayingAudio = audio;

                    audio.play().catch(err => console.error("Error auto-playing audio:", err));

                    audio.onended = () => {
                        if (this.currentPlayingAudio === audio) {
                            this.currentPlayingAudio = null;
                        }
                    };
                }
            } else if (e.target.classList.contains('more-actions-btn') || e.target.closest('.more-actions-btn')) {
                const moreActionsBtn = e.target.closest('.more-actions-btn');
                const messageText = moreActionsBtn.closest('.message-content').dataset.rawContent;
                if (messageText) {
                    this.openContextMenu(moreActionsBtn, messageText);
                } else {
                    this.addConsoleMessage('warn', 'Could not retrieve message content for context menu.');
                }
                e.stopPropagation();
            } else if (this.activeContextMenu && !this.activeContextMenu.contains(e.target)) {
                this.closeContextMenu();
            } else if (e.target.classList.contains('view-image-button') || e.target.closest('.view-image-button')) {
                const viewImageBtn = e.target.closest('.view-image-button');
                const imageUrl = viewImageBtn.dataset.imageUrl;

                if (imageUrl) {
                    this.generatedImageUrl = imageUrl;
                    this.showImagePreviewOverlay();
                }
            } else if (e.target.classList.contains('view-video-button') || e.target.closest('.view-video-button')) {
                const viewVideoBtn = e.target.closest('.view-video-button');
                const videoUrl = viewVideoBtn.dataset.videoUrl;

                if (videoUrl) {
                    this.generatedVideoUrl = videoUrl;
                    this.showVideoPreviewOverlay();
                }
            }
        });

        // Close any open ".more-menu" when pressing Escape for accessibility/quick dismiss
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.more-menu').forEach(m => { m.style.display = 'none'; m.closest('.tree-file-item')?.classList?.remove('more-open'); });
                this.closeContextMenu();
            }
        });

        // Reposition any visible ".more-menu" on window resize/scroll to stay aligned with their buttons
        const repositionOpenMenus = () => {
            document.querySelectorAll('.tree-file-item.more-open').forEach(item => {
                const moreBtn = item.querySelector('.file-more-btn');
                const menu = item.querySelector('.more-menu');
                if (moreBtn && menu && (menu.style.display === 'flex' || menu.style.display === 'block')) {
                    const rect = moreBtn.getBoundingClientRect();
                    const computedTop = rect.bottom + window.scrollY + 6;
                    const computedLeft = Math.max(8, rect.left + window.scrollX);
                    menu.style.top = `${computedTop}px`;
                    menu.style.left = `${computedLeft}px`;
                }
            });
        };
        window.addEventListener('resize', repositionOpenMenus);
        window.addEventListener('scroll', repositionOpenMenus, true);

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'console-log') {
                this.addConsoleMessage(event.data.data.method, event.data.data.message);
            }
        });

        const speechToggle = document.getElementById('speechToggle');
        const voiceSelect = document.getElementById('voiceSelect');
        if (speechToggle) speechToggle.addEventListener('change', (e) => this.toggleSpeech(e.target.checked));
        if (voiceSelect) voiceSelect.addEventListener('change', (e) => this.selectVoice(e.target.value));

        const aiProviderSelect = document.getElementById('aiProviderSelect');
        const aiApiKeyInput = document.getElementById('aiApiKeyInput');
        if (aiProviderSelect) aiProviderSelect.addEventListener('change', (e) => this.selectAIProvider(e.target.value));
        if (aiApiKeyInput) aiApiKeyInput.addEventListener('input', (e) => this.setAIApiKey(e.target.value));

        // Reasonings panel controls
        const reasoningSelect = document.getElementById('reasoningModeSelect');
        const toggleReasoningBtn = document.getElementById('toggleReasoningBtn');
        if (reasoningSelect) {
            reasoningSelect.value = this.reasoningMode || 'casual';
            reasoningSelect.addEventListener('change', (e) => {
                this.reasoningMode = e.target.value;
                this.addConsoleMessage('info', `Response mode set to: ${this.reasoningMode}`);
            });
        }
        if (toggleReasoningBtn) {
            toggleReasoningBtn.addEventListener('click', () => {
                const panel = document.getElementById('reasoningsPanel');
                panel.classList.toggle('collapsed');
            });
        }

        document.getElementById('clearUserDataBtn').addEventListener('click', () => this.clearUserDataAndRestart());

        document.getElementById('closeImagePreviewBtn').addEventListener('click', () => this.hideImagePreviewOverlay());
        document.getElementById('saveImageBtn').addEventListener('click', () => this.downloadFile(this.generatedImageUrl, 'generated_image.png'));

        document.getElementById('closeVideoPreviewBtn').addEventListener('click', () => this.hideVideoPreviewOverlay());
        document.getElementById('saveVideoBtn').addEventListener('click', () => this.downloadFile(this.generatedVideoUrl, 'generated_video.mp4'));

        document.getElementById('refreshEditorScriptsBtn')?.addEventListener('click', () => this.populateEditorScriptSelect());
        document.getElementById('editorScriptSelect')?.addEventListener('change', (e) => {
            if (e.target.value) this.switchFile(e.target.value);
        });

        // Console panel controls
        document.getElementById('refreshConsoleTargetsBtn')?.addEventListener('click', () => this.populateConsoleScriptSelect());
        document.getElementById('consoleScriptSelect')?.addEventListener('change', (e) => {
            // When selecting a console target, focus console and optionally show its source in editor
            const target = e.target.value;
            if (target && this.currentFiles[target]) {
                // show file in editor for quick inspection but do not change currentFile unless user clicks
                const editorPreview = document.getElementById('codeTextarea');
                if (editorPreview && !this.monacoEditor) editorPreview.value = this.currentFiles[target];
                // add a console info line
                this.addConsoleMessage('info', `Selected console target: ${target}`);
            }
        });
        document.getElementById('clearConsoleBtn')?.addEventListener('click', () => {
            const consoleOutput = document.getElementById('consoleOutput');
            if (consoleOutput) consoleOutput.innerHTML = '<div class="console-line log">Console cleared</div>';
        });
        document.getElementById('exportConsoleBtn')?.addEventListener('click', () => {
            const consoleOutput = document.getElementById('consoleOutput');
            if (!consoleOutput) return;
            const text = Array.from(consoleOutput.querySelectorAll('.console-line')).map(n => n.textContent).join('\n');
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `console-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            this.showTemporaryFeedback('Console exported', 'success');
        });

        // Hook into send to update reasoning panel first, then type assistant response
        const originalSend = this.chatManager.sendMessage.bind(this.chatManager);
        this.chatManager.sendMessage = async () => {
            const inputEl = document.getElementById('messageInput');
            const userMessage = (inputEl && inputEl.value) ? inputEl.value.trim() : '';
            if (!userMessage) return;

            // Show thinking animation in reasonings panel
            this.showReasoningThinking(true);
            // Generate a structured reasoning skeleton immediately
            const initialReasoning = this.generateStubReasoning(userMessage);
            this.updateReasoningPanel(initialReasoning);

            // Call original to drive AI pipeline (it will call websim). We intercept final assistant display later.
            await originalSend();
            // originalSend will eventually call app.addMessage for assistant; we rely on chat manager / app flow to add
            // To ensure typing effect, apps that call addMessage for assistant should now call typeAssistantResponse.
        };
    }

    addMessage(role, content, audioUrl = null, is_loading_message = false, imageUrl = null, videoUrl = null) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const avatarImg = document.createElement('img');
        avatarImg.className = 'message-avatar';
        avatarImg.alt = `${role} avatar`;
        if (role === 'user' && this.currentUser && this.currentUser.avatar_url) {
            avatarImg.src = this.currentUser.avatar_url;
        } else if (role === 'assistant') {
            avatarImg.src = 'https://s3.us-west-2.amazonaws.com/s.cdpn.io/332152/ai-avatar.png'; 
        } else {
            avatarImg.src = 'https://www.gravatar.com/avatar/?d=retro'; 
        }
        messageDiv.appendChild(avatarImg);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content-wrapper';
        messageDiv.appendChild(contentWrapper);

        const headerInfo = document.createElement('div');
        headerInfo.className = 'message-header-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = role === 'user' ? (this.currentUser?.username || 'You') : 'AI Assistant';
        headerInfo.appendChild(nameSpan);

        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        headerInfo.appendChild(timestampSpan);
        contentWrapper.appendChild(headerInfo);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.dataset.rawContent = content; 
        contentWrapper.appendChild(contentDiv);

        if (is_loading_message) {
            contentDiv.innerHTML = `
                <p class="ai-status-message"></p>
                <div class="loading-animation-container"></div>
            `;
            messageDiv.classList.add('loading-message');
        } else {
            const renderedHtml = DOMPurify.sanitize(marked.parse(content));
            contentDiv.innerHTML = renderedHtml;

            contentDiv.querySelectorAll('pre code').forEach(codeBlock => {
                const copyButton = document.createElement('button');
                copyButton.className = 'copy-code-btn';
                copyButton.textContent = 'Copy Code';
                copyButton.addEventListener('click', () => {
                    navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                        this.showTemporaryFeedback('Code copied!');
                    }).catch(err => {
                        this.addConsoleMessage('error', 'Failed to copy code: ' + err);
                    });
                });
                codeBlock.parentNode.insertBefore(copyButton, codeBlock);
            });

            if (imageUrl) {
                const imgElement = document.createElement('img');
                imgElement.src = imageUrl;
                imgElement.alt = "Generated Image";
                imgElement.className = 'message-image';
                contentDiv.appendChild(imgElement);

                const viewSaveBtn = document.createElement('button');
                viewSaveBtn.className = 'btn btn-secondary btn-sm view-image-button';
                viewSaveBtn.textContent = 'View Full / Save Image';
                viewSaveBtn.dataset.imageUrl = imageUrl;
                contentDiv.appendChild(viewSaveBtn);
            } else if (videoUrl) {
                const videoElement = document.createElement('video');
                videoElement.src = videoUrl;
                videoElement.controls = true;
                videoElement.loop = true;
                videoElement.muted = true;
                videoElement.autoplay = true;
                videoElement.playsInline = true;
                videoElement.className = 'message-video';
                contentDiv.appendChild(videoElement);

                const viewSaveBtn = document.createElement('button');
                viewSaveBtn.className = 'btn btn-secondary btn-sm view-video-button';
                viewSaveBtn.textContent = 'View Full / Save Video';
                viewSaveBtn.dataset.videoUrl = videoUrl;
                contentDiv.appendChild(viewSaveBtn);
            }

            if (role === 'assistant') {
                this.playNotificationSound();
            }
        }

        const messageActionsDiv = document.createElement('div');
        messageActionsDiv.className = 'message-actions';

        if (role === 'assistant') {
            const speakerIcon = document.createElement('button');
            speakerIcon.className = 'speaker-icon mic-icon';
            speakerIcon.title = 'Listen to response';
            speakerIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-mic-fill" viewBox="0 0 16 16">
                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-2 2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2h6a2 2 0 0 0 2 2v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4h-.5a1 1 0 0 0-1 1V2a1 1 0 0 0 1-1h12z"/>
                </svg>
            `;
            speakerIcon.dataset.messageContent = content; 
            speakerIcon.dataset.originalVoice = this.voicePreference;
            if (audioUrl) {
                speakerIcon.dataset.audioUrl = audioUrl;
            }
            messageActionsDiv.appendChild(speakerIcon);
        }

        const moreActionsBtn = document.createElement('button');
        messageActionsDiv.appendChild(moreActionsBtn);

        contentDiv.appendChild(messageActionsDiv); 

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // If assistant message and not loading, perform typing effect instead of instant append of text
        if (role === 'assistant' && !is_loading_message) {
            // replace content area with typing animation and stream the content
            this.typeAssistantResponse(messageDiv, content, audioUrl);
        }

        return messageDiv;
    }

    addConsoleMessage(type, message) {
        const consoleOutput = document.getElementById('consoleOutput');
        const consoleLine = document.createElement('div');
        consoleLine.className = `console-line ${type}`;

        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        consoleLine.textContent = `[${timestamp}] ${message}`;

        consoleOutput.appendChild(consoleLine);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    async switchMainPanel(panelName) {
        this.currentMainPanel = panelName;

        document.querySelectorAll('#mainPanelTabs .panel-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.panel === panelName);
        });

        document.querySelectorAll('.editor-console-panel .panel-content').forEach(content => {
            content.classList.remove('active');
        });

        const panelIdMap = {
            'devLog': 'devLogPanelContent',
            'internalScripts': 'devLogPanelContent'
        };

        const targetId = panelIdMap[panelName] || `${panelName}PanelContent`;
        const targetPanelContent = document.getElementById(targetId);
        if (targetPanelContent) {
            targetPanelContent.classList.add('active');
        } else {
            this.addConsoleMessage('warn', `Panel '${panelName}' content element not found; skipping activation.`);
            console.warn(`Panel content for ${panelName} not found. Ensure HTML element with id '${targetId}' exists.`);
            return;
        }

        if (panelName === 'internalScripts') {
            await this.loadInternalScriptsContent();
        } else if (panelName === 'devLog') {
            await this.loadInternalScriptsContent();
        } else if (panelName === 'deploy') {
            await this.loadDeploymentInfo();
        }
    }

    async loadInternalScriptsContent() {
        try {
            const container = document.getElementById('devLogContent');
            if (!container) {
                this.addConsoleMessage('error', 'Internal Scripts content container not found.');
                return;
            }

            container.innerHTML = `
                <div class="devlog-container" style="display:flex;flex-direction:column;gap:var(--spacing-md);">
                    <div style="display:flex;gap:var(--spacing-md);align-items:center;">
                        <label for="internalScriptSelect" style="font-weight:600;color:var(--color-text-dark);">Scripts</label>
                        <select id="internalScriptSelect" class="form-select" style="flex:1;"></select>
                        <button id="refreshInternalScriptsBtn" class="btn btn-secondary btn-sm" title="Refresh list">Refresh</button>
                    </div>
                    <div id="devlogScriptInfo" style="color:var(--color-text-medium);font-size:13px;">Select a script to view its content (fetched on demand).</div>
                    <div id="internalScriptEditorWrap" style="display:flex;flex-direction:column;gap:var(--spacing-sm);">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <div id="internalScriptMeta" style="font-size:13px;color:var(--color-text-medium)"></div>
                            <div style="display:flex;gap:8px;">
                                <button id="internalScriptRefreshBtn" class="btn btn-secondary btn-sm">Refresh</button>
                                <button id="internalScriptSaveBtn" class="btn btn-primary btn-sm">Save</button>
                            </div>
                        </div>
                        <textarea id="internalScriptEditor" class="devlog-code" style="width:100%;height:60vh;padding:var(--spacing-md);"></textarea>
                    </div>
                </div>
            `;

            const selectEl = document.getElementById('internalScriptSelect');
            const infoEl = document.getElementById('devlogScriptInfo');
            const codePre = document.getElementById('devlogCodeBlock');
            const refreshBtn = document.getElementById('refreshInternalScriptsBtn');

            const editor = document.getElementById('internalScriptEditor');
            const editorMeta = document.getElementById('internalScriptMeta');
            const editorSaveBtn = document.getElementById('internalScriptSaveBtn');
            const editorRefreshBtn = document.getElementById('internalScriptRefreshBtn');

            const scripts = Array.isArray(this._internalScriptPaths) && this._internalScriptPaths.length
                ? this._internalScriptPaths
                : ['app.js','chatManager.js','githubManager.js','previewManager.js','fileManager.js','buildManager.js','commentsManager.js','styles.css','index.html','utils.js','buildWorker.js','projectManager.js'];

            selectEl.innerHTML = '';
            scripts.forEach(path => {
                const opt = document.createElement('option');
                opt.value = path;
                opt.textContent = path;
                selectEl.appendChild(opt);
            });

            // Fetch file text and populate editor (on demand)
            const fetchAndPopulateEditor = async (path) => {
                if (!path) return;
                infoEl.textContent = `Loading ${path}...`;
                editor.value = '';
                editorMeta.textContent = `Loading ${path}...`;
                try {
                    const resp = await fetch(path, { cache: 'no-store' });
                    if (!resp.ok) {
                        editor.value = `Could not load ${path}: ${resp.status} ${resp.statusText}`;
                        editorMeta.textContent = `Failed to load ${path}`;
                        this.addConsoleMessage('warn', `Internal Scripts: Could not fetch ${path} (${resp.status})`);
                        return;
                    }
                    const text = await resp.text();
                    editor.value = text;
                    editorMeta.textContent = `${path} — ${text.split('\n').length} lines`;
                    infoEl.textContent = `Editing ${path}`;
                } catch (err) {
                    editor.value = `Error loading ${path}: ${err.message}`;
                    editorMeta.textContent = `Error loading ${path}`;
                    this.addConsoleMessage('error', `Internal Scripts fetch error for ${path}: ${err.message}`);
                }
            };

            selectEl.addEventListener('change', (e) => {
                fetchAndPopulateEditor(e.target.value);
            });

            // Save back to server (for local dev this will not persist on origin, but provides a downloadable fallback)
            editorSaveBtn.addEventListener('click', async () => {
                const path = selectEl.value;
                if (!path) return;
                try {
                    // Try to PUT back to same path if server accepts it (useful in hosted dev with write support)
                    const resp = await fetch(path, { method: 'PUT', body: editor.value });
                    if (resp.ok) {
                        this.showTemporaryFeedback(`Saved ${path}`, 'success');
                        this.addConsoleMessage('success', `Saved internal script: ${path}`);
                    } else {
                        // Fallback: offer download
                        const blob = new Blob([editor.value], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = path.split('/').pop();
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        this.showTemporaryFeedback(`Could not save to server — downloaded ${path} locally.`, 'warn');
                        this.addConsoleMessage('warn', `Save to server failed for ${path}: ${resp.status} ${resp.statusText}. Offered download.`);
                    }
                } catch (e) {
                    this.showTemporaryFeedback(`Save failed: ${e.message}`, 'error');
                    this.addConsoleMessage('error', `Failed saving ${selectEl.value}: ${e.message}`);
                }
            });

            // Refresh currently loaded script
            editorRefreshBtn.addEventListener('click', () => {
                fetchAndPopulateEditor(selectEl.value);
            });

            refreshBtn.addEventListener('click', () => {
                selectEl.innerHTML = '';
                (this._internalScriptPaths || scripts).forEach(path => {
                    const opt = document.createElement('option');
                    opt.value = path;
                    opt.textContent = path;
                    selectEl.appendChild(opt);
                });
                fetchAndPopulateEditor(selectEl.value);
                this.addConsoleMessage('info', 'Internal Scripts list refreshed.');
            });

            if (selectEl.options.length > 0) {
                fetchAndPopulateEditor(selectEl.value);
            }

            this.addConsoleMessage('info', `Internal Scripts: UI ready with ${selectEl.options.length} entries.`);
        } catch (e) {
            console.error('Failed to load Internal Scripts content:', e);
            this.addConsoleMessage('error', `Failed to load Internal Scripts content: ${e.message}`);
        }
    }

    updateFiles(files) {
        Object.entries(files).forEach(([filename, content]) => {
            this.currentFiles[filename] = content;
        });

        this.renderFileTree();
        this.updateCodeEditor();
        this.saveCurrentProject();
        this.previewManager.updatePreviewFrameContent();
    }

    switchFile(filename) {
        if (this.currentFiles[filename]) {
            this.currentFile = filename;
            this.updateCodeEditor();
            this.renderFileTree();
            this.previewManager.updatePreviewFrameContent();

            // Keep dropdowns in sync
            const editorSelect = document.getElementById('editorScriptSelect');
            if (editorSelect) editorSelect.value = filename;
        }
    }

    updateCodeEditor() {
        const editorTextarea = document.getElementById('codeTextarea');
        const fileNameDisplayEl = document.getElementById('currentFileNameDisplay');

        // If Monaco is available and not initialized yet, create instance replacing the textarea
        if (window.require && !this.monacoEditor && editorTextarea) {
            // Hide the textarea since Monaco will replace it visually
            editorTextarea.style.display = 'none';

            // Configure loader base and require monaco
            window.require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.39.0/min/vs' }});
            window.require(['vs/editor/editor.main'], () => {
                this.monacoEditor = monaco.editor.create(document.getElementById('codeTextarea').parentElement, {
                    value: this.currentFiles[this.currentFile] || '',
                    language: this.detectLanguageFromFilename(this.currentFile),
                    theme: 'vs-dark',
                    automaticLayout: true,
                    minimap: { enabled: false },
                    fontFamily: "'Source Code Pro', 'Space Mono', monospace",
                    fontSize: 14,
                    tabSize: 2,
                    lineNumbers: 'on',                // show line numbers
                    renderLineHighlight: 'all',      // subtle highlight for current line + gutter
                    renderWhitespace: 'boundary',    // show whitespace lightly for better alignment
                    wordWrap: 'off',                 // wrap disabled for code clarity
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    folding: true,                   // enable folding
                    automaticLayout: true
                });

                // When Monaco content changes update app state and trigger build/preview
                this.monacoEditor.getModel().onDidChangeContent(() => {
                    const value = this.monacoEditor.getValue();
                    this.currentFiles[this.currentFile] = value;
                    this.saveCurrentProject();
                    this.previewManager.updatePreviewFrameContent();
                    if (this.buildManager) this.buildManager.triggerBuild();
                });
            });
        }

        // If Monaco exists, update its model content when switching files
        if (this.monacoEditor) {
            const model = this.monacoEditor.getModel();
            const newValue = this.currentFiles[this.currentFile] || '';
            if (model && model.getValue() !== newValue) {
                this.monacoEditor.getModel().setValue(newValue);
                const newLang = this.detectLanguageFromFilename(this.currentFile);
                monaco.editor.setModelLanguage(this.monacoEditor.getModel(), newLang);
            }
        } else {
            // Fallback to textarea (existing behavior)
            const editor = document.getElementById('codeTextarea');
            if (editor) editor.value = this.currentFiles[this.currentFile] || '';
        }

        if (fileNameDisplayEl) fileNameDisplayEl.textContent = this.currentFile || 'No file selected';
    }

    // Helper to map filename extensions to Monaco languages
    detectLanguageFromFilename(filename) {
        if (!filename) return 'plaintext';
        const ext = filename.split('.').pop().toLowerCase();
        if (['js','mjs','cjs'].includes(ext)) return 'javascript';
        if (['ts'].includes(ext)) return 'typescript';
        if (['tsx'].includes(ext)) return 'typescript';
        if (['jsx'].includes(ext)) return 'javascript';
        if (['html','htm'].includes(ext)) return 'html';
        if (['css'].includes(ext)) return 'css';
        if (['json'].includes(ext)) return 'json';
        if (['md'].includes(ext)) return 'markdown';
        return 'plaintext';
    }

    async addFile() {
        let filename = await this.showCustomPrompt('New File', 'Enter new filename (e.g., script.js, style.css, new.html):');
        if (!filename) return;

        filename = filename.toLowerCase().replace(/\s+/g, '-');

        if (this.currentFiles[filename]) {
            this.showTemporaryFeedback('File with this name already exists.', 'warn');
            return;
        }

        let content = '';
        const fileExtension = filename.split('.').pop();

        switch (fileExtension) {
            case 'html':
                content = '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>New Page</title>\n</head>\n<body>\n    <h1>New HTML File</h1>\n</body>\n</html>';
                break;
            case 'css':
                content = `/* styles for ${filename} */\nbody {\n    background-color: #f0f0f0;\n}\n`;
                break;
            case 'js':
            case 'cjs':
            case 'mjs':
                content = `// script for ${filename}\nconsole.log('Hello from ${filename}!');\n`;
                break;
            case 'json':
                content = '{\n    "name": "",\n    "version": "1.0.0"\n}\n';
                break;
            case 'md':
                content = `# ${filename}\n\nWrite your markdown here.`;
                break;
            case 'ts':
            case 'tsx':
            case 'jsx':
                content = `// TypeScript/React code for ${filename}\n\nconsole.log('Hello from ${filename}!');\n`;
                break;
            case 'txt':
            case 'xml':
            case 'yml':
            case 'yaml':
            case 'env':
            case 'gitignore':
            case 'lock':
            case 'toml':
            case 'ini':
            case 'cfg':
            case 'd.ts':
            case 'robots.txt':
            case 'deploy.yml':
            case 'dockerfile':
            case 'procfile':
                content = '';
                break;
            default:
                content = '';
                break;
        }

        this.currentFiles[filename] = content;
        this.currentFile = filename;
        this.saveCurrentProject();
        this.renderFileTree();
        this.updateCodeEditor();
        this.previewManager.updatePreviewFrameContent();
        this.addMessage('assistant', `Created new file: ${filename}`);
        this.showTemporaryFeedback(`File '${filename}' created.`, 'success');
    }

    async uploadFile() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = false;

        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) {
                this.addConsoleMessage('info', 'File upload cancelled.');
                return;
            }

            let filename = file.name;
            const fileExtension = filename.split('.').pop().toLowerCase();

            if (this.currentFiles[filename]) {
                const newName = await this.showCustomPrompt(
                    'File Exists',
                    `A file named '${filename}' already exists. Enter a new name or cancel to replace (this will overwrite the existing file):`,
                    filename
                );
                if (newName === null) {
                    this.addConsoleMessage('info', 'File upload cancelled due to existing filename.');
                    return;
                }
                filename = newName.trim();
                if (filename === '') {
                    this.showTemporaryFeedback('Filename cannot be empty.', 'warn');
                    this.addConsoleMessage('warn', 'File upload cancelled due to empty new filename.');
                    return;
                }
            }

            this.addConsoleMessage('info', `Uploading file: ${filename}...`);
            this.showTemporaryFeedback(`Uploading '${filename}'...`, 'info');

            const isMediaFile = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'mp4', 'webm', 'ogg', 'mov', 'webp', 'ico', 'avif'].includes(fileExtension);

            let fileContent;

            try {
                if (isMediaFile) {
                    fileContent = await window.websim.upload(file);
                    this.addConsoleMessage('success', `Uploaded media file ${filename} to blob storage.`);
                } else {
                    fileContent = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = (e) => reject(e);
                        reader.readAsText(file);
                    });
                    this.addConsoleMessage('success', `Read text content for file ${filename}.`);
                }

                this.currentFiles[filename] = fileContent;
                this.currentFile = filename;
                this.saveCurrentProject();
                this.renderFileTree();
                this.updateCodeEditor();
                this.previewManager.updatePreviewFrameContent();
                this.addMessage('assistant', `Uploaded and added file: ${filename}`);
                this.showTemporaryFeedback(`File '${filename}' uploaded and added to project.`, 'success');

            } catch (error) {
                this.addConsoleMessage('error', `Failed to upload/read file ${filename}: ${error.message}`);
                this.showTemporaryFeedback(`Failed to upload '${filename}': ${error.message}`, 'error');
                console.error('File upload/read error:', error);
            }
        });

        fileInput.click();
    }

    async deleteFile(filename) {
        if (filename === 'index.html') {
            this.showTemporaryFeedback('Cannot delete index.html. A project must have a main HTML file.', 'error');
            return;
        }
        if (Object.keys(this.currentFiles).length <= 1) {
            this.showTemporaryFeedback('Cannot delete the last file in the project. A project must have at least one file.', 'error');
            return;
        }

        const confirmed = await this.showCustomConfirm('Delete File', `Are you sure you want to delete ${filename}? This cannot be undone.`);
        if (!confirmed) {
            this.addConsoleMessage('info', 'File deletion cancelled.');
            return;
        }

        delete this.currentFiles[filename];

        if (this.currentFile === filename) {
            this.currentFile = 'index.html';
            if (!this.currentFiles['index.html']) {
                this.currentFile = Object.keys(this.currentFiles)[0];
            }
        }

        this.saveCurrentProject();
        this.renderFileTree();
        this.updateCodeEditor();
        this.previewManager.updatePreviewFrameContent();
        this.addMessage('assistant', `Deleted file: ${filename}`);
        this.showTemporaryFeedback(`File '${filename}' deleted.`, 'success');
    }

    async renameFile(oldFilename) {
        if (oldFilename === 'index.html') {
            this.showTemporaryFeedback('Cannot rename index.html.', 'warn');
            return;
        }

        const newFilename = await this.showCustomPrompt(
            `Rename '${oldFilename}'`,
            `Enter new name for '${oldFilename}':`,
            oldFilename
        );

        if (newFilename === null) {
            this.addConsoleMessage('info', 'File rename cancelled or new name was empty.');
            return;
        }

        const trimmedNewFilename = newFilename.trim();
        if (trimmedNewFilename === '' || trimmedNewFilename === oldFilename) {
            this.addConsoleMessage('info', 'File name not changed.');
            return;
        }

        if (this.currentFiles.hasOwnProperty(trimmedNewFilename)) {
            this.showTemporaryFeedback(`File '${trimmedNewFilename}' already exists.`, 'error');
            return;
        }

        const fileContent = this.currentFiles[oldFilename];
        delete this.currentFiles[oldFilename];
        this.currentFiles[trimmedNewFilename] = fileContent;

        if (this.currentFile === oldFilename) {
            this.currentFile = trimmedNewFilename;
        }

        await this.saveCurrentProject();
        this.renderFileTree();
        this.updateCodeEditor();
        this.previewManager.updatePreviewFrameContent();
        this.addMessage('assistant', `Renamed '${oldFilename}' to '${trimmedNewFilename}'.`);
        this.showTemporaryFeedback(`File renamed to '${trimmedNewFilename}'.`, 'success');
    }

    async createNewProject(name = null, description = 'A new project for web development.') {
        let isInitialLoad = (name !== null);

        if (!name) {
            name = await this.showCustomPrompt('New Project', 'Enter project name:');
            if (!name) {
                this.addConsoleMessage('info', 'New project creation cancelled.');
                return;
            }
        }
        name = name.trim();
        if (!name) {
            this.showTemporaryFeedback('Project name cannot be empty.', 'warn');
            return;
        }

        this.githubManager.currentRepoInfo = null;

        const project = {
            id: Date.now().toString(),
            name,
            description: description,
            files: {
                'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>' + name + '</title>\n</head>\n<body>\n    <h1>Hello World!</h1>\n</body>\n</html>'
            },
            created: new Date().toISOString(),
            githubOwner: null,
            githubRepo: null
        };

        this.projects.unshift(project);
        await this.saveProjects();

        if (!isInitialLoad) {
            this.addConsoleMessage('info', `New project '${name}' created.`);
            this.showTemporaryFeedback(`Project '${name}' created!`, 'success');
            await this.loadProject(project);
        } else {
            this.currentProject = project;
            this.currentFiles = { ...project.files };
            this.currentFile = 'index.html';
            document.getElementById('projectTitle').textContent = project.name;
            this.renderFileTree();
            this.updateCodeEditor();
            this._renderProjectListUI();
        }
    }

    async loadProject(project) {
        this.currentProject = project;
        this.currentFiles = { ...project.files };
        this.currentFile = Object.keys(this.currentFiles)[0] || 'index.html';
        if (!this.currentFiles['index.html']) {
            this.currentFiles['index.html'] = '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>' + (project.name || 'My App') + '</title>\n</head>\n<body>\n    <h1>Welcome to ' + (project.name || 'My App') + '!</h1>\n</body>\n</html>';
            await this.saveCurrentProject();
        }

        this.conversationHistory = [];
        this.githubManager.currentRepoInfo = project.githubOwner && project.githubRepo ? { owner: project.githubOwner, name: project.githubRepo } : null;

        document.getElementById('projectTitle').textContent = project.name + (project.githubOwner && project.githubRepo ? ` (GitHub: ${project.githubOwner})` : '');

        this.renderFileTree();
        this.updateCodeEditor();

        this._renderProjectListUI();
        this.githubManager.updateRepoListUI();
        this.previewManager.updatePreviewFrameContent();
        document.getElementById('consoleOutput').innerHTML = '<div class="console-line log">Console cleared for new project.</div>';
    }

    async saveCurrentProject() {
        if (!this.currentProject) return;

        this.currentProject.files = { ...this.currentFiles };
        this.currentProject.modified = new Date().toISOString();
        if (this.githubManager.currentRepoInfo) {
            this.currentProject.githubOwner = this.githubManager.currentRepoInfo.owner;
            this.currentProject.githubRepo = this.githubManager.currentRepoInfo.name;
        } else {
            this.currentProject.githubOwner = null;
            this.currentProject.githubRepo = null;
        }

        let projectFoundIndex = this.projects.findIndex(p => p.id === this.currentProject.id);

        if (projectFoundIndex === -1 && this.currentProject.githubOwner && this.currentProject.githubRepo) {
            projectFoundIndex = this.projects.findIndex(p =>
                p.githubOwner === this.currentProject.githubOwner &&
                p.githubRepo === this.currentProject.githubRepo
            );
        }

        if (projectFoundIndex !== -1) {
            this.projects[projectFoundIndex] = this.currentProject;
        } else {
            this.projects.unshift(this.currentProject);
        }

        if (this.puterEnabled) {
            await this._saveProjectsToPuter();
        } else {
            this._saveProjectsToLocal();
        }
        this._renderProjectListUI();
    }

    async loadProjects() {
        this.projects = [];

        if (this.puterEnabled) {
            const puterProjects = await this._loadProjectsFromPuter();
            if (puterProjects && puterProjects.length > 0) {
                this.projects = puterProjects;
            } else {
                const localStorageProjects = this._loadProjectsFromLocal();
                if (localStorageProjects.length > 0) {
                    this.projects = localStorageProjects;
                }
            }
        } else {
            this.projects = this._loadProjectsFromLocal();
        }

        this._renderProjectListUI();
    }

    _loadProjectsFromLocal() {
        const storedProjects = JSON.parse(localStorage.getItem('projects') || '[]');
        return storedProjects.map(project => {
            const files = {};
            for (const filename in project.files) {
                files[filename] = project.files[filename] === null ? '' : project.files[filename];
            }
            return { ...project, files };
        });
    }

    _saveProjectsToLocal() {
        const projectsToSave = this.projects.map(project => {
            const newFiles = {};
            for (const filename in project.files) {
                const content = project.files[filename];
                const isExternalUrl = typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'));
                const isLargeForLocalStorage = typeof content === 'string' && content.length > this.localStorageFileSizeLimit;

                if (isExternalUrl) {
                    newFiles[filename] = content;
                } else if (isLargeForLocalStorage && !this.puterEnabled) {
                    newFiles[filename] = null;
                    this.addConsoleMessage('warn', `File "${filename}" (size: ${content.length} chars) is too large for local storage and Puter.AI is not connected. Its content will not be saved locally and might appear empty when loading this project later without re-syncing from GitHub.`);
                } else {
                    newFiles[filename] = content;
                }
            }
            return {
                ...project,
                files: newFiles
            };
        });
        localStorage.setItem('projects', JSON.stringify(projectsToSave));
    }

    async _loadProjectsFromPuter() {
        try {
            const data = await Puter.fs.readJson('/projects.json');
            return data || [];
        } catch (error) {
            if (error.code === 'FileNotFound' || error.message.includes('not found')) {
                return [];
            }
            console.error('Error reading projects from Puter.fs:', error);
            this.addConsoleMessage('error', `Failed to read projects from Puter.AI: ${error.message}`);
            return [];
        }
    }

    async _saveProjectsToPuter() {
        try {
            this.addConsoleMessage('info', 'Attempting to save projects to Puter.AI cloud storage...');
            await Puter.fs.writeJson('/projects.json', this.projects);
            this.addConsoleMessage('success', `Saved ${this.projects.length} projects to Puter.AI cloud storage successfully.`);
        } catch (error) {
            console.error('Error writing projects to Puter.fs:', error);
            this.addConsoleMessage('error', `Failed to save projects to Puter.AI: ${error.message}.`);
            this._saveProjectsToLocal();
            this.addConsoleMessage('warn', 'Projects saved to local storage as fallback.');
        }
    }

    saveProjects = async () => {
        if (this.puterEnabled) {
            await this._saveProjectsToPuter();
        } else {
            this._saveProjectsToLocal();
        }
    }

    // Create a compact, local checkpoint (non-destructive). Keeps recent 20 snapshots.
    async createCheckpoint() {
        if (!this.currentProject) {
            this.showTemporaryFeedback('No project loaded to checkpoint.', 'warn');
            return;
        }
        const key = 'devspark_checkpoints';
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        list.unshift({
            checkpointId: Date.now().toString(),
            projectId: this.currentProject.id,
            projectName: this.currentProject.name,
            timestamp: new Date().toISOString(),
            files: { ...this.currentFiles }
        });
        // Keep the list reasonably small
        localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
        this.addConsoleMessage('info', `Checkpoint created for "${this.currentProject.name}" (saved ${list[0].checkpointId}).`);
        this.showTemporaryFeedback('Checkpoint created and saved to local storage.', 'success');
    }

    _renderProjectListUI() {
        const projectList = document.getElementById('projectList');
        projectList.innerHTML = '';

        this.projects.forEach(project => {
            const projectDiv = document.createElement('div');
            projectDiv.className = `project-item ${this.currentProject && project.id === this.currentProject.id ? 'active' : ''}`;
            projectDiv.dataset.projectId = project.id;
            projectDiv.innerHTML = `
                <div class="project-info">
                    <div class="project-name">${project.name}</div>
                    <div class="project-description">${project.description || 'No description'}</div>
                </div>
                <div class="project-actions">
                    <button class="btn btn-icon btn-sm rename-project-btn" title="Rename Project">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .447.447l.14.718A5.53 5.53 0 0 0 8 16a5.53 5.53 0 0 0-3.594-1.399l-.796-.796a.5.5 0 0 1-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 1-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                        </svg>
                    </button>
                    <button class="btn btn-icon btn-sm delete-project-btn" title="Delete Project">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                            <path d="M5.5 2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2h6a2 2 0 0 0 2 2v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4h-.5a1 1 0 0 0-1 1V2a1 1 0 0 0 1-1h12z"/>
                        </svg>
                    </button>
                </div>
            `;

            projectDiv.addEventListener('click', (e) => {
                if (!e.target.closest('.project-actions')) {
                    this.loadProject(project);
                }
            });
            projectList.appendChild(projectDiv);
        });
    }

    async renameProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        const newName = await this.showCustomPrompt(`Rename Project: '${project.name}'`, 'Enter new name:', project.name);
        if (newName === null) {
            this.addConsoleMessage('info', 'Project rename cancelled.');
            return;
        }

        const trimmedNewName = newName.trim();
        if (trimmedNewName === '' || trimmedNewName === project.name) {
            this.addConsoleMessage('info', 'Project name not changed.');
            return;
        }

        project.name = trimmedNewName;
        if (this.currentProject && this.currentProject.id === projectId) {
            document.getElementById('projectTitle').textContent = project.name + (project.githubOwner && project.githubRepo ? ` (GitHub: ${project.githubOwner})` : '');
        }
        await this.saveProjects();
        this._renderProjectListUI();
        this.addConsoleMessage('info', `Project "${projectId}" renamed to "${trimmedNewName}".`);
        this.showTemporaryFeedback(`Project renamed to '${trimmedNewName}'.`, 'success');
    }

    async deleteProjectEntry(projectId) {
        const projectToDelete = this.projects.find(p => p.id === projectId);
        if (!projectToDelete) {
            this.addConsoleMessage('warn', `Project with ID ${projectId} not found.`);
            return;
        }

        const confirmed = await this.showCustomConfirm('Delete Project', `Are you sure you want to delete project "${projectToDelete.name}"? This will only remove it from your local list in DevSpark AI, not from GitHub.`);
        if (!confirmed) {
            this.addConsoleMessage('info', 'Project deletion cancelled.');
            return;
        }

        const projectIndex = this.projects.findIndex(p => p.id === projectId);
        this.projects.splice(projectIndex, 1);
        await this.saveProjects();
        this.addConsoleMessage('info', `Project "${projectToDelete.name}" deleted from local list.`);
        this.showTemporaryFeedback(`Project '${projectToDelete.name}' deleted.`, 'success');

        if (this.currentProject && this.currentProject.id === projectId) {
            this.currentProject = null;
            if (this.projects.length > 0) {
                this.loadProject(this.projects[0]);
            } else {
                await this.createNewProject('My New Project', 'A fresh start!');
            }
        }
        this._renderProjectListUI();
    }

    updateSpeechControlsUI() {
        const speechToggle = document.getElementById('speechToggle');
        const voiceSelect = document.getElementById('voiceSelect');

        if (speechToggle) speechToggle.checked = this.speechEnabled;

        if (voiceSelect) {
            voiceSelect.innerHTML = '';
            this.availableVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.id;
                option.textContent = voice.name;
                voiceSelect.appendChild(option);
            });
            voiceSelect.value = this.voicePreference;
        }
    }

    toggleSpeech(enabled) {
        this.speechEnabled = enabled;
        this.saveSpeechPreferences();
        this.addConsoleMessage('info', `Speech output: ${this.speechEnabled ? 'Enabled' : 'Disabled'}`);
    }

    selectVoice(voiceId) {
        this.voicePreference = voiceId;
        this.saveSpeechPreferences();
        this.addConsoleMessage('info', `Voice changed to: ${this.availableVoices.find(v => v.id === voiceId)?.name || voiceId}`);
    }

    saveSpeechPreferences() {
        localStorage.setItem('speechEnabled', JSON.stringify(this.speechEnabled));
        localStorage.setItem('voicePreference', this.voicePreference);
    }

    updateAIProviderControlsUI() {
        const aiProviderSelect = document.getElementById('aiProviderSelect');
        const aiApiKeyInput = document.getElementById('aiApiKeyInput');

        if (aiProviderSelect) {
            aiProviderSelect.innerHTML = '';
            this.availableAIProviders.forEach(provider => {
                const option = document.createElement('option');
                option.value = provider.id;
                option.textContent = provider.name;
                aiProviderSelect.appendChild(option);
            });
            aiProviderSelect.value = this.aiProvider;
        }

        if (aiApiKeyInput) {
            aiApiKeyInput.disabled = (this.aiProvider === 'websim');
            if (this.aiProvider === 'websim') {
                aiApiKeyInput.value = '';
                aiApiKeyInput.placeholder = 'Not applicable for Websim AI (Free)';
            } else {
                aiApiKeyInput.value = this.aiApiKey;
                aiApiKeyInput.placeholder = 'Enter API Key (optional)';
            }
        }
    }

    selectAIProvider(providerId) {
        this.aiProvider = providerId;
        this.saveAIPreferences();
        this.updateAIProviderControlsUI();
        this.addConsoleMessage('info', `AI Provider changed to: ${this.availableAIProviders.find(p => p.id === providerId)?.name || providerId}`);
    }

    setAIApiKey(key) {
        this.aiApiKey = key;
        this.saveAIPreferences();
        this.addConsoleMessage('info', 'AI API Key updated.');
    }

    saveAIPreferences() {
        localStorage.setItem('aiProvider', this.aiProvider);
        localStorage.setItem('aiApiKey', this.aiApiKey);
    }

    updateAccountInfoUI() {
        const usernameDisplay = document.getElementById('usernameDisplay');
        const userIdDisplay = document.getElementById('userIdDisplay');
        const userAvatar = document.getElementById('userAvatar');

        if (this.currentUser) {
            usernameDisplay.textContent = this.currentUser.username || 'N/A';
            userIdDisplay.textContent = this.currentUser.id || 'N/A';
            if (this.currentUser.avatar_url) {
                userAvatar.src = this.currentUser.avatar_url;
                userAvatar.style.display = 'block';
            } else {
                userAvatar.style.display = 'none';
            }
        } else {
            usernameDisplay.textContent = 'Not available';
            userIdDisplay.textContent = 'Not available';
            userAvatar.style.display = 'none';
        }
    }

    showOptionsModal() {
        const modal = document.getElementById('optionsModal');
        if (modal) {
            modal.style.display = 'flex';
            this.updateSpeechControlsUI();
            this.updateAIProviderControlsUI();
            this.updateAccountInfoUI();
        }
    }

    hideOptionsModal() {
        const modal = document.getElementById('optionsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async clearUserDataAndRestart() {
        const confirmed = await this.showCustomConfirm(
            'Clear User Data',
            'This will clear all your local projects, GitHub tokens, and application settings. Your core Websim/Puter.AI session will remain, but this app will reset. Are you sure?'
        );

        if (confirmed) {
            localStorage.removeItem('projects');
            localStorage.removeItem('githubToken');
            localStorage.removeItem('selectedOrg');
            localStorage.removeItem('speechEnabled');
            localStorage.removeItem('voicePreference');
            localStorage.removeItem('aiProvider');
            localStorage.removeItem('aiApiKey');

            this.addConsoleMessage('info', 'All local application data cleared.');
            this.showTemporaryFeedback('All data cleared. Restarting...', 'success');

            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            this.addConsoleMessage('info', 'Clear data operation cancelled.');
        }
    }

    showCustomPrompt(title, message, defaultValue = '') {
        return new Promise((resolve) => {
            const modal = document.getElementById('customPromptModal');
            const titleEl = document.getElementById('customPromptTitle');
            const messageEl = document.getElementById('customPromptMessage');
            const inputEl = document.getElementById('customPromptInput');

            titleEl.textContent = title;
            messageEl.textContent = message;
            inputEl.value = defaultValue;

            const okBtn = modal.querySelector('#customPromptOkBtn');
            const cancelBtn = modal.querySelector('#customPromptCancelBtn');
            const closeBtn = modal.querySelector('.close-btn');

            const newOkBtn = okBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            const newCloseBtn = closeBtn.cloneNode(true);

            okBtn.parentNode.replaceChild(newOkBtn, okBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

            const oldInputEl = modal.querySelector('#customPromptInput');
            const newInputEl = oldInputEl.cloneNode(true);
            oldInputEl.parentNode.replaceChild(newInputEl, oldInputEl);
            newInputEl.value = defaultValue;

            this.customPromptResolve = resolve;

            newOkBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.customPromptResolve(newInputEl.value);
            }, { once: true });
            newCancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.customPromptResolve(null);
            }, { once: true });
            newCloseBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.customPromptResolve(null);
            }, { once: true });
            newInputEl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    modal.style.display = 'none';
                    this.customPromptResolve(newInputEl.value);
                }
            }, { once: true });

            modal.style.display = 'flex';
            newInputEl.focus();
            newInputEl.select();
        });
    }

    showCustomConfirm(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('customConfirmModal');
            const titleEl = document.getElementById('customConfirmTitle');
            const messageEl = document.getElementById('customConfirmMessage');

            titleEl.textContent = title;
            messageEl.textContent = message;

            const okBtn = modal.querySelector('#customConfirmOkBtn');
            const cancelBtn = modal.querySelector('#customConfirmCancelBtn');
            const closeBtn = modal.querySelector('.close-btn');

            const newOkBtn = okBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            const newCloseBtn = closeBtn.cloneNode(true);

            okBtn.parentNode.replaceChild(newOkBtn, okBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

            this.customConfirmResolve = resolve;

            newOkBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.customConfirmResolve(true);
            }, { once: true });
            newCancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.customConfirmResolve(false);
            }, { once: true });
            newCloseBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.customConfirmResolve(false);
            }, { once: true });

            modal.style.display = 'flex';
        });
    }

    openContextMenu(targetElement, messageContent) {
        this.closeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu active';
        this.activeContextMenu = menu;

        const rect = targetElement.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left}px`;
        if (rect.left + menu.offsetWidth > window.innerWidth) {
            menu.style.left = `${rect.right - menu.offsetWidth}px`;
        }

        const copyItem = document.createElement('div');
        copyItem.className = 'context-menu-item';
        copyItem.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard" viewBox="0 0 16 16">
                <path d="M4.646 1.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .447.447l.14.718A5.53 5.53 0 0 0 8 16a5.53 5.53 0 0 0-3.594-1.399l-.796-.796a.5.5 0 0 1-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 1-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
            </svg>
            Copy Message
        `;
        copyItem.addEventListener('click', () => {
            this.copyToClipboard(messageContent);
            this.showTemporaryFeedback('Message copied!');
            this.closeContextMenu();
        });
        menu.appendChild(copyItem);

        const imageItem = document.createElement('div');
        imageItem.className = 'context-menu-item';
        imageItem.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-image" viewBox="0 0 16 16">
                <path d="M6.002 5.5a1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2h6a2 2 0 0 0 2 2v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4h-.5a1 1 0 0 0-1 1V2a1 1 0 0 0 1-1h12z"/>
            </svg>
            Generate Image
        `;
        imageItem.addEventListener('click', async () => {
            this.closeContextMenu();
            await this.generateImageFromMessage(messageContent);
        });
        menu.appendChild(imageItem);

        const videoItem = document.createElement('div');
        videoItem.className = 'context-menu-item';
        videoItem.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-film" viewBox="0 0 16 16">
                <path d="M3 2h10v10H3V2zm6 0h4v10h-4V2z"/>
            </svg>
            Generate Video
        `;
        videoItem.addEventListener('click', async () => {
            this.closeContextMenu();
            await this.generateVideoFromMessage(messageContent);
        });
        menu.appendChild(videoItem);

        document.body.appendChild(menu);
    }

    closeContextMenu() {
        if (this.activeContextMenu) {
            this.activeContextMenu.remove();
            this.activeContextMenu = null;
        }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.addConsoleMessage('info', 'Text copied to clipboard.');
        } catch (err) {
            this.addConsoleMessage('error', 'Failed to copy text: ' + err);
            console.error('Failed to copy text: ', err);
        }
    }

    showTemporaryFeedback(message, type = 'info') {
        // Centralized notification policy: do NOT show any UI popups or toasts.
        // All feedback — info, success, warnings, errors, debug — must go only to the console.
        // Map incoming feedback types into console-level message types and write to console.
        const typeMap = {
            info: 'info',
            success: 'log',
            warn: 'warn',
            warning: 'warn',
            error: 'error',
            debug: 'debug'
        };

        const consoleType = typeMap[type] || 'info';
        // Ensure console always receives a timestamped, descriptive line
        this.addConsoleMessage(consoleType, message);
        // Additionally, avoid creating or showing any DOM toast/notification elements.
        // If any other modules attempt to create popups, they should be updated to call this method
        // and will now be silenced into the console only.
    }

    createNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);

            this.audioContext = audioContext;
        } catch (error) {
            console.warn('Could not create notification sound:', error);
            this.notificationSound.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt5599NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmUeBjaN3fHOeyoGJXnE8N+SSQsVYrPr7axVHAhBm+HwvGIeBzaM3fHNeSsFJXnB8N+MSAoVYLLr7axVHAhBm+HwvGIeBzaM3PHL';
        }
    }

    playNotificationSound() {
        try {
            if (this.audioContext && this.audioContext.state === 'running') {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.3);
            } else if (this.notificationSound && this.notificationSound.src) {
                this.notificationSound.currentTime = 0;
                this.notificationSound.play().catch(e => console.warn("Could not play notification sound:", e));
            }
        } catch (error) {
            console.warn('Could not play notification sound:', error);
        }
    }

    toggleFullscreenPreview() {
        const previewModal = document.getElementById('previewModal');
        if (!previewModal) {
            this.addConsoleMessage('error', 'Preview modal not found for fullscreen toggle.');
            return;
        }

        if (document.fullscreenElement) {
            document.exitFullscreen();
            this.addConsoleMessage('info', 'Exited fullscreen preview.');
            this.showTemporaryFeedback('Exited fullscreen.', 'info');
        } else {
            if (previewModal.requestFullscreen) {
                previewModal.requestFullscreen();
            } else if (previewModal.webkitRequestFullscreen) {
                previewModal.webkitRequestFullscreen();
            } else if (previewModal.msRequestFullscreen) {
                previewModal.msRequestFullscreen();
            }
            this.addConsoleMessage('info', 'Entered fullscreen preview.');
            this.showTemporaryFeedback('Entered fullscreen.', 'info');
        }
    }

    openPreviewInNewWindow() {
        const mainHtmlBlobUrl = this.previewManager.blobUrls['__main__'];
        if (mainHtmlBlobUrl) {
            window.open(mainHtmlBlobUrl, '_blank');
            this.addConsoleMessage('info', 'Preview opened in a new browser window/tab.');
            this.showTemporaryFeedback('Preview opened in new tab!', 'info');
        } else {
            this.addConsoleMessage('warn', 'No preview content available to open in a new window. Generate a preview first.');
            this.showTemporaryFeedback('No preview to open in new tab. Generate a preview first.', 'warn');
        }
    }

    refreshPreview() {
        this.previewManager.updatePreviewFrameContent();
        this.addConsoleMessage('info', 'Preview refreshed.');
        this.showTemporaryFeedback('Preview refreshed.', 'info');
    }

    // Add download helper so all components can download blobs or external URLs
    downloadFile(url, filename) {
        try {
            if (!url) {
                this.addConsoleMessage('warn', 'No URL provided for download.');
                return;
            }
            // If it's an external URL, open in new tab for user to save
            if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
                const a = document.createElement('a');
                a.href = url;
                // If the URL is cross-origin and doesn't support download, opening in new tab is safer
                try {
                    a.download = filename || '';
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    this.addConsoleMessage('info', `Started download/open for ${filename || url}`);
                    return;
                } catch (e) {
                    window.open(url, '_blank');
                    this.addConsoleMessage('info', `Opened external URL in new tab: ${url}`);
                    return;
                }
            }

            // Otherwise treat as blob/url object (e.g., object URL)
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'download';
            document.body.appendChild(a);
            a.click();
            a.remove();
            // Revoke object URLs to free memory if applicable
            if (url.startsWith('blob:')) {
                try { URL.revokeObjectURL(url); } catch (e) { /* ignore revoke errors */ }
            }
            this.addConsoleMessage('info', `Download triggered: ${filename || 'file'}`);
        } catch (err) {
            console.error('downloadFile error:', err);
            this.addConsoleMessage('error', `Failed to download file: ${err.message}`);
            this.showTemporaryFeedback(`Failed to download file: ${err.message}`, 'error');
        }
    }

    renderFileTree() {
        const fileTreeContainer = document.getElementById('fileTreeContainer');
        if (!fileTreeContainer) return;

        fileTreeContainer.innerHTML = '';

        const categorizedFiles = {
            'html': [],
            'css': [],
            'js': [],
            'ts': [],
            'jsx': [],
            'tsx': [],
            'images': [],
            'videos': [],
            'json': [],
            'md': [],
            'config': [],
            'env': [],
            'lock': [],
            'text': [],
            'workflow': [],
            'other': []
        };

        Object.keys(this.currentFiles).sort((a, b) => {
            if (a === 'index.html') return -1;
            if (b === 'index.html') return 1;
            return a.localeCompare(b);
        }).forEach(filename => {
            const lowerFilename = filename.toLowerCase();
            const fileExtension = lowerFilename.split('.').pop();
            const isConfigName = lowerFilename.includes('config.') || lowerFilename.includes('rc.') ||
                                 lowerFilename === 'package.json' || lowerFilename === 'components.json' ||
                                 lowerFilename === 'license' || lowerFilename === 'dockerfile' || lowerFilename === 'procfile' ||
                                 lowerFilename === '.editorconfig' || lowerFilename === '.prettierrc' || lowerFilename === '.eslintrc'; 
            const isTextName = lowerFilename === '.gitignore' || lowerFilename === 'readme.md' || lowerFilename === 'robots.txt' || lowerFilename.includes('deploy.yml') || lowerFilename.endsWith('.d.ts') || lowerFilename.endsWith('.log') || lowerFilename === '.gitattributes' || lowerFilename === '.npmrc' || lowerFilename === '.nvmrc'; 

            if (lowerFilename.endsWith('.html')) {
                categorizedFiles.html.push(filename);
            } else if (lowerFilename.endsWith('.css')) {
                categorizedFiles.css.push(filename);
            } else if (lowerFilename.endsWith('.js') || lowerFilename.endsWith('.cjs') || lowerFilename.endsWith('.mjs')) {
                categorizedFiles.js.push(filename);
            } else if (lowerFilename.endsWith('.ts') && !lowerFilename.endsWith('.d.ts')) {
                categorizedFiles.ts.push(filename);
            } else if (lowerFilename.endsWith('.jsx')) {
                categorizedFiles.jsx.push(filename);
            } else if (lowerFilename.endsWith('.tsx')) {
                categorizedFiles.tsx.push(filename);
            } else if (lowerFilename.match(/\.(png|jpe?g|gif|svg|webp|ico|avif)$/i)) {
                categorizedFiles.images.push(filename);
            } else if (lowerFilename.match(/\.(mp4|webm|ogg|mov)$/i)) {
                categorizedFiles.videos.push(filename);
            } else if (lowerFilename.endsWith('.json') && !isConfigName) {
                categorizedFiles.json.push(filename);
            } else if (lowerFilename.endsWith('.md') && !isTextName) {
                categorizedFiles.md.push(filename);
            } else if (lowerFilename.endsWith('.env')) {
                categorizedFiles.env.push(filename);
            } else if (lowerFilename.endsWith('.lock') || lowerFilename.includes('lock.json')) {
                categorizedFiles.lock.push(filename);
            } else if (lowerFilename.startsWith('.github/workflows/')) {
                categorizedFiles.workflow.push(filename);
            } else if (isConfigName) {
                categorizedFiles.config.push(filename);
            } else if (lowerFilename.endsWith('.txt') || isTextName) {
                categorizedFiles.text.push(filename);
            } else {
                categorizedFiles.other.push(filename);
            }
        });

        const fileTypeIcons = {
            'html': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-filetype-html" viewBox="0 0 16 16"><path d="M14 4.5V14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 1 1 1v3.5h5z"/>
            </svg>`,
            'css': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-filetype-css" viewBox="0 0 16 16"><path d="M14 4.5V14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 1 1 1v3.5h5z"/>
            </svg>`,
            'js': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-filetype-js" viewBox="0 0 16 16"><path d="M6.5 14.5V4h5v10.5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5z"/><path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 1 1 1v3.5h5z"/>
            </svg>`,
            'ts': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-code" viewBox="0 0 16 16"><path d="M6.5 14.5V4h5v10.5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5z"/><path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 1 1 1v3.5h5z"/>
            </svg>`,
            'jsx': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-code" viewBox="0 0 16 16"><path d="M6.5 14.5V4h5v10.5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5z"/><path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 1 1 1v3.5h5z"/>
            </svg>`,
            'tsx': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-code" viewBox="0 0 16 16"><path d="M6.5 14.5V4h5v10.5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5z"/><path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 1 1 1v3.5h5z"/>
            </svg>`,
            'image': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-image" viewBox="0 0 16 16"><path d="M6.002 5.5a1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2h6a2 2 0 0 0 2 2v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4h-.5a1 1 0 0 0-1 1V2a1 1 0 0 0 1-1h12z"/>
            </svg>`,
            'video': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-video-fill" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M0 8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2h6a2 2 0 0 0 2 2v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4h-.5a1 1 0 0 0-1 1V2a1 1 0 0 0 1-1h12z"/>
            </svg>`,
            'json': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-filetype-json" viewBox="0 0 16 16"><path d="M14 4.5V14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 0 1 1v3.5h5z"/>
            </svg>`,
            'md': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-markdown" viewBox="0 0 16 16"><path d="M14 4.5V14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 0 1 1v3.5h5z"/>
            </svg>`,
            'config': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sliders" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M11 2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2h6a2 2 0 0 0 2 2v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4h-.5a1 1 0 0 0-1 1V2a1 1 0 0 0 1-1h12z"/>
            </svg>`,
            'env': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1V2a1 1 0 0 0 1 1h12z"/>
            </svg>`,
            'lock': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 1 1 1v3.5h5z"/>
            </svg>`,
            'text': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-text" viewBox="0 0 16 16"><path d="M6.5 14.5V4h5v10.5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5z"/><path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 1 1 1v3.5h5z"/>
            </svg>`,
            'workflow': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-git" viewBox="0 0 16 16"><path d="M4.646 1.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .447.447l.14.718A5.53 5.53 0 0 0 8 16a5.53 5.53 0 0 0-3.594-1.399l-.796-.796a.5.5 0 0 1-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 1-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
            </svg>`,
            'other': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark" viewBox="0 0 16 16"><path d="M6.5 14.5V4h5v10.5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5z"/><path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a1 1 0 0 1 1 1v3.5h5z"/>
            </svg>`,
            'folder-closed': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-folder" viewBox="0 0 16 16"><path d="M.5 3l.04.87a1.444 1.444 0 0 1-.005.105V12a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H.5zM1.646 4 4.646 1.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .447.447l.14.718A5.53 5.53 0 0 0 8 16a5.53 5.53 0 0 0-3.594-1.399l-.796-.796a.5.5 0 0 1-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 1-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
            </svg>`,
            'folder-open': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-folder-open" viewBox="0 0 16 16"><path d="M1.5 1H.5L.04 1.63C.017 1.905 0 2.213 0 2.5v11C0 13.88 0 14 1 14h14a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H1.5zm12 1a1 1 0 0 1 1 1v3.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
            </svg>`,
        };

        const appendCategory = (categoryTitle, files, typeIconKey) => {
            if (files.length === 0) return;

            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'tree-category';
            let isExpanded = true;
            categoryDiv.classList.toggle('expanded', isExpanded);

            const headerDiv = document.createElement('div');
            headerDiv.className = 'tree-category-header';
            headerDiv.innerHTML = `
                <span class="tree-toggle-icon">${isExpanded ? fileTypeIcons['arrow-down'] : fileTypeIcons['arrow-right']}</span>
                <span class="folder-icon">${isExpanded ? fileTypeIcons['folder-open'] : fileTypeIcons['folder-closed']}</span>
                <span>${categoryTitle} (${files.length})</span>
            `;
            categoryDiv.appendChild(headerDiv);

            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-category-children';
            childrenDiv.style.display = isExpanded ? 'block' : 'none';

            files.forEach(filename => {
                const fileItemDiv = document.createElement('div');
                fileItemDiv.className = `tree-file-item ${filename === this.currentFile ? 'active' : ''}`;
                fileItemDiv.dataset.file = filename;

                // Replace multiple inline buttons with a compact "more" dropdown
                fileItemDiv.innerHTML = `
                    <span class="file-icon">${fileTypeIcons[typeIconKey]}</span>
                    <span class="file-name">${filename}</span>
                    ${this.pinnedFiles.has(filename) ? `<span title="Pinned" class="file-pin" style="margin-left:8px;color:var(--color-primary)">📌</span>` : ''}
                    <div class="file-actions">
                        <button class="file-more-btn" data-file="${filename}" title="More">⋯</button>
                        <div class="more-menu" data-file="${filename}">
                            <div class="more-menu-item" data-action="open" data-file="${filename}">Open</div>
                            <div class="more-menu-item" data-action="download" data-file="${filename}">Download</div>
                            <div class="more-menu-item" data-action="preview" data-file="${filename}">Preview</div>
                            <div class="more-menu-item" data-action="pin" data-file="${filename}">${ this.pinnedFiles.has(filename) ? 'Unpin' : 'Pin' }</div>
                            <div class="more-menu-item" data-action="mention" data-file="${filename}">Mention (AI discuss)</div>
                            ${filename !== 'index.html' ? `<div class="more-menu-item" data-action="rename" data-file="${filename}">Rename</div>` : ''}
                            ${filename !== 'index.html' && Object.keys(this.currentFiles).length > 1 ? `<div class="more-menu-item" data-action="delete" data-file="${filename}">Delete</div>` : ''}
                        </div>
                    </div>
                `;
                childrenDiv.appendChild(fileItemDiv);
            });
            categoryDiv.appendChild(childrenDiv);
            fileTreeContainer.appendChild(categoryDiv);

            headerDiv.addEventListener('click', () => {
                isExpanded = !isExpanded;
                childrenDiv.style.display = isExpanded ? 'block' : 'none';
                categoryDiv.classList.toggle('expanded', isExpanded);
                headerDiv.querySelector('.tree-toggle-icon').innerHTML = isExpanded ? fileTypeIcons['arrow-down'] : fileTypeIcons['arrow-right'];
                headerDiv.querySelector('.folder-icon').innerHTML = isExpanded ? fileTypeIcons['folder-open'] : fileTypeIcons['folder-closed'];
            });
        };

        appendCategory('HTML Files', categorizedFiles.html, 'html');
        appendCategory('CSS Files', categorizedFiles.css, 'css');
        appendCategory('JavaScript Files', categorizedFiles.js, 'js');
        appendCategory('TypeScript Files', categorizedFiles.ts, 'ts');
        appendCategory('JSX Files', categorizedFiles.jsx, 'jsx');
        appendCategory('TSX Files', categorizedFiles.tsx, 'tsx');
        appendCategory('Image Files', categorizedFiles.images, 'image');
        appendCategory('Video Files', categorizedFiles.videos, 'video');
        appendCategory('JSON Data Files', categorizedFiles.json, 'json');
        appendCategory('Markdown Files', categorizedFiles.md, 'md');
        appendCategory('Configuration Files', categorizedFiles.config, 'config');
        appendCategory('Environment Files', categorizedFiles.env, 'env');
        appendCategory('Lock Files', categorizedFiles.lock, 'lock');
        appendCategory('GitHub Workflows', categorizedFiles.workflow, 'workflow');
        appendCategory('Plain Text Files', categorizedFiles.text, 'text');
        appendCategory('Other Files', categorizedFiles.other, 'other');

        // after rendering tree, refresh editor dropdowns
        this.populateEditorScriptSelect();
        this.populateConsoleScriptSelect();
    }

    populateEditorScriptSelect() {
        const select = document.getElementById('editorScriptSelect');
        if (!select) return;
        const prev = select.value;
        select.innerHTML = '';
        const files = Object.keys(this.currentFiles || {}).sort();
        files.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            select.appendChild(opt);
        });
        // Keep selection in sync with currentFile if possible
        if (this.currentFile && files.includes(this.currentFile)) {
            select.value = this.currentFile;
        } else if (prev && files.includes(prev)) {
            select.value = prev;
        } else if (files.length > 0) {
            select.value = files[0];
        }
    }

    populateConsoleScriptSelect() {
        const select = document.getElementById('consoleScriptSelect');
        if (!select) return;
        const prev = select.value;
        select.innerHTML = '';
        // Console targets: show JS, HTML and key config files to allow quick inspection
        const preferredExts = ['html','js','mjs','cjs','css','json'];
        const files = Object.keys(this.currentFiles || {}).filter(f => {
            const ext = f.split('.').pop().toLowerCase();
            return preferredExts.includes(ext) || f.toLowerCase().includes('log') || f.toLowerCase().includes('config') || f.toLowerCase().includes('package.json');
        }).sort();
        files.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            select.appendChild(opt);
        });
        if (files.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No console targets';
            select.appendChild(opt);
        }
        if (prev && files.includes(prev)) select.value = prev;
    }

    async loadDeploymentInfo() {
        const deployPanelContent = document.getElementById('deployPanelContent');
        if (!deployPanelContent) return;

        deployPanelContent.innerHTML = `
            <div class="deploy-section">
                <h4 style="margin-bottom: var(--spacing-md); color: var(--color-text-dark);">Deployment Information</h4>
                <div class="deploy-info">
                    <p><strong>Project Name:</strong> ${this.currentProject?.name || 'N/A'}</p>
                    <p><strong>Deployment Status:</strong> <span id="deploymentStatus">Not deployed yet.</span></p>
                    <p><strong>Last Deployed:</strong> <span id="lastDeployedDate">N/A</span></p>
                    <p><strong>Deployment URL:</strong> <a href="${this.mockDeploymentUrl}" target="_blank" id="deploymentUrl" style="color: var(--color-primary-light); text-decoration: underline;">${this.mockDeploymentUrl}</a></p>
                    <div style="margin-top: var(--spacing-lg);">
                        <button class="btn btn-primary" id="startDeployBtn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud-upload-fill" viewBox="0 0 16 16">
                                <path fill-rule="evenodd" d="M8 0a5.53 5.53 0 0 0-3.594 1.399l-.796.796A.5.5 0 0 1 3 2.5a.5.5 0 0 0-.006-.006l-.515-.515a.5.5 0 0 1-.707 0L1.002 1.58C.723 1.301.916.906 1.406.81l.718.14a.5.5 0 0 1 .447.447l.14.718A5.53 5.53 0 0 0 8 0zm0 16a5.53 5.53 0 0 0 3.594-1.399l.796-.796a.5.5 0 0 1 .447.272l-1.5-3A.5.5 0 0 0 14.5 4h-13a.5.5 0 0 0-.447.272l.5 1A.5.5 0 0 0 12.947 10.957z"/>
                            </svg>
                            Deploy Now
                        </button>
                        <div id="deploymentLog" style="margin-top: var(--spacing-lg); background-color: var(--color-bg-light); padding: var(--spacing-md); border: 1px solid var(--color-border); font-family: 'Space Mono', monospace; font-size: 13px; max-height: 200px; overflow-y: auto;">
                            <p style="color: var(--color-text-medium);">Deployment log will appear here...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('startDeployBtn').addEventListener('click', () => this.startMockDeployment());
    }

    async startMockDeployment() {
        const deployBtn = document.getElementById('startDeployBtn');
        const deploymentStatusSpan = document.getElementById('deploymentStatus');
        const lastDeployedDateSpan = document.getElementById('lastDeployedDate');
        const deploymentLog = document.getElementById('deploymentLog');

        if (!deployBtn || !deploymentStatusSpan || !deploymentLog) return;

        deployBtn.disabled = true;
        deployBtn.textContent = 'Deploying...';
        this.showTemporaryFeedback('Starting deployment...', 'info');
        deploymentLog.innerHTML = ''; // Clear previous log

        let currentPhaseIndex = 0;
        const animateDeployment = () => {
            if (currentPhaseIndex < this.mockDeploymentStatusMessages.length) {
                const message = this.mockDeploymentStatusMessages[currentPhaseIndex];
                deploymentStatusSpan.textContent = message;
                const logEntry = document.createElement('p');
                logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
                logEntry.style.color = currentPhaseIndex === this.mockDeploymentStatusMessages.length - 1 ? 'var(--color-success-text)' : 'var(--color-info-text)';
                deploymentLog.appendChild(logEntry);
                deploymentLog.scrollTop = deploymentLog.scrollHeight;
                currentPhaseIndex++;
                setTimeout(animateDeployment, this.mockDeploymentPhaseDuration);
            } else {
                deployBtn.disabled = false;
                deployBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud-upload-fill" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M8 0a5.53 5.53 0 0 0-3.594 1.399l-.796.796A.5.5 0 0 1 3 2.5a.5.5 0 0 0-.006-.006l-.515-.515a.5.5 0 0 1-.707 0L1.002 1.58C.723 1.301.916.906 1.406.81l.718.14a.5.5 0 0 1 .447.447l.14.718A5.53 5.53 0 0 0 8 0zm0 16a5.53 5.53 0 0 0 3.594-1.399l.796-.796a.5.5 0 0 1 .447.272l-1.5-3A.5.5 0 0 0 14.5 4h-13a.5.5 0 0 0-.447.272l.5 1A.5.5 0 0 0 12.947 10.957z"/>
                    </svg>
                    Deploy Now
                `;
                this.showTemporaryFeedback('Deployment complete!', 'success');
                lastDeployedDateSpan.textContent = new Date().toLocaleString();
            }
        };
        animateDeployment();
    }

    async generateImageFromMessage(prompt) {
        this.addConsoleMessage('info', `Attempting to generate image with prompt: "${prompt.substring(0, 50)}..."`);
        this.showTemporaryFeedback('Generating image...', 'info');

        try {
            this.generatedImageUrl = null;
            this.showImagePreviewOverlay();

            const result = await websim.imageGen({ prompt: prompt });

            if (result && result.url) {
                this.generatedImageUrl = result.url;
                const imgFilename = `ai-image-${Date.now()}.png`;
                this.currentFiles[imgFilename] = result.url;
                this.saveCurrentProject();
                this.renderFileTree();

                this.addMessage('assistant', `Here's an image based on your request!`, null, false, result.url);
                this.showTemporaryFeedback('Image generated successfully!', 'success');
            } else {
                throw new Error("No image URL returned from generation.");
            }
        } catch (error) {
            this.hideImagePreviewOverlay();
            this.addConsoleMessage('error', `Failed to generate image: ${error.message}`);
            this.addMessage('assistant', `I'm sorry, I couldn't generate an image based on your request. Please try again or rephrase.`);
            this.showTemporaryFeedback(`Failed to generate image: ${error.message}`, 'error');
            console.error("Image generation error:", error);
        }
    }

    async generateVideoFromMessage(prompt) {
        this.addConsoleMessage('info', `Attempting to generate video with prompt: "${prompt.substring(0, 50)}..."`);
        this.showTemporaryFeedback('Attempting to generate video...', 'info');

        try {
            this.addMessage('assistant', `I'm sorry, I can't generate videos directly within this DevSpark AI environment at the moment. However, I can try to generate a static image that represents your video idea!`);
            this.addConsoleMessage('warn', 'Video generation not supported by current Websim API. Falling back to image generation suggestion.');

            const confirmed = await this.showCustomConfirm(
                'Video Generation Not Available',
                'Video generation is not currently supported by the AI. Would you like me to generate a still image based on your prompt instead?'
            );

            if (confirmed) {
                await this.generateImageFromMessage(prompt);
            } else {
                this.addMessage('assistant', 'Okay, cancelling video request.');
                this.showTemporaryFeedback('Video generation cancelled.', 'info');
            }
        } catch (error) {
            this.addConsoleMessage('error', `Error during video generation fallback: ${error.message}`);
            this.addMessage('assistant', `An error occurred while trying to process your video request.`);
            this.showTemporaryFeedback(`Failed to process video request: ${error.message}`, 'error');
            console.error("Video generation fallback error:", error);
        }
    }

    applySketchVars() {
        try {
            const root = document.documentElement;
            root.style.setProperty('--sketch-stroke', `${this.sketchStrokeWidth}px`);
            root.style.setProperty('--sketch-offset-x', `${this.sketchOffset.x}px`);
            root.style.setProperty('--sketch-offset-y', `${this.sketchOffset.y}px`);
            root.style.setProperty('--sketch-tilt', `${this.sketchTiltDegrees}deg`);
            root.style.setProperty('--color-primary', this.sketchPrimary);
            root.style.setProperty('--color-accent-yellow', this.sketchAccentYellow);
            root.style.setProperty('--color-ink', `rgba(0,0,0,${this.sketchInkOpacity})`);
        } catch (e) {
            console.warn('Failed to apply sketch vars', e);
        }
    }

    async buildProject() {
        if (!this.currentProject) {
            this.addConsoleMessage('warn', 'No project loaded to build.');
            this.showTemporaryFeedback('No project loaded for build.', 'warn');
            return;
        }

        this.addConsoleMessage('info', 'Starting simulated build process...');
        this.showTemporaryFeedback('Building project...', 'info');

        let bundledContent = '';
        const filesToBundle = new Set(); 

        const executableJsExtensions = ['js', 'cjs', 'mjs'];

        let entryFound = false;

        const potentialEntryPaths = [
            this._webpackEntryFile,
            'src/index.js', 'src/main.js',
            'index.js', 'main.js', 'app.js'
        ];

        for (const entryPath of potentialEntryPaths) {
            const fileExtension = entryPath.split('.').pop();
            if (executableJsExtensions.includes(fileExtension) && this.currentFiles.hasOwnProperty(entryPath)) {
                filesToBundle.add(entryPath);
                entryFound = true;
                this.addConsoleMessage('info', `Simulated build: Found entry file: ${entryPath}`);
                break;
            }
        }

        if (!entryFound) {
            this.addConsoleMessage('warn', `Simulated build: No standard JavaScript entry file found (e.g., ${potentialEntryPaths.filter(p => executableJsExtensions.includes(p.split('.').pop())).join(', ')}). Attempting to bundle all individual .js files.`);
        }

        for (const filename in this.currentFiles) {
            const fileExtension = filename.split('.').pop();
            if (executableJsExtensions.includes(fileExtension)) { 
                filesToBundle.add(filename);
            } else if (['ts', 'tsx', 'jsx'].includes(fileExtension)) {
                this.addConsoleMessage('warn', `Simulated build: File "${filename}" (TypeScript/JSX) requires transpilation to run in the browser. It will NOT be included in the direct output bundle for execution. Use a real build tool for this.`);
            }
        }

        if (filesToBundle.size === 0) {
            this.addConsoleMessage('error', 'Simulated build failed: No browser-executable JavaScript files found to bundle.');
            this.showTemporaryFeedback('Build failed: No source files found.', 'error');
            return;
        }

        const sortedFilesToBundle = Array.from(filesToBundle).sort((a, b) => {
            if (a === this._webpackEntryFile) return -1;
            if (b === this._webpackEntryFile) return 1;
            return a.localeCompare(b);
        });

        sortedFilesToBundle.forEach(filename => {
            const content = this.currentFiles[filename];
            if (content) {
                bundledContent += `\n/* --- Start of ${filename} --- */\n`;
                bundledContent += content;
                bundledContent += `\n/* --- End of ${filename} --- */\n`;
            }
        });

        const outputFilename = this._webpackOutputBundle;
        this.currentFiles[outputFilename] = bundledContent;
        this.addConsoleMessage('info', `Simulated build: Created ${outputFilename}`);

        let indexHtmlContent = this.currentFiles['index.html'];
        const scriptTag = `<script src="./${outputFilename}"></script>`;
        if (indexHtmlContent) {
            if (!indexHtmlContent.includes(scriptTag)) {
                if (indexHtmlContent.includes('</body>')) {
                    indexHtmlContent = indexHtmlContent.replace('</body>', `    ${scriptTag}\n</body>`);
                } else {
                    indexHtmlContent += `\n${scriptTag}\n`;
                }
                this.currentFiles['index.html'] = indexHtmlContent;
                this.addConsoleMessage('info', `Simulated build: Linked ${outputFilename} in index.html.`);
            } else {
                this.addConsoleMessage('info', `Simulated build: ${outputFilename} already linked in index.html.`);
            }
        } else {
            this.addConsoleMessage('warn', 'Simulated build: No index.html found to link the bundle. Ensure you have an index.html for preview.');
        }

        await this.saveCurrentProject();
        this.renderFileTree();
        this.previewManager.updatePreviewFrameContent();
        this.addConsoleMessage('success', this._buildSuccessMessage);
        this.showTemporaryFeedback(this._buildSuccessMessage, 'success');
        this.addMessage('assistant', `The simulated build process for your project is complete! All **browser-executable** JavaScript files (e.g., \`.js\`, \`.cjs\`, \`.mjs\`) have been concatenated into \`${outputFilename}\`.

**Important Note on Build Limitations:**
*   This is a *simulated* build. DevSpark AI runs in your browser and cannot execute Node.js-based build tools like Webpack, Babel, or TypeScript compilers directly.
*   **No Transpilation:** TypeScript (\`.ts\`, \`.tsx\`) and JSX (\`.jsx\`) syntax are *not* converted to plain JavaScript. If your project relies on these, they will cause \`SyntaxError\` in the preview if you try to run them directly or if they are referenced without a proper build.
*   **No Advanced Module Resolution/Tree-shaking:** \`import\`/\`export\` statements in the bundled file are simply concatenated; complex module graphs are not resolved beyond basic relative paths.
*   **No Live Reload for Source Changes:** You must manually click "Build Project" after editing source files (especially \`.ts\`/\`.tsx\`/\`.jsx\`) to update the bundled output.
*   **Tailwind CSS:** If your project uses Tailwind CSS via a CDN, you will see a warning in the console. For production, Tailwind CSS should be installed as a PostCSS plugin and processed during a build step for optimal performance and minification.

For a real build environment with full transpilation, module bundling, and live reloading, you would typically use a local development server with tools like Vite, Webpack, or Parcel. If you deploy this project, you will need to set up a proper build pipeline.

Check your console and the live preview to see if the bundled code functions as expected.`);
    }

    // Reasonings panel utilities
    showReasoningThinking(show = true) {
        const th = document.getElementById('reasoningThinking');
        if (!th) return;
        th.style.display = show ? 'inline-block' : 'none';
    }

    updateReasoningPanel(text) {
        const steps = document.getElementById('reasoningSteps');
        if (!steps) return;
        // prefer richer inner thoughts presentation: show raw "chain-of-thought" if provided
        let content = '';
        if (text.rawThoughts) {
            content += `Thoughts:\n${text.rawThoughts}\n\n`;
        }
        // fallback structured pieces
        content += `Steps: ${text.steps || '-'}\n\n`;
        content += `Analysis: ${text.breakdown || '-'}\n\n`;
        content += `Edge cases: ${text.edgeCases || '-'}\n\n`;
        content += `Decision: ${text.chosen || '-'}`;
        // allow small inline styling token for clarity (keeps plain text)
        steps.textContent = content;
        this.showReasoningThinking(false);
    }

    generateStubReasoning(userMessage) {
        // produce a more "inner thought" like stub to display while AI composes
        const raw = [
            `Parsing: "${userMessage.slice(0,120)}"`,
            'Identifying intent...',
            `Mode: ${this.reasoningMode || 'casual'}`,
            'Considering current files and active file context...',
            'Planning response: prioritize clarity, include code snippets if requested.',
        ].join(' ⇢ ');
        return {
            rawThoughts: raw,
            steps: `1) parse  2) intent  3) plan`,
            breakdown: `Using heuristics: file count=${Object.keys(this.currentFiles||{}).length}`,
            edgeCases: 'Ambiguous request, missing constraints',
            chosen: `Respond in ${this.reasoningMode || 'casual'} tone`
        };
    }

    async typeAssistantResponse(messageDiv, fullText, audioUrl = null) {
        try {
            const contentDiv = messageDiv.querySelector('.message-content');
            if (!contentDiv) return;
            // Clear existing content and prepare typing container
            contentDiv.innerHTML = '';
            const streamEl = document.createElement('div');
            streamEl.className = 'typing-content';
            contentDiv.appendChild(streamEl);
            streamEl.classList.add('typing-caret');

            // Fast typewriter: chunk by words for smoothness
            const words = fullText.split(/\s+/);
            let displayed = '';
            for (let i = 0; i < words.length; i++) {
                displayed += (i === 0 ? '' : ' ') + words[i];
                streamEl.textContent = displayed;
                // small delay: faster than human typing
                await new Promise(r => setTimeout(r, 18)); // ~18ms per word -> quick stream
            }
            // finalize content: render markdown safely (use marked + DOMPurray if available)
            try {
                streamEl.innerHTML = DOMPurify.sanitize(marked.parse(fullText));
            } catch (e) {
                streamEl.textContent = fullText;
            }
            streamEl.classList.remove('typing-caret');

            // Optionally play TTS if enabled and audioUrl provided or generate
            if (this.speechEnabled) {
                let url = audioUrl;
                if (!url) {
                    try {
                        const res = await websim.textToSpeech({ text: fullText, voice: this.voicePreference });
                        url = res?.url;
                    } catch (err) {
                        this.addConsoleMessage('warn', 'TTS generation failed: ' + (err.message || err));
                    }
                }
                if (url) {
                    try {
                        if (this.currentPlayingAudio) { this.currentPlayingAudio.pause(); this.currentPlayingContent = null; }
                        const audio = new Audio(url);
                        this.currentPlayingAudio = audio;

                        audio.play().catch(err => console.error("Error auto-playing audio:", err));

                        audio.onended = () => {
                            if (this.currentPlayingAudio === audio) {
                                this.currentPlayingAudio = null;
                            }
                        };
                    } catch (e) {
                        this.addConsoleMessage('warn', 'Error playing TTS: ' + e.message);
                    }
                }
            }
        } catch (e) {
            console.error('Typewriter error:', e);
            // Fallback: instant set
            messageDiv.querySelector('.message-content').innerHTML = DOMPurify ? DOMPurify.sanitize(marked.parse(fullText)) : fullText;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // expose app instance for integration modules (dictation, Puter helpers)
    window.devSparkApp = new App();
});