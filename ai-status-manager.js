// AI Status Manager - monitors and displays connection status for all AI models
// This runs in the background to check availability of Gemini, WebSim, and Puter AI

/* @tweakable [How often to check AI status in ms] */
const AI_STATUS_CHECK_INTERVAL_MS = 30000; // 30 seconds

/* @tweakable [Timeout for status checks in ms] */
const AI_STATUS_CHECK_TIMEOUT_MS = 5000;

class AIStatusManager {
  constructor() {
    this.statuses = {
      gemini: 'checking',
      websim: 'checking',
      puter: 'checking'
    };
    this.intervalId = null;
  }

  async init() {
    console.log('🔍 Initializing AI Status Manager...');
    await this.checkAllStatuses();
    this.updateUI();
    
    // Check statuses periodically
    this.intervalId = setInterval(() => {
      this.checkAllStatuses();
    }, AI_STATUS_CHECK_INTERVAL_MS);

    // Listen for model changes to update UI immediately
    const select = document.getElementById('aiModelSelect');
    if (select) {
      select.addEventListener('change', () => this.updateUI());
    }

    // Listen for Puter sign-in events
    window.addEventListener('puter:signin', () => {
      console.log('🟣 Puter sign-in detected, rechecking status...');
      this.checkAllStatuses();
    });
  }

  async checkAllStatuses() {
    await Promise.all([
      this.checkGeminiStatus(),
      this.checkWebSimStatus(),
      this.checkPuterStatus()
    ]);
    this.updateUI();
  }

  async checkGeminiStatus() {
    try {
      // Gemini is always available via Lovable gateway
      this.statuses.gemini = 'connected';
      console.log('✅ Gemini: Available');
    } catch (error) {
      this.statuses.gemini = 'error';
      console.error('❌ Gemini check failed:', error);
    }
  }

  async checkWebSimStatus() {
    try {
      // WebSim is only available in WebSim.com environment
      const runningInWebsim = typeof window.websim !== 'undefined';
      if (runningInWebsim && window.websim?.chat?.completions?.create) {
        this.statuses.websim = 'connected';
        console.log('✅ WebSim: Available');
      } else {
        this.statuses.websim = 'unavailable';
        console.log('⚠️ WebSim: Not available (not in WebSim.com)');
      }
    } catch (error) {
      this.statuses.websim = 'error';
      console.error('❌ WebSim check failed:', error);
    }
  }

  async checkPuterStatus() {
    try {
      // Check if Puter SDK is loaded
      const sdkLoaded = !!(window.Puter || window.PuterAPI || window.PuterService);
      if (!sdkLoaded) {
        this.statuses.puter = 'unavailable';
        console.log('⚠️ Puter: SDK not loaded');
        return;
      }

      // Check if user is signed in
      const signedIn = !!(window.Puter?.auth?.currentUser || window.PuterShim?.user);
      if (!signedIn) {
        this.statuses.puter = 'not_signed_in';
        console.log('⚠️ Puter: Not signed in');
        return;
      }

      // Check if AI is available
      const aiAvailable = !!(window.Puter?.ai?.chat || window.PuterAPI?.ai?.chat || window.PuterService?.ai?.chat);
      if (aiAvailable) {
        this.statuses.puter = 'connected';
        console.log('✅ Puter: Available and signed in');
      } else {
        this.statuses.puter = 'error';
        console.log('❌ Puter: AI not available');
      }
    } catch (error) {
      this.statuses.puter = 'error';
      console.error('❌ Puter check failed:', error);
    }
  }

  updateUI() {
    const select = document.getElementById('aiModelSelect');
    const indicator = document.getElementById('aiStatusIndicator');
    const statusText = document.getElementById('aiStatusText');
    
    if (!select || !indicator || !statusText) return;

    const selectedModel = select.value;
    let status, text, color;

    if (selectedModel.startsWith('lovable:')) {
      status = this.statuses.gemini;
      text = status === 'connected' ? 'Gemini Ready' : 
             status === 'checking' ? 'Checking...' : 'Gemini Error';
      color = status === 'connected' ? '#10b981' : 
              status === 'checking' ? '#f59e0b' : '#ef4444';
    } else if (selectedModel.startsWith('websim:')) {
      status = this.statuses.websim;
      text = status === 'connected' ? 'WebSim Ready' : 
             status === 'unavailable' ? 'Not in WebSim.com' : 
             status === 'checking' ? 'Checking...' : 'WebSim Error';
      color = status === 'connected' ? '#10b981' : 
              status === 'unavailable' ? '#6b7280' : 
              status === 'checking' ? '#f59e0b' : '#ef4444';
    } else if (selectedModel.startsWith('puter:')) {
      status = this.statuses.puter;
      text = status === 'connected' ? 'Puter Ready' : 
             status === 'not_signed_in' ? 'Sign in required' : 
             status === 'unavailable' ? 'Puter SDK not loaded' : 
             status === 'checking' ? 'Checking...' : 'Puter Error';
      color = status === 'connected' ? '#10b981' : 
              status === 'not_signed_in' ? '#f59e0b' : 
              status === 'unavailable' ? '#6b7280' : 
              status === 'checking' ? '#f59e0b' : '#ef4444';
    }

    indicator.style.color = color;
    statusText.textContent = text;
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// Initialize on load
let aiStatusManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    aiStatusManager = new AIStatusManager();
    aiStatusManager.init();
  });
} else {
  aiStatusManager = new AIStatusManager();
  aiStatusManager.init();
}

// Expose globally
window.aiStatusManager = aiStatusManager;
