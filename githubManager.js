export class GitHubManager {
    constructor(app) {
        this.app = app;
        this.githubToken = localStorage.getItem('githubToken');
        this.selectedOrg = localStorage.getItem('selectedOrg');
        this.currentRepoInfo = null;
        this.setupEventListeners(); // Add this line to set up events for the new button

        /**
         * @tweakable The maximum depth to traverse subdirectories when loading a GitHub repository.
         * Setting this to a higher number allows more nested files and folders to be loaded,
         * but can increase loading time for very large repositories. 0 means only root files.
         */
        this._maxGitHubRepoDepth = 5;
    }

    setupEventListeners() {
        // Only set up event listener if the button exists
        const enterOrgManuallyBtn = document.getElementById('enterOrgManuallyBtn');
        if (enterOrgManuallyBtn) {
            enterOrgManuallyBtn.addEventListener('click', () => this.handleEnterOrgManually());
        }
    }

    showGithubModal() {
        document.getElementById('githubModal').style.display = 'flex';
        document.getElementById('githubAuth').style.display = 'block';
        document.getElementById('githubOrgs').style.display = 'none';
        if (this.githubToken) {
            document.getElementById('githubToken').value = this.githubToken;
            // Always try to load organizations when showing the modal if connected
            this.loadOrganizations();
        } else {
            // If no token, clear previous org selection display if any
            document.getElementById('orgList').innerHTML = ''; // Clear organization list
        }
    }

    hideGithubModal() {
        document.getElementById('githubModal').style.display = 'none';
    }

    async connectGithub() {
        const token = document.getElementById('githubToken').value.trim();
        if (!token) {
            this.app.showTemporaryFeedback('Please enter a GitHub token', 'warn');
            return;
        }

        try {
            this.app.addConsoleMessage('info', 'Attempting to connect to GitHub...');
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                // If connection fails, treat as an authentication failure, clear existing connection info
                this.disconnectGithub('authentication_failure');
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}. Please ensure your token is valid and has 'read:user' scope.`);
            }

            const user = await response.json();

            this.githubToken = token;
            localStorage.setItem('githubToken', token); // Store token only on successful initial auth

            this.app.addConsoleMessage('success', `Connected to GitHub as ${user.login}`);
            this.app.showTemporaryFeedback('GitHub connected successfully!', 'success');

            await this.loadOrganizations(); // This will also update OrgListUI and check connection

        } catch (error) {
            this.app.addConsoleMessage('error', `Failed to connect to GitHub: ${error.message}`);
            // The disconnectGithub('authentication_failure') already called if response.ok was false.
            // For other errors (e.g., network), ensure UI reflects.
            if (!this.githubToken) { // If token wasn't set due to pre-fetch error, explicitly update UI
                this.checkGithubConnection();
            }
            console.error('GitHub connection error:', error);
        }
    }

    async loadOrganizations() {
        if (!this.githubToken) {
             this.app.addConsoleMessage('warn', 'GitHub token not set, cannot load organizations.');
             return; // Don't proceed without a token
        }

        const orgList = document.getElementById('orgList');
        orgList.innerHTML = '<div class="loading-repos">Loading organizations...</div>'; // Show loading state

        try {
            const response = await fetch('https://api.github.com/user/orgs', {
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            let orgs = [];
            if (!response.ok) {
                let errorMessage = `Failed to list organizations: ${response.status} ${response.statusText}.`;
                if (response.status === 401 || response.status === 403) {
                    errorMessage += ` This often means your token is missing the 'read:org' scope (for classic tokens) or 'Organization permissions' > 'Read organization members' (for fine-grained tokens).`;
                }
                this.app.addConsoleMessage('warn', errorMessage + ' If you know the organization name, you can enter it manually below.');
                orgList.innerHTML = `<div class="error-repos">${errorMessage.split('.')[0]}.</div>`; // Display concise error in list
            } else {
                orgs = await response.json();
                orgList.innerHTML = ''; // Clear loading/error message before adding list items
            }

            document.getElementById('githubAuth').style.display = 'none';
            document.getElementById('githubOrgs').style.display = 'block';

            const personalOrg = document.createElement('div');
            personalOrg.className = 'org-item';
            personalOrg.textContent = 'Personal Account';
            personalOrg.dataset.orgName = ''; // Use empty string for personal account
            personalOrg.addEventListener('click', () => this.selectOrganization(null));
            orgList.appendChild(personalOrg);

            if (orgs.length > 0) {
                orgs.forEach(org => {
                    const orgDiv = document.createElement('div');
                    orgDiv.className = 'org-item';
                    orgDiv.textContent = org.login;
                    orgDiv.dataset.orgName = org.login; // Store org login in dataset
                    orgDiv.addEventListener('click', () => this.selectOrganization(org.login));
                    orgList.appendChild(orgDiv);
                });
            } else if (response.ok) { // Only if response was OK but no orgs found
                orgList.innerHTML += '<div class="no-repos">No organizations found or accessible with your token.</div>';
            }
            // Ensure the currently selected organization (if any) is highlighted
            this.updateOrgListUI();
            this.checkGithubConnection(); // Update UI after loading orgs/repos

        } catch (error) {
            console.error('Failed to load organizations:', error);
            orgList.innerHTML = `<div class="error-repos">Failed to load organizations: ${error.message}</div>`;
            this.app.addConsoleMessage('error', `Failed to load organizations: ${error.message}. This might be due to network issues or token limitations.`);
            this.checkGithubConnection(); // Ensure UI updates even if disconnectGithub wasn't called (e.g., network error)
        }
    }

    updateOrgListUI() {
        document.querySelectorAll('.org-item').forEach(item => {
            const isSelected = (this.selectedOrg === null && item.dataset.orgName === '') || (this.selectedOrg === item.dataset.orgName);
            item.classList.toggle('selected', isSelected);
        });
    }

    selectOrganization(orgName) {
        this.selectedOrg = orgName;
        localStorage.setItem('selectedOrg', orgName || '');

        // Update UI to reflect the newly selected organization
        this.updateOrgListUI();

        this.hideGithubModal();
        this.checkGithubConnection();
    }

    async handleEnterOrgManually() {
        const orgName = await this.app.showCustomPrompt(
            'Enter Organization Name',
            'Please enter the exact GitHub organization name (e.g., "JBLinx"). This is useful if your token does not have permissions to list all organizations.',
            this.selectedOrg || '' // Pre-fill if there's a current selection
        );

        if (orgName) {
            this.app.addConsoleMessage('info', `Manually selected organization: ${orgName}`);
            this.selectOrganization(orgName.trim()); // Use the same select function
        } else {
            this.app.addConsoleMessage('info', 'Manual organization entry cancelled.');
        }
    }

    checkGithubConnection() {
        const githubSection = document.getElementById('githubSection');
        const githubStatus = document.getElementById('githubStatus');
        const syncBtn = document.getElementById('syncBtn');

        if (this.githubToken) {
            githubSection.style.display = 'block';
            githubStatus.className = 'github-status github-connected';
            githubStatus.textContent = `Connected to GitHub${this.selectedOrg ? ` (${this.selectedOrg})` : ' (Personal)'}`;
            syncBtn.style.display = 'block';
            this.loadRepositories();
        } else {
            githubSection.style.display = 'none';
            syncBtn.style.display = 'none';
            document.getElementById('repoList').innerHTML = '';
            githubStatus.className = 'github-status github-disconnected';
            githubStatus.textContent = 'Disconnected from GitHub';
        }
    }

    // New method to disconnect from GitHub
    disconnectGithub(reason = 'general_error') { // Changed default reason
        const oldSelectedOrg = this.selectedOrg; // Capture selectedOrg before clearing it
        this.githubToken = null; // Always clear token in memory for safety
        this.selectedOrg = null;
        this.currentRepoInfo = null;

        // ONLY remove token from localStorage if it's a clear authentication failure at the root level
        if (reason === 'authentication_failure' || reason === 'clear_all') {
            localStorage.removeItem('githubToken');
            localStorage.removeItem('selectedOrg');
        }

        // Clear any project-specific GitHub info if the current project was a GitHub one
        if (this.app.currentProject && this.app.currentProject.githubOwner) {
            this.app.currentProject.githubOwner = null;
            this.app.currentProject.githubRepo = null;
            this.app.saveCurrentProject(); // Save the updated project state
            document.getElementById('projectTitle').textContent = this.app.currentProject.name; // Update UI
        }

        let message = 'Disconnected from GitHub.';
        let feedbackType = 'info'; // Default feedback type

        if (reason === 'insufficient_permissions') {
            message = `Disconnected from GitHub: Your token has insufficient permissions. Please check your token scopes or try a different token.`;
            if (oldSelectedOrg) {
                message += ` (Unable to access resources for organization "${oldSelectedOrg}".) For fine-grained tokens, ensure 'Repository permissions' > 'Contents' (read/write) for the target repositories and 'Organization permissions' > 'Read organization members' (if listing is desired).`;
            } else {
                message += ` For personal repositories, ensure 'Repository permissions' > 'Contents' (read/write). For fine-grained tokens, also check 'User permissions' > 'Read user email' or 'Read all user profile data' for basic connection.`;
            }
            feedbackType = 'error'; // More prominent for permissions
        } else if (reason === 'authentication_failure') {
            message = 'Disconnected from GitHub due to authentication failure (e.g., invalid or expired token). Please re-enter your token. For fine-grained tokens, ensure "User Permissions" > "Read user email" or "Read all user profile data" is granted, alongside necessary repository permissions.';
            feedbackType = 'error';
        } else if (reason === 'api_error') {
            if (oldSelectedOrg) { // Check if an organization was being used before it was nullified
                message = `Disconnected from GitHub due to an API error while accessing organization repositories for "${oldSelectedOrg}". This often means your token doesn't have permission to list repos within this organization, or the organization name is incorrect. Please verify your token scopes ('read:org' for classic tokens or 'Repository permissions' > 'Contents' (read) for fine-grained tokens) and the organization name.`;
                feedbackType = 'error'; // Treat as error as it prevents functionality
            } else {
                message = 'Disconnected from GitHub due to a general API error. Please try again later.';
                feedbackType = 'warn'; // Warn for general API issues
            }
        } else if (reason === 'clear_all') {
            message = 'GitHub connection cleared as requested.';
            feedbackType = 'info';
        }

        this.app.addConsoleMessage('warn', message);
        this.app.showTemporaryFeedback(message, feedbackType);
        this.checkGithubConnection(); // Update UI to show disconnected state
    }

    async loadRepositories() {
        if (!this.githubToken) {
            this.app.addConsoleMessage('warn', 'GitHub token not set, cannot load repositories.');
            return;
        }

        const repoList = document.getElementById('repoList');
        repoList.innerHTML = '<div class="loading-repos">Loading repositories...</div>';

        try {
            let apiUrl = '';
            let owner = '';

            // Get user info to determine personal owner if no org is selected
            const user = await this.getCurrentUser();
            owner = this.selectedOrg || user.login;

            if (this.selectedOrg) {
                apiUrl = `https://api.github.com/orgs/${this.selectedOrg}/repos`;
            } else {
                apiUrl = `https://api.github.com/user/repos`;
            }

            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                let errorMessage = `Failed to load repositories for ${owner}.`;
                let reason = 'api_error';
                if (response.status === 401 || response.status === 403) {
                    errorMessage += ` Authentication failed or insufficient permissions. Please ensure your GitHub token has access to list repositories for this account or organization. Specifically, for fine-grained tokens, you need 'Repository permissions' > 'Contents' (read) for the target repositories. For classic tokens, 'repo' or 'read:org' scopes are often required.`;
                    reason = 'insufficient_permissions';
                }
                this.disconnectGithub(reason); // Disconnect with a specific reason
                throw new Error(errorMessage);
            }

            const repos = await response.json();
            repoList.innerHTML = '';

            if (repos.length === 0) {
                repoList.innerHTML = '<div class="no-repos">No repositories found or accessible with your token for this account/organization. This might be due to insufficient permissions or if there are no public repositories.</div>';
                return;
            }

            repos.forEach(repo => {
                const repoDiv = document.createElement('div');
                repoDiv.className = 'repo-item';
                // Use the repo.owner.login from the response, as it could be an org even if fetched via user/repos
                repoDiv.dataset.owner = repo.owner.login;
                repoDiv.dataset.repoName = repo.name;
                repoDiv.textContent = repo.name;
                repoDiv.addEventListener('click', () => this.loadRepositoryContents(repo.owner.login, repo.name));
                repoList.appendChild(repoDiv);
            });
            this.updateRepoListUI();

        } catch (error) {
            repoList.innerHTML = `<div class="error-repos">Failed to load repositories: ${error.message}</div>`;
            console.error('Failed to load repositories:', error);
        }
    }

    async _fetchDirectoryContents(owner, repoName, path = '', allFiles = {}, currentDepth = 0) {
        if (currentDepth > this._maxGitHubRepoDepth) {
            this.app.addConsoleMessage('warn', `Max GitHub repository depth reached at path: ${path}. Skipping further subdirectories.`);
            return allFiles;
        }

        const contentsUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;
        const response = await fetch(contentsUrl, {
            headers: {
                'Authorization': `token ${this.githubToken}`,
                'Accept': 'application/vnd.github.v3+json' // Request JSON to get file types and urls
            }
        });

        if (!response.ok) {
            this.app.addConsoleMessage('warn', `Could not access directory contents for ${owner}/${repoName}/${path}: ${response.status} ${response.statusText}. Skipping.`);
            return allFiles;
        }

        const items = await response.json();

        /* @tweakable List of file extensions that should be fetched as text content from GitHub. */
        const textExtensions = [
            'html', 'css', 'js', 'json', 'md', 'txt', 'xml', 'yml', 'yaml', 'env',
            'jsx', 'ts', 'tsx', 'lock', 'toml', 'ini', 'cfg', 'cjs', 'mjs', 'd.ts', // Added new text extensions
        ];
        /* @tweakable List of specific filenames (without path) that should always be fetched as text content from GitHub. */
        const specificTextFileNames = [
            '.gitignore', 'package.json', 'package-lock.json', 'bun.lockb',
            'webpack.config.js', 'rollup.config.js', 'vite.config.js', 'vite.config.ts',
            'tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js',
            'eslint.config.js', 'tsconfig.json', 'tsconfig.node.json', 'tsconfig.app.json',
            'components.json', 'README.md', 'LICENSE', 'Dockerfile', 'Procfile',
            '.eslintrc', '.prettierrc', '.editorconfig', '.gitattributes', '.npmrc', '.nvmrc',
            'deploy.yml', 'robots.txt' // Added specific files mentioned by user
        ];

        /* @tweakable List of file extensions that should be treated as binary media and stored as direct URLs from GitHub. */
        const mediaExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'mp4', 'webm', 'ogg', 'mov', 'webp', 'ico', 'avif'];

        for (const item of items) {
            if (item.type === 'file') {
                const fileNameLower = item.name.toLowerCase();
                const fileExtension = fileNameLower.split('.').pop();

                let shouldFetchAsText = specificTextFileNames.includes(fileNameLower);
                let shouldStoreAsUrl = false;

                if (!shouldFetchAsText) { // Only check by extension if not already determined by specific name
                    shouldFetchAsText = textExtensions.includes(fileExtension) || textExtensions.some(ext => fileNameLower.endsWith(`.${ext}`));
                }

                shouldStoreAsUrl = mediaExtensions.includes(fileExtension) || mediaExtensions.some(ext => fileNameLower.endsWith(`.${ext}`));

                if (item.download_url) {
                    if (shouldStoreAsUrl) {
                        allFiles[item.path] = item.download_url; // Store direct URL for media
                    } else if (shouldFetchAsText) {
                        // Fetch as text for recognized text/config files
                        try {
                            const fileResponse = await fetch(item.download_url);
                            if (!fileResponse.ok) {
                                this.app.addConsoleMessage('warn', `Could not fetch content for text file: ${item.path} - ${fileResponse.status} ${fileResponse.statusText}. Skipping.`);
                                continue;
                            }
                            const content = await fileResponse.text();
                            allFiles[item.path] = content;
                        } catch (e) {
                            this.app.addConsoleMessage('error', `Error fetching text file ${item.path}: ${e.message}. Skipping.`);
                        }
                    } else {
                        // For unknown/unhandled binary files, or other files we don't explicitly support for editing, just skip.
                        this.app.addConsoleMessage('info', `Skipping unsupported file type or unlisted config file: ${item.path} (not in text or media lists).`);
                    }
                } else {
                    this.app.addConsoleMessage('warn', `File ${item.path} has no download_url. Skipping.`);
                }
            } else if (item.type === 'dir') {
                // Recursively fetch contents for subdirectories
                await this._fetchDirectoryContents(owner, repoName, item.path, allFiles, currentDepth + 1);
            }
        }
        return allFiles;
    }

    async loadRepositoryContents(owner, repoName) {
        this.app.addMessage('assistant', `Loading project files from GitHub repository "${owner}/${repoName}"...`);
        this.app.showTemporaryFeedback('Loading repository...', 'info');

        try {
            const files = await this._fetchDirectoryContents(owner, repoName); // Call the recursive helper

            // After fetching all files, let's find the best main HTML file:
            let initialFile = 'index.html';
            if (!files['index.html'] && !files['public/index.html']) { // Also check common public/index.html
                const htmlFiles = Object.keys(files).filter(f => f.endsWith('.html'));
                if (htmlFiles.length > 0) {
                    initialFile = htmlFiles[0];
                } else {
                    initialFile = Object.keys(files)[0] || 'index.html'; // Fallback to first file or 'index.html'
                }
            } else if (files['public/index.html']) {
                initialFile = 'public/index.html'; // Prefer public/index.html if available
            }

            this.app.currentProject = {
                id: `github-${owner}-${repoName}`,
                name: repoName,
                description: `GitHub Repository: ${owner}/${repoName}`,
                files: files, // All fetched files
                created: new Date().toISOString(),
                githubOwner: owner,
                githubRepo: repoName
            };
            this.currentRepoInfo = { owner, name: repoName };

            this.app.currentFiles = { ...files };
            this.app.currentFile = initialFile; // Set initial file
            this.app.conversationHistory = [];

            this.app.renderFileTree();
            this.app.updateCodeEditor();
            this.app.addMessage('assistant', `Successfully loaded project "${repoName}" from GitHub. Loaded ${Object.keys(files).length} files.`);
            document.getElementById('projectTitle').textContent = `${repoName} (GitHub: ${owner})`;
            this.app.saveCurrentProject();
            this.updateRepoListUI();
            document.querySelectorAll('.project-item').forEach(item => item.classList.remove('active'));
            this.app.previewManager.updatePreviewFrameContent();

        } catch (error) {
            this.app.addMessage('assistant', `Failed to load project from GitHub: ${error.message}`);
            this.app.showTemporaryFeedback(`Failed to load project: ${error.message}`, 'error');
            console.error('GitHub load error:', error);
            // The disconnectGithub call would have already been made by the top-level fetch check.
        }
    }

    updateRepoListUI() {
        document.querySelectorAll('.repo-item').forEach(item => {
            const isActive = this.currentRepoInfo &&
                             item.dataset.owner === this.currentRepoInfo.owner &&
                             item.dataset.repoName === this.currentRepoInfo.name;
            item.classList.toggle('active', isActive);
        });
    }

    async syncToGithub() {
        if (!this.app.currentProject || !this.githubToken) {
            this.app.addConsoleMessage('warn', 'No project loaded or GitHub not connected for sync.');
            this.app.showTemporaryFeedback('Cannot sync: No project or GitHub not connected.', 'warn');
            return;
        }

        this.app.addMessage('assistant', 'Attempting to sync project to GitHub...');

        let owner;
        let repoName;

        if (this.currentRepoInfo) {
            owner = this.currentRepoInfo.owner;
            repoName = this.currentRepoInfo.name;
        } else {
            repoName = this.app.currentProject.name.toLowerCase().replace(/\s+/g, '-');
            const user = await this.getCurrentUser();
            owner = this.selectedOrg || user.login;
        }

        const orgPath = this.selectedOrg ? `orgs/${this.selectedOrg}` : 'user';

        try {
            if (!this.currentRepoInfo || this.app.currentProject.githubOwner !== owner || this.app.currentProject.githubRepo !== repoName) {
                // Try to create repo only if it's a new GitHub project link or if switching target repo
                const createRepoResponse = await fetch(`https://api.github.com/${orgPath}/repos`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: repoName,
                        description: this.app.currentProject.description,
                        private: false,
                        auto_init: true
                    })
                });

                if (createRepoResponse.status === 422) {
                    this.app.addConsoleMessage('info', `Repository "${repoName}" already exists, proceeding to update.`);
                } else if (!createRepoResponse.ok) {
                    let errorMessage = `Failed to create repository: ${createRepoResponse.statusText}`;
                    let reason = 'api_error';
                    if (createRepoResponse.status === 401 || createRepoResponse.status === 403) {
                        errorMessage = `Authentication failed or insufficient permissions to create repository. Ensure your token has 'public_repo' or 'repo' scope, or appropriate 'organization' permissions (for fine-grained tokens, 'Repository permissions' > 'Contents' (write) and 'Metadata' (read) for the target repository or 'Organization permissions' > 'Administration' (write) for organization-level creation).`;
                        reason = 'insufficient_permissions';
                    }
                    this.disconnectGithub(reason);
                    const errorData = await createRepoResponse.json().catch(() => ({ message: 'No further details available.' }));
                    throw new Error(`${errorMessage} ${errorData.message ? `(${errorData.message})` : ''}`);
                }

                this.currentRepoInfo = { owner, name: repoName };
                this.app.currentProject.githubOwner = owner;
                this.app.currentProject.githubRepo = repoName;
                await this.app.saveCurrentProject(); // Save the new GitHub repo info to the project list
            }

            for (const [filename, content] of Object.entries(this.app.currentFiles)) {
                // Only upload files that have content or are not explicitly marked as omitted (null)
                if (content !== null) {
                    try {
                        await this.uploadFile(owner, repoName, filename, content);
                    } catch (fileUploadError) {
                        this.app.addConsoleMessage('error', `Failed to upload file ${filename}: ${fileUploadError.message}`);
                        // Do NOT disconnect GitHub here, allow other files to proceed.
                    }
                } else {
                    this.app.addConsoleMessage('info', `Skipping upload of file ${filename} (content was omitted from local storage due to size).`);
                }
            }

            this.app.addMessage('assistant', `Project "${this.app.currentProject.name}" synced to GitHub repository "${owner}/${repoName}" successfully!`);
            await this.loadRepositories();
            this.app.showTemporaryFeedback('Project synced to GitHub!', 'success');

        } catch (error) {
            this.app.addMessage('assistant', `Failed to sync to GitHub: ${error.message}`);
            console.error('GitHub sync error:', error);
            // The disconnectGithub call would have already been made by the top-level fetch check.
        }
    }

    async getCurrentUser() {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${this.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            let errorMessage = 'Failed to get current user.';
            let reason = 'api_error';
            if (response.status === 401 || response.status === 403) {
                errorMessage = `Authentication failed or insufficient permissions. Ensure your token has 'user:read' or 'read:user' scope (for fine-grained tokens, 'User permissions' > 'Read user email' or 'Read all user profile data').`;
                reason = 'authentication_failure'; // This is a critical auth error, disconnect and clear token
            }
            this.disconnectGithub(reason);
            throw new Error(errorMessage);
        }

        return response.json();
    }

    async uploadFile(owner, repo, filename, content, branch = 'main') {
        let encodedContent = '';
        const isMediaFile = filename.match(/\.(png|jpe?g|gif|svg|mp4|webm|ogg|mov|webp|ico|avif)$/i);

        // If it's a generated media URL, fetch it and convert to base64 for upload
        if (isMediaFile && (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://')))) {
            try {
                const mediaResponse = await fetch(content);
                if (!mediaResponse.ok) {
                    throw new Error(`Failed to fetch media for upload: ${filename} - ${mediaResponse.status} ${mediaResponse.statusText}`);
                }
                const blob = await mediaResponse.blob();
                encodedContent = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]); // Get base64 part
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                this.app.addConsoleMessage('error', `Error preparing media file ${filename} for GitHub upload: ${error.message}`);
                throw new Error(`Could not prepare media file for upload: ${filename}. ${error.message}`);
            }
        } else if (typeof content === 'string') {
            // For text-based files, just base64 encode the string content
            encodedContent = btoa(unescape(encodeURIComponent(content)));
        } else {
             // If content is not a string (e.g. was null or undefined), skip or handle as appropriate.
             this.app.addConsoleMessage('warn', `Skipping upload of file ${filename} as its content is not a string or external URL.`);
             return;
        }

        let sha = null;
        try {
            const getFileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filename}?ref=${branch}`, { // Support different branches
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (getFileResponse.ok) {
                const fileData = await getFileResponse.json();
                sha = fileData.sha;
            } else if (getFileResponse.status === 404) {
                // File does not exist, proceed to create it (no SHA needed)
                this.app.addConsoleMessage('info', `File ${filename} does not exist in repo, will create.`);
            } else if (getFileResponse.status === 401 || getFileResponse.status === 403) {
                let errorDetails = `Permission denied when checking for existing file ${filename}. Please ensure your GitHub token has 'contents:read' permission for this repository/organization (for fine-grained tokens, 'Repository permissions' > 'Contents' (read)).`;
                this.app.addConsoleMessage('error', errorDetails);
                this.disconnectGithub('insufficient_permissions');
                throw new Error(errorDetails);
            } else {
                let errorDetails = `Failed to check for existing file ${filename}: ${getFileResponse.status} ${getFileResponse.statusText}`;
                this.app.addConsoleMessage('error', errorDetails);
                // Not a permission error, so don't force a disconnect reason of 'insufficient_permissions' here.
                // The syncToGithub catch block will handle the general error.
                throw new Error(errorDetails);
            }
        } catch (error) {
            this.app.addConsoleMessage('warn', `Could not check for existing file ${filename}, attempting to upload without SHA: ${error.message}`);
        }

        const uploadResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filename}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update ${filename} from DevSpark AI`,
                content: encodedContent,
                sha: sha,
                branch: branch
            })
        });

        if (!uploadResponse.ok) {
            let errorMessage = `Failed to upload ${filename}: ${uploadResponse.statusText}`;
            let reason = 'api_error';
            if (uploadResponse.status === 401 || uploadResponse.status === 403) {
                errorMessage = `Authentication failed or insufficient permissions to upload file "${filename}". Please ensure your GitHub token has 'contents:write' permission for this repository/organization (for fine-grained tokens, 'Repository permissions' > 'Contents' (write)).`;
                reason = 'insufficient_permissions';
            }
            this.disconnectGithub(reason);
            const errorData = await uploadResponse.json().catch(() => ({ message: errorMessage }));
            throw new Error(`${errorMessage} ${errorData.message ? `(${errorData.message})` : ''}`);
        } else {
             this.app.addConsoleMessage('info', `Successfully uploaded ${filename} to GitHub ${branch} branch.`);
        }
    }
}