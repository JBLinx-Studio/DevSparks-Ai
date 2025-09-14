import { App } from "app";
import { marked } from "marked";
import DOMPurify from "dompurify";

export class ChatManager {
    constructor(app) {
        this.app = app;
        this.loadingIntervalId = null;
        this.loadingPhaseElements = [];
        this.currentLoadingPhaseIndex = 0;
        this.currentLoadingMessageDiv = null;

        this.loadingPhrases = [
            "AI is analyzing your request",
            "Understanding project context",
            "Reviewing current code structure",
            "Considering user skill level and preferences",
            "Identifying relevant patterns and best practices",
            "Formulating a plan based on current project state",
            "Generating intelligent response and code solutions",
            "Performing internal quality assurance checks",
            "Optimizing output for clarity and efficiency",
            "Finalizing recommendations and preparing files"
        ];

        this.conversationContext = {
            lastUserIntent: null,
            projectAnalysis: null,
            recentErrors: [],
            userPreferences: {},
            codePatterns: new Set()
        };
    }

    // New helper: analyze a file and post an assistant message summarizing it
    async analyzeFile(filename) {
        const content = this.app.currentFiles[filename] || '';
        this.app.addMessage('assistant', `Analyzing file: **${filename}** — generating a quick summary...`, null, false);

        // Lightweight summary: show top of file and basic stats; if websim AI available, ask it for a short analysis
        try {
            if (window.websim && window.websim.chat && typeof window.websim.chat.completions !== 'undefined') {
                const prompt = `Provide a concise (2-4 sentence) summary and suggested improvements for the following file named "${filename}". If it's code, mention language, potential runtime issues, and quick improvement ideas.\n\nFile content:\n\n${content.slice(0, 2000)}`;
                const completion = await websim.chat.completions.create({
                    messages: [{ role: 'user', content: prompt }],
                    json: false
                });
                const aiText = completion.content || completion;
                this.app.addMessage('assistant', aiText);
            } else {
                // fallback: simple client-side summary
                const lines = content.split('\n').slice(0, 20).join('\n');
                const stats = `Lines: ${content.split('\n').length}, Size: ${content.length} chars`;
                const summary = `File "${filename}" — ${stats}\n\nFirst lines:\n\`\`\`\n${lines}\n\`\`\``;
                this.app.addMessage('assistant', summary);
            }
        } catch (e) {
            this.app.addMessage('assistant', `Failed to analyze ${filename}: ${e.message}`);
            this.app.addConsoleMessage('error', `analyzeFile error for ${filename}: ${e.message}`);
        }
    }

    async sendInitialWelcomeMessage() {
        // Check if chatMessages container already has messages (e.g., from loaded project history or previous welcome)
        // If this is part of initial app load, and history is empty, then send it.
        if (document.getElementById('chatMessages').children.length > 0) {
            return;
        }

        const welcomeMessage = "Hello! I'm your AI assistant. I can help you build web applications. Just describe what you want to create and I'll generate the code for you. You can also connect to GitHub to sync your projects with repositories. If Puter.AI is enabled, your projects will automatically be saved to the cloud!";

        let audioUrl = null;
        if (this.app.speechEnabled) {
            try {
                const speechResult = await websim.textToSpeech({
                    text: welcomeMessage,
                    voice: this.app.voicePreference
                });
                audioUrl = speechResult.url;
            } catch (error) {
                console.error("Error generating welcome message speech:", error);
                this.app.addConsoleMessage('error', 'Failed to generate speech for welcome message.');
            }
        }

        // Explicitly pass is_loading_message as false
        this.app.addMessage('assistant', welcomeMessage, audioUrl, false);
        this.app.conversationHistory.push({
            role: 'assistant',
            content: welcomeMessage
        });
    }

    startLoadingAnimation(loadingMessageContentDiv) {
        this.stopLoadingAnimation();

        const mainStatusP = loadingMessageContentDiv.querySelector('.ai-status-message');
        const loadingAnimationContainer = loadingMessageContentDiv.querySelector('.loading-animation-container');

        if (!mainStatusP || !loadingAnimationContainer) {
            console.error('Loading message structure not found!');
            return;
        }

        loadingAnimationContainer.innerHTML = '';
        this.loadingPhaseElements = [];

        this.loadingPhrases.forEach(phrase => {
            const phaseItem = document.createElement('div');
            phaseItem.className = 'loading-phase-item';
            phaseItem.innerHTML = `<span class="loading-spinner"></span> <span class="loading-text">${phrase}</span>`;
            loadingAnimationContainer.appendChild(phaseItem);
            this.loadingPhaseElements.push(phaseItem);
        });

        this.currentLoadingPhaseIndex = 0;
        this.updateLoadingPhaseUI(mainStatusP);

        this.loadingIntervalId = setInterval(() => {
            if (this.currentLoadingPhaseIndex < this.loadingPhaseElements.length) {
                const currentItem = this.loadingPhaseElements[this.currentLoadingPhaseIndex];
                currentItem.classList.add('completed');
                currentItem.classList.remove('active');
                currentItem.querySelector('.loading-spinner').innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16">
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.497 5.384 7.3a.75.75 0 0 0-1.06 1.06L6.94 10.94a.75.75 0 0 0 1.05-.012l3.992-4.99a.75.75 0 0 0-.012-1.05z"/>
                    </svg>
                `;
            }

            this.currentLoadingPhaseIndex++;
            if (this.currentLoadingPhaseIndex >= this.loadingPhrases.length) {
                this.currentLoadingPhaseIndex = 0;
            }
            this.updateLoadingPhaseUI(mainStatusP);
        }, 750);
    }

    updateLoadingPhaseUI(mainStatusP) {
        this.loadingPhaseElements.forEach((item, index) => {
            const spinner = item.querySelector('.loading-spinner');
            if (index === this.currentLoadingPhaseIndex) {
                item.classList.add('active');
                item.classList.remove('completed');
                spinner.innerHTML = '<div class="spinner-dots"><span>.</span><span>.</span><span>.</span></div>';
                mainStatusP.textContent = this.loadingPhrases[index] + "...";
            } else if (index < this.currentLoadingPhaseIndex) {
                item.classList.remove('active');
                item.classList.add('completed');
                spinner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.497 5.384 7.3a.75.75 0 0 0-1.06 1.06L6.94 10.94a.75.75 0 0 0 1.05-.012l3.992-4.99a.75.75 0 0 0-.012-1.05z"/></svg>`;
            } else {
                item.classList.remove('active', 'completed');
                spinner.innerHTML = '';
            }
        });
    }

    stopLoadingAnimation() {
        if (this.loadingIntervalId) {
            clearInterval(this.loadingIntervalId);
            this.loadingIntervalId = null;
        }
        if (this.currentLoadingMessageDiv) {
            // Remove specific elements related to the loading animation, but keep the parent message bubble
            const mainStatusP = this.currentLoadingMessageDiv.querySelector('.ai-status-message');
            const loadingAnimationContainer = this.currentLoadingMessageDiv.querySelector('.loading-animation-container');
            if (mainStatusP) mainStatusP.remove();
            if (loadingAnimationContainer) loadingAnimationContainer.remove();

            // Remove the 'loading-message' class and add a temporary text if needed, before the final message is placed
            this.currentLoadingMessageDiv.classList.remove('loading-message');
            this.currentLoadingMessageDiv = null;
        }
        this.loadingPhaseElements = [];
        this.currentLoadingPhaseIndex = 0;
    }

    analyzeProjectContext() {
        const context = {
            projectComplexity: this.calculateProjectComplexity(),
            codeQuality: this.assessCodeQuality(),
            commonPatterns: Array.from(this.conversationContext.codePatterns),
            recentActivity: this.getRecentActivity(),
            userSkillLevel: this.estimateUserSkillLevel()
        };

        this.conversationContext.projectAnalysis = context;
        return context;
    }

    calculateProjectComplexity() {
        const fileCount = Object.keys(this.app.currentFiles || {}).length;
        const totalLines = Object.values(this.app.currentFiles || {})
            .join('\n').split('\n').length;

        if (fileCount <= 3 && totalLines < 100) return 'simple';
        if (fileCount <= 10 && totalLines < 500) return 'moderate';
        return 'complex';
    }

    assessCodeQuality() {
        const files = this.app.currentFiles || {};
        let qualityScore = 0;
        let checks = 0;

        Object.entries(files).forEach(([filename, content]) => {
            if (filename.endsWith('.html')) {
                checks++;
                if (content.includes('<!DOCTYPE html>')) qualityScore++;
                if (content.includes('meta charset')) qualityScore++;
                if (content.includes('viewport')) qualityScore++;
            }
            if (filename.endsWith('.css')) {
                checks++;
                if (content.includes(':root') || content.includes('--')) qualityScore++;
                if (content.includes('@media')) qualityScore++;
            }
            if (filename.endsWith('.js')) {
                checks++;
                if (content.includes('const ') || content.includes('let ')) qualityScore++;
                if (content.includes('addEventListener')) qualityScore++;
            }
        });

        return checks > 0 ? (qualityScore / checks) > 0.6 ? 'good' : 'needs_improvement' : 'unknown';
    }

    getRecentActivity() {
        const history = this.app.conversationHistory.slice(-5);
        return history.map(msg => ({
            role: msg.role,
            intent: this.extractIntent(msg.content),
            timestamp: Date.now()
        }));
    }

    extractIntent(message) {
        const intents = {
            'create': ['create', 'make', 'build', 'generate', 'add'],
            'debug': ['error', 'bug', 'fix', 'problem', 'issue', 'broken'],
            'modify': ['change', 'update', 'edit', 'modify', 'improve'],
            'explain': ['how', 'what', 'why', 'explain', 'help', 'understand'],
            'style': ['style', 'css', 'design', 'look', 'appearance', 'theme'],
            'create_project': ['new project', 'create project', 'make a project', 'start a new web project'],
            'delete_project': ['delete project', 'remove project', 'erase project'],
            'generate_image': ['generate image', 'create image', 'draw', 'picture of', 'image of', 'generate a picture of'],
            'generate_video': ['generate video', 'create video', 'make a video', 'video of', 'generate a clip of']
        };

        const lowerMessage = message.toLowerCase();
        for (const [intent, keywords] of Object.entries(intents)) {
            if (keywords.some(keyword => lowerMessage.includes(keyword))) {
                return intent;
            }
        }
        return 'general';
    }

    estimateUserSkillLevel() {
        const history = this.app.conversationHistory;
        if (history.length < 3) return 'unknown';

        const technicalTerms = ['function', 'variable', 'array', 'object', 'class', 'method', 'api', 'async'];
        const advancedTerms = ['closure', 'prototype', 'webpack', 'babel', 'typescript', 'react', 'vue'];

        const recentMessages = history.slice(-10).filter(msg => msg.role === 'user');
        const allText = recentMessages.map(msg => msg.content).join(' ').toLowerCase();

        const technicalCount = technicalTerms.filter(term => allText.includes(term)).length;
        const advancedCount = advancedTerms.filter(term => allText.includes(term)).length;

        if (advancedCount > 2) return 'advanced';
        if (technicalCount > 3) return 'intermediate';
        return 'beginner';
    }

    manageConversationMemory() {
        if (this.app.conversationHistory.length > 15) {
            const important = this.app.conversationHistory.filter((msg, index) => {
                if (index >= this.app.conversationHistory.length - 8) return true;

                if (msg.role === 'assistant' && msg.content.includes('```')) return true;

                if (msg.content.toLowerCase().includes('error') ||
                    msg.content.toLowerCase().includes('problem')) return true;

                return false;
            });

            const messagesToKeep = Math.max(10, important.length);
            this.app.conversationHistory = this.app.conversationHistory.slice(-messagesToKeep);
        }
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const userMessage = input.value.trim();

        if (!userMessage) return;

        this.app.addMessage('user', userMessage);
        input.value = '';

        this.app.conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        this.manageConversationMemory();

        this.currentLoadingMessageDiv = this.app.addMessage('assistant', '', null, true);
        const loadingContentDiv = this.currentLoadingMessageDiv.querySelector('.message-content');

        this.startLoadingAnimation(loadingContentDiv);

        this.conversationContext.lastUserIntent = this.extractIntent(userMessage);

        // Pre-handle project management commands client-side for quicker response
        if (this.conversationContext.lastUserIntent === 'create_project') {
            await this.handleCreateProjectCommand(userMessage);
            this.stopLoadingAnimation();
            return;
        }

        if (this.conversationContext.lastUserIntent === 'delete_project') {
            await this.handleDeleteProjectCommand(userMessage);
            this.stopLoadingAnimation();
            return;
        }

        try {
            const conversationForAI = this.app.conversationHistory.slice(-12);
            const projectContext = this.analyzeProjectContext();

            // determine tone/style based on selected model/provider
            let selectedModel = 'websim';
            try { selectedModel = (window.getPreferredModel && await window.getPreferredModel()) || window.__lastSelectedModel || selectedModel; } catch (e) { selectedModel = window.__lastSelectedModel || selectedModel; }
            let preferredTone = 'professional, concise, and friendly';
            if (/claude/i.test(selectedModel)) preferredTone = 'analytical and concise';
            else if (/gpt-5-nano|gpt-5-mini|gpt-5-pro/i.test(selectedModel)) preferredTone = 'friendly, helpful, and pragmatic';
            else if (/dall-e|dall·e|dalle/i.test(selectedModel)) preferredTone = 'visual-descriptive and image-focused (brief)';
            else if (/gemini/i.test(selectedModel)) preferredTone = 'innovative and exploratory';
            else if (/puter|puter-free|puter:/i.test(selectedModel)) preferredTone = 'professional and account-aware';

            const systemPrompt = `You are an advanced AI assistant for VisionStack, a professional web development IDE and code editor application. You are highly intelligent, contextually aware, and capable of deep analysis and creative problem-solving. Your communication style is ${preferredTone}.\n\nWhen providing explanations or code snippets in your 'message' field, use GitHub-flavored Markdown (GFM) for formatting (e.g., \`\`\`html for code blocks, **bold**, *italics*, lists, etc.). This helps present information clearly within the chat interface.\n\nCURRENT USER CONTEXT:\n- Username: ${this.app.currentUser?.username || 'Guest'}\n- User ID: ${this.app.currentUser?.id || 'N/A'}\n- Avatar URL: ${this.app.currentUser?.avatar_url || 'N/A'}\n\nCORE INTELLIGENCE CAPABILITIES:\n- Deep understanding of web development patterns and best practices\n- Contextual awareness of user skill level and project complexity\n- Ability to analyze code quality and suggest improvements\n- Pattern recognition for common development issues\n- Adaptive communication based on user expertise\n- Proactive error prevention and optimization suggestions\n\nCURRENT PROJECT ANALYSIS:\n- Project: \"${this.app.currentProject?.name || 'No project loaded'}\"\n- Complexity: ${projectContext.projectComplexity}\n- Code Quality: ${projectContext.codeQuality}\n- User Skill Level: ${projectContext.userSkillLevel}\n- Last Intent: ${this.conversationContext.lastUserIntent}\n- Active File: ${this.app.currentFile || 'None'}\n- Files: [${Object.keys(this.app.currentFiles || {}).join(', ') || 'No files'}]\n\nINTERFACE STATE AWARENESS:\nDevSpark AI has a three-panel layout:\n1. LEFT SIDEBAR (280px): Project management, file tree (HTML/CSS/JS/Images categorized), GitHub integration\n2. CENTER CHAT: Our conversation area with speech controls and context menus\n3. RIGHT EDITOR: Tabbed interface (Code Editor/Console/Deployment) with live preview\n\nCurrent State:\n- Panel View: ${this.app.currentMainPanel} (code/console)\n- GitHub: ${this.app.githubManager?.githubToken ? `Connected (${this.app.githubManager.currentRepoInfo?.owner}/${this.app.githubManager.currentRepoInfo?.name})` : 'Disconnected'}\n- Speech: ${this.app.speechEnabled ? `Enabled (${this.app.voicePreference})` : 'Disabled'}\n- Projects: ${this.app.projects?.length || 0} total\n\nNEW: CLARIFICATION ON FILE EXECUTION IN PREVIEW\nIMPORTANT: The live preview in DevSpark AI directly renders HTML/CSS/JS in the browser.\nFiles like .ts, .tsx, .jsx require a *build step* (e.g., transpilation with Babel or TypeScript compiler, bundling with Vite/Webpack)\nto be converted into executable JavaScript for the browser.\nCurrently, DevSpark AI's live preview does *not* include an in-browser build step for these files.\nTherefore, while these files can be *edited*, their changes will NOT reflect in the live preview\nuntil they are explicitly compiled into standard JavaScript and linked in your HTML.\nPlease inform the user of this limitation if they inquire about their non-JS files not running.\n\nADVANCED RESPONSE STRATEGIES:\n1. CONTEXTUAL ADAPTATION: Adjust explanations based on user skill level\n   - Beginner: Detailed explanations with learning opportunities\n   - Intermediate: Balanced technical depth with practical examples\n   - Advanced: Concise, technical responses with optimization focus\n\n2. PROACTIVE ASSISTANCE: Anticipate needs and suggest improvements\n   - Identify potential issues before they occur\n   - Suggest modern alternatives to outdated practices\n   - Recommend performance optimizations\n   - Propose accessibility improvements\n\n3. INTELLIGENT CODE GENERATION:\n   - Follow established patterns in the current project\n   - Ensure consistency with existing code style\n   - Add helpful comments for learning\n   - Include error handling and edge cases\n   - Use modern ES6+ JavaScript features appropriately\n\n4. QUALITY ASSURANCE:\n   - Validate HTML semantics and accessibility\n   - Ensure responsive design principles\n   - Follow CSS best practices (BEM, custom properties)\n   - Implement proper JavaScript patterns\n   - Add appropriate meta tags and SEO considerations\n\nENHANCED CAPABILITIES:\n- Generate complete, production-ready applications\n- Debug complex issues with detailed analysis\n- Optimize performance with specific recommendations\n- Create responsive, accessible, modern designs\n- Generate relevant images and assets\n- Provide learning-oriented explanations\n- Suggest project structure improvements\n- Help with GitHub workflow optimization\n\nIMAGE GENERATION CAPABILITY:\nIf the user explicitly asks you to generate an image or create a picture (e.g., "generate an image of a cat", "draw a sunset", "show me a picture of a futuristic city"), you must respond with a JSON object that includes an "action" field. This action field tells DevSpark AI to initiate an image generation process.\n\nExample JSON response for image generation:\n{\n    "message": "Alright! I've generated an image based on your request. Take a look!",\n    "files": {}, // Important: Do NOT include any file changes when generating an image\n    "action": {\n        "type": "generate_image",\n        "prompt": "<THE_DESCRIPTIVE_IMAGE_PROMPT_HERE>" // This prompt will be used for image generation\n    }\n}\nEnsure the 'prompt' in the 'action' field is descriptive and captures the essence of the user's image request. After this response, the DevSpark AI application will handle the image generation and display it to the user.\n\nVIDEO GENERATION CAPABILITY:\nIf the user explicitly asks you to generate a video or create a clip (e.g., "generate a video of a busy street", "make a clip of a dog running", "show me a video of a sci-fi landscape"), you must respond with a JSON object that includes an "action" field. This action field tells DevSpark AI to initiate a video generation process.\n\nExample JSON response for video generation:\n{\n    "message": "Excellent! I'm creating a video based on your request. Please bear with me for a moment...",\n    "files": {}, // Important: Do NOT include any file changes when generating a video\n    "action": {\n        "type": "generate_video",\n        "prompt": "<THE_DESCRIPTIVE_VIDEO_PROMPT_HERE>" // This prompt will be used for video generation\n    }\n}\nEnsure the 'prompt' in the 'action' field is descriptive and captures the essence of the user's image/video request. After this response, the DevSpark AI application will handle the media generation and display it to the user.\n\nRESPONSE FORMAT (CRITICAL):\nAlways respond with valid JSON containing "message" and "files" keys, and optionally an "action" key for image/video generation.\n{\n    "message": "Your intelligent, contextual response here (use GFM markdown for formatting code snippets, **bold**, *italics*, etc.)",\n    "files": {\n        "filename.ext": "content or URL" // Omit or provide empty object if an action is present\n    },\n    "action"?: { // Optional field for specific actions\n        "type": "generate_image" | "generate_video",\n        "prompt": "..." // This prompt will be used for image/video generation\n    }\n}\n\nINTELLIGENT CONVERSATION GUIDELINES:\n- Be proactive: Suggest improvements even when not explicitly asked\n- Be educational: Explain the "why" behind your decisions\n- Be efficient: Provide complete solutions that work immediately\n-- Be modern: Use current best practices and technologies\n- Be aware: Reference the current project state and user patterns\n- Be helpful: Anticipate follow-up questions and provide comprehensive answers\n- **Response Tone:** Be professional and concise, but also friendly and approachable. Use a casual tone where appropriate, avoiding overly formal language.\n\nRemember: You're not just generating code, you're being an intelligent development partner who understands the project, the user, and the goals. Think deeply, provide value, and enhance the development experience.`;

            // Route AI call based on selected provider (app.aiProvider)
            const aiRequestPayload = {
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...conversationForAI
                ],
                json: true
            };
            const completion = await this.requestAIResponse(aiRequestPayload);

            // At this point, the AI has responded, so stop the *detailed* loading animation.
            // The AI's message will then be processed and displayed.
            this.stopLoadingAnimation();

            let parsedResponse;
            try {
                parsedResponse = JSON.parse(completion.content);
            } catch (jsonError) {
                console.error("Error parsing AI response JSON:", jsonError);
                console.error("Raw AI response content:", completion.content);

                const fallbackResponse = this.extractFallbackResponse(completion.content);
                if (fallbackResponse) {
                    parsedResponse = fallbackResponse;
                } else {
                    parsedResponse = {
                        message: "I apologize, but I encountered an issue with my response format. Please try again or rephrase your request.",
                        files: {}
                    };
                }
            }

            if (typeof parsedResponse.message !== 'string') {
                parsedResponse.message = "I apologize, but I encountered an issue with my response format. Could you please rephrase your request?";
            }
            if (typeof parsedResponse.files !== 'object' || parsedResponse.files === null) {
                parsedResponse.files = {};
            }

            let speechResultUrl = null;
            if (this.app.speechEnabled) {
                try {
                    const speechResult = await websim.textToSpeech({
                        text: parsedResponse.message,
                        voice: this.app.voicePreference
                    });
                    speechResultUrl = speechResult.url;
                    if (this.app.currentPlayingAudio) {
                        this.app.currentPlayingAudio.pause();
                        this.app.currentPlayingAudio.currentTime = 0;
                        this.app.currentPlayingAudio = null;
                    }
                    const audio = new Audio(speechResultUrl);
                    this.app.currentPlayingAudio = audio;
                    audio.play().catch(e => console.error("Error auto-playing audio:", e));
                    audio.onended = () => {
                        if (this.app.currentPlayingAudio === audio) {
                            this.app.currentPlayingAudio = null;
                        }
                    };
                } catch (speechError) {
                    console.error("Error generating text-to-speech:", speechError);
                    this.conversationContext.recentErrors.push({
                        type: 'speech',
                        error: speechError.message,
                        timestamp: Date.now()
                    });
                }
            }

            // Display the AI's primary text message (e.g., "Alright! I've generated...")
            // The `currentLoadingMessageDiv` would have been prepared by `startLoadingAnimation`
            if (this.currentLoadingMessageDiv) {
                const contentDiv = this.currentLoadingMessageDiv.querySelector('.message-content');
                // Use DOMPurify and marked for AI messages
                contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(parsedResponse.message));
                contentDiv.dataset.rawContent = parsedResponse.message; // Ensure raw content is stored for context menu

                // Add copy button to code blocks
                contentDiv.querySelectorAll('pre code').forEach(codeBlock => {
                    const copyButton = document.createElement('button');
                    copyButton.className = 'copy-code-btn';
                    copyButton.textContent = 'Copy Code';
                    copyButton.addEventListener('click', () => {
                        navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                            this.app.showTemporaryFeedback('Code copied!');
                        }).catch(err => {
                            this.app.addConsoleMessage('error', 'Failed to copy code: ' + err);
                        });
                    });
                    codeBlock.parentNode.insertBefore(copyButton, codeBlock);
                });

                // Add speaker and more actions buttons if not a loading message (it just transitioned from loading)
                if (speechResultUrl) {
                    const messageActionsDiv = document.createElement('div');
                    messageActionsDiv.className = 'message-actions';

                    const speakerIcon = document.createElement('button');
                    speakerIcon.className = 'speaker-icon mic-icon';
                    speakerIcon.title = 'Listen to response';
                    speakerIcon.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-mic-fill" viewBox="0 0 16 16">
                            <path d="M5 3a3 3 0 0 1 6 0v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                        </svg>
                    `;
                    speakerIcon.dataset.messageContent = parsedResponse.message;
                    speakerIcon.dataset.originalVoice = this.app.voicePreference;
                    speakerIcon.dataset.audioUrl = speechResultUrl;
                    messageActionsDiv.appendChild(speakerIcon);

                    const moreActionsBtn = document.createElement('button');
                    moreActionsBtn.className = 'more-actions-btn';
                    moreActionsBtn.title = 'More actions';
                    moreActionsBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 1.06-1.06L7.477 9.497 5.384 7.3a.75.75 0 0 0-1.06 1.06L6.94 10.94a.75.75 0 0 0 1.05-.012l3.992-4.99a.75.75 0 0 0-.012-1.05z"/>
                        </svg>
                    `;
                    messageActionsDiv.appendChild(moreActionsBtn);
                    contentDiv.appendChild(messageActionsDiv);
                }
                this.currentLoadingMessageDiv.classList.remove('loading-message'); // Ensure class is removed
            } else {
                // Fallback in case currentLoadingMessageDiv was somehow nullified earlier
                this.app.addMessage('assistant', parsedResponse.message, speechResultUrl);
            }

            // Handle specific actions
            if (parsedResponse.action && parsedResponse.action.type) {
                switch (parsedResponse.action.type) {
                    case 'generate_image':
                        try {
                            // `generateImageFromMessage` will handle adding the image to the chat and opening the modal.
                            await this.app.generateImageFromMessage(parsedResponse.action.prompt);
                        } catch (imageGenError) {
                            // Error handling for image generation is directly handled by app.js::generateImageFromMessage
                            // which also adds a chat message for failure.
                        }
                        break;
                    case 'generate_video':
                        try {
                            await this.app.generateVideoFromMessage(parsedResponse.action.prompt);
                        } catch (videoGenError) {
                            // Error handling for video generation is handled by app.js::generateVideoFromMessage
                        }
                        break;
                    default:
                        // No specific action, proceed with file updates if any
                        if (Object.keys(parsedResponse.files).length > 0) {
                            this.app.updateFiles(parsedResponse.files);
                            Object.values(parsedResponse.files).forEach(content => {
                                if (typeof content === 'string') {
                                    this.trackCodePatterns(content);
                                }
                            });
                        }
                        break;
                }
            } else { // No specific action, just a message and/or file changes
                if (Object.keys(parsedResponse.files).length > 0) {
                    this.app.updateFiles(parsedResponse.files);
                    Object.values(parsedResponse.files).forEach(content => {
                        if (typeof content === 'string') {
                            this.trackCodePatterns(content);
                        }
                    });
                }
            }

            // Add AI response text to conversation history (if not an action that adds its own specific message)
            if (!parsedResponse.action || (parsedResponse.action.type !== 'generate_image' && parsedResponse.action.type !== 'generate_video')) {
                this.app.conversationHistory.push({
                    role: 'assistant',
                    content: parsedResponse.message
                });
            }

            this.updateUserPreferences(userMessage, parsedResponse);

        } catch (error) {
            this.stopLoadingAnimation();

            this.conversationContext.recentErrors.push({
                type: 'general',
                error: error.message,
                timestamp: Date.now(),
                userMessage: userMessage
            });

            let errorMessage = this.generateIntelligentErrorResponse(error, userMessage);

            // If the loading message bubble is still there, update its content, otherwise add a new message
            if (this.currentLoadingMessageDiv) {
                // Ensure markdown is rendered for error message too
                this.currentLoadingMessageDiv.querySelector('.message-content').innerHTML = DOMPurify.sanitize(marked.parse(errorMessage));
                this.currentLoadingMessageDiv.dataset.rawContent = errorMessage; // Store raw content for context menu
                this.currentLoadingMessageDiv.classList.remove('loading-message');
                this.currentLoadingMessageDiv = null; // Clear reference
            } else {
                this.app.addMessage('assistant', errorMessage);
            }
            console.error('AI Error:', error);

            setTimeout(() => {
                this.app.addMessage('assistant', " Tip: Try being more specific about what you'd like me to help you with. I can create web components, debug issues, or explain concepts in detail.");
            }, 1000);
        }
    }

    // NEW: choose provider at runtime and call appropriate API (websim or PuterService)
    async requestAIResponse(payload) {
        try {
            // Prefer the user's selected model (Puter KV / localStorage) when available
            const pref = (window.getPreferredModel) ? await window.getPreferredModel() : (this.app.aiProvider || 'websim:gpt5-nano');
            const providerId = pref || (this.app.aiProvider || 'websim:gpt5-nano');
            const [backend, model] = (providerId || 'websim:gpt5-nano').split(':');

            // Websim routing: use websim.chat.completions.create if available
            if (backend === 'websim' && window.websim && websim.chat && websim.chat.completions) {
                // allow forcing model via provider id (falls back to payload.model)
                const req = { ...payload };
                if (model) req.model = model;
                return await websim.chat.completions.create(req);
            }

            // Puter routing: call PuterService.ai.chat with specified model if available
            if (backend === 'puter' && window.PuterService && window.PuterService.ai && typeof window.PuterService.ai.chat === 'function') {
                const opts = { model: model || payload.model || 'gpt-5-nano', messages: payload.messages, json: payload.json };
                return await window.PuterService.ai.chat(opts);
            }

            // Fallback to any available provider (try Puter then Websim)
            if (window.PuterService && window.PuterService.ai && typeof window.PuterService.ai.chat === 'function') {
                const opts = { model: model || payload.model || 'gpt-5-nano', messages: payload.messages, json: payload.json };
                return await window.PuterService.ai.chat(opts);
            }
            if (window.websim && websim.chat && websim.chat.completions) {
                const req = { ...payload };
                if (model) req.model = model;
                return await websim.chat.completions.create(req);
            }
            throw new Error('No available AI provider found (websim or PuterService).');
        } catch (err) {
            throw err;
        }
    }

    async handleCreateProjectCommand(userMessage) {
        const projectNameMatch = userMessage.match(/create (?:a new|a|new) project named "(.*?)"/i) ||
                                userMessage.match(/create (?:a new|a|new) project called "(.*?)"/i) ||
                                userMessage.match(/make (?:a new|a|new) project named "(.*?)"/i) ||
                                userMessage.match(/make (?:a new|a|new) project called "(.*?)"/i);

        let projectName = null;
        if (projectNameMatch && projectNameMatch[1]) {
            projectName = projectNameMatch[1].trim();
        }

        if (!projectName) {
            projectName = await this.app.showCustomPrompt(
                'Create New Project',
                'What would you like to name your new project?'
            );
        }

        if (projectName) {
            projectName = projectName.trim();
            if (projectName === '') {
                this.app.addMessage('assistant', 'Project name cannot be empty. New project creation cancelled.');
                return;
            }

            const existingProject = this.app.projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());
            if (existingProject) {
                this.app.addMessage('assistant', `A project named "${projectName}" already exists. Please choose a different name.`);
                return;
            }

            await this.app.createNewProject(projectName, 'Project created via AI command.');
            this.app.addMessage('assistant', `Successfully created a new project named "${projectName}".`);
        } else {
            this.app.addMessage('assistant', 'New project creation cancelled.');
        }
    }

    async handleDeleteProjectCommand(userMessage) {
        const projectNameMatch = userMessage.match(/delete project "(.*?)"/i) ||
                                userMessage.match(/remove project "(.*?)"/i) ||
                                userMessage.match(/erase project "(.*?)"/i) ||
                                userMessage.match(/delete the project named "(.*?)"/i);

        let projectNameToDelete = null;
        if (projectNameMatch && projectNameMatch[1]) {
            projectNameToDelete = projectNameMatch[1].trim();
        }

        let projectToDelete = null;
        if (projectNameToDelete) {
            projectToDelete = this.app.projects.find(p => p.name.toLowerCase() === projectNameToDelete.toLowerCase());
        }

        if (!projectToDelete) {
            const projectListText = this.app.projects.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
            const promptMessage = `Which project would you like to delete? Please provide the exact name or number from the list below:\n\n${projectListText}`;

            projectNameToDelete = await this.app.showCustomPrompt(
                'Delete Project',
                promptMessage
            );

            if (!projectNameToDelete) {
                this.app.addMessage('assistant', 'Project deletion cancelled.');
                return;
            }
            projectNameToDelete = projectNameToDelete.trim();

            projectToDelete = this.app.projects.find(p => p.name.toLowerCase() === projectNameToDelete.toLowerCase());
            if (projectToDelete) {
                await this.app.deleteProjectEntry(projectToDelete.id);
                this.app.addMessage('assistant', `Project "${projectToDelete.name}" has been deleted.`);
            } else {
                const projectIndex = parseInt(projectNameToDelete) - 1;
                if (!isNaN(projectIndex) && projectIndex >= 0 && projectIndex < this.app.projects.length) {
                    projectToDelete = this.app.projects[projectIndex];
                    await this.app.deleteProjectEntry(projectToDelete.id);
                    this.app.addConsoleMessage('info', `Project "${projectToDelete.name}" has been deleted.`);
                    this.app.addMessage('assistant', `Project "${projectToDelete.name}" has been deleted.`);
                } else {
                    this.app.addMessage('assistant', 'Project not found. Deletion cancelled.');
                }
            }
        } else {
            await this.app.deleteProjectEntry(projectToDelete.id);
            this.app.addConsoleMessage('info', `Project "${projectToDelete.name}" has been deleted.`);
            this.app.addMessage('assistant', `Project "${projectToDelete.name}" has been deleted.`);
        }
    }

    generateIntelligentErrorResponse(error, userMessage) {
        const intent = this.extractIntent(userMessage);
        const skillLevel = this.conversationContext.projectAnalysis?.userSkillLevel || 'beginner';

        let baseMessage = "I encountered an issue processing your request. ";

        if (error instanceof SyntaxError && error.message.includes('JSON')) {
            baseMessage += "There was a communication error with my reasoning system. ";
        } else if (error.message.includes('API') || error.message.includes('fetch')) {
            baseMessage += "I'm having connectivity issues. ";
        } else if (error.message.includes('websim')) {
            baseMessage += "There was an issue with the AI service. ";
        } else {
            baseMessage += "An unexpected error occurred. ";
        }

        switch (intent) {
            case 'create':
                baseMessage += "Try describing what you'd like me to build in more detail - for example, 'Create a responsive contact form with validation.'";
                break;
            case 'debug':
                baseMessage += "Please share the specific error message or describe what's not working as expected.";
                break;
            case 'modify':
                baseMessage += "Let me know which file you'd like to change and what specific modifications you need.";
                break;
            case 'explain':
                baseMessage += "Ask me about specific concepts, code patterns, or DevSpark AI features you'd like to understand.";
                break;
            case 'create_project':
                baseMessage += "To create a project, simply ask me to 'create a new project' or 'make a project named \"My Awesome App\"'.";
                break;
            case 'delete_project':
                baseMessage += "To delete a project, tell me 'delete project \"Project Name\"'. I will ask for confirmation.";
                break;
            case 'generate_image':
                baseMessage += "I'm having trouble generating images right now. Please describe the image you want in simpler terms, or try again later.";
                break;
            case 'generate_video':
                baseMessage += "I'm currently having difficulty generating videos. Please try a simpler prompt or try again later.";
                break;
            default:
                if (skillLevel === 'beginner') {
                    baseMessage += "Feel free to ask me to create websites, fix code, or explain concepts in detail.";
                } else {
                    baseMessage += "Please rephrase your request with more specific technical details.";
                }
        }

        return baseMessage;
    }

    extractFallbackResponse(rawContent) {
        try {
            const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return {
                message: "I apologize, but I had trouble formatting my response properly. Could you please try rephrasing your request?",
                files: {}
            };
        } catch (e) {
            return null;
        }
    }

    trackCodePatterns(content) {
        const patterns = [
            'addEventListener', 'querySelector', 'fetch', 'async/await',
            'CSS Grid', 'Flexbox', 'custom properties', 'ES6 modules',
            'Arrow functions', 'Template literals', 'Destructuring'
        ];

        patterns.forEach(pattern => {
            if (content.toLowerCase().includes(pattern.toLowerCase())) {
                this.conversationContext.codePatterns.add(pattern);
            }
        });

        if (this.conversationContext.codePatterns.size > 20) {
            const patterns = Array.from(this.conversationContext.codePatterns);
            this.conversationContext.codePatterns = new Set(patterns.slice(-20));
        }
    }

    updateUserPreferences(userMessage, aiResponse) {
        const preferences = this.conversationContext.userPreferences;

        if (aiResponse.message.length > 200) {
            preferences.prefersDetailedResponses = (preferences.prefersDetailedResponses || 0) + 1;
        } else {
            preferences.prefersConciseResponses = (preferences.prefersConciseResponses || 0) + 1;
        }

        const technicalTermsInUser = (userMessage.match(/\b(function|variable|array|object|class|method|api|async|component|framework)\b/gi) || []).length;
        if (technicalTermsInUser > 2) {
            preferences.usesTechnicalLanguage = (preferences.usesTechnicalLanguage || 0) + 1;
        }

        if (Object.keys(aiResponse.files).length > 0) {
            Object.keys(aiResponse.files).forEach(filename => {
                const ext = filename.split('.').pop();
                preferences[`creates_${ext}`] = (preferences[`creates_${ext}`] || 0) + 1;
            });
        }
    }
}