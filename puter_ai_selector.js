// Unified AI model selector - WebSim, Puter.AI, and Google Gemini (via Lovable Gateway)
const MODELS = [
  // Google Gemini - FREE Models via Lovable Gateway (Sept 29 - Oct 6)
  {id: 'lovable:gemini-flash', label: 'Gemini 2.5 Flash', provider: 'Google', desc: 'FREE - Fast & balanced (default)', category: 'gemini', isFree: true, status: 'checking'},
  {id: 'lovable:gemini-pro', label: 'Gemini 2.5 Pro', provider: 'Google', desc: 'FREE - Most capable, complex reasoning', category: 'gemini', isFree: true, status: 'checking'},
  {id: 'lovable:gemini-lite', label: 'Gemini 2.5 Lite', provider: 'Google', desc: 'FREE - Ultra-fast, simple tasks', category: 'gemini', isFree: true, status: 'checking'},
  
  // WebSim AI (Only works in WebSim.com environment)
  {id: 'websim:gpt5-nano', label: 'WebSim AI', provider: 'WebSim', desc: 'Only available in WebSim.com', category: 'websim', status: 'checking'},

  // Puter.AI Free Unlimited Models (requires Puter account)
  {id: 'puter:gpt-5', label: 'GPT-5', provider: 'Puter.AI', desc: 'OpenAI GPT-5 via Puter (free)', category: 'puter', status: 'checking'},
  {id: 'puter:claude-sonnet', label: 'Claude Sonnet 4', provider: 'Puter.AI', desc: 'Anthropic Claude via Puter (free)', category: 'puter', status: 'checking'},
  {id: 'puter:deepseek-r1', label: 'DeepSeek R1', provider: 'Puter.AI', desc: 'Advanced reasoning via Puter (free)', category: 'puter', status: 'checking'},
  {id: 'puter:llama-3.3', label: 'Llama 3.3 70B', provider: 'Puter.AI', desc: 'Meta Llama via Puter (free)', category: 'puter', status: 'checking'}
];

/* @tweakable [Labels for selector groups: shown as headings inside the model list] */
const AI_SELECTOR_GROUP_LABELS = {
  gemini: 'Google Gemini (FREE - Limited Time)',
  websim: 'WebSim AI (WebSim.com only)',
  puter: 'Puter.AI (Free with Puter Account)'
};

/* @tweakable [Minimum width for the model badge button (px) — helps align inside header] */
const AI_BADGE_MIN_WIDTH = 220;

/* @tweakable [Search input debounce in milliseconds to reduce re-renders while typing] */
const AI_SEARCH_DEBOUNCE_MS = 120;

/* @tweakable [map of model id -> suggested assistant speaking style used to adapt tone] */
const MODEL_SPEECH_MAP = {
  'gpt-5-nano': 'casual',
  'gpt-5-mini': 'professional',
  'gpt-5-pro': 'analytical',
  'claude': 'educational',
  'gemini': 'creative',
  'dall-e-3': 'images',
  'puter-free': 'casual',
  'puta-3': 'experimental'
};

function createSelector() {
  const select = document.getElementById('aiModelSelect');
  if (!select) {
    console.error('❌ AI Model select element not found!');
    return;
  }
  
  console.log('✓ Initializing AI Model selector...');

  // Clear any existing options
  select.innerHTML = '';

  // Populate select with grouped options
  const groups = { gemini: [], websim: [], puter: [] };
  MODELS.forEach(m => {
    const category = m.category || 'gemini';
    if (groups[category]) groups[category].push(m);
  });
  
  console.log('✓ Grouped models:', { gemini: groups.gemini.length, websim: groups.websim.length, puter: groups.puter.length });

  // Create optgroups matching the AI Thoughts style
  const createOptGroup = (label, items) => {
    if (!items || items.length === 0) {
      console.warn(`⚠️ No items for group: ${label}`);
      return;
    }
    const optgroup = document.createElement('optgroup');
    optgroup.label = label;
    items.forEach(m => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = `${m.label} - ${m.desc}`;
      // no emoji prefixes to keep UI clean
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
    console.log(`✓ Added ${items.length} models to group: ${label}`);
  };

  // Order: Google Gemini FREE first, then WebSim, then Puter
  createOptGroup(AI_SELECTOR_GROUP_LABELS.gemini, groups.gemini);
  createOptGroup(AI_SELECTOR_GROUP_LABELS.websim, groups.websim);
  createOptGroup(AI_SELECTOR_GROUP_LABELS.puter, groups.puter);
  
  console.log(`✓ AI Model selector populated with ${select.options.length} total options`);

  // Load preferred model
  async function loadPreferred() {
    let pref = 'lovable:gemini-flash';
    try { 
      pref = (window.getPreferredModel && await window.getPreferredModel()) || 
             localStorage.getItem('preferredModel') || pref; 
    } catch {}
    const found = MODELS.find(m => m.id === pref) || MODELS[0];
    select.value = found.id;
    window.__lastSelectedModel = found;
    if (window.app && window.app.selectAIProvider) {
      window.app.selectAIProvider(found.id);
    }
    return found;
  }

  // Handle selection change
  select.addEventListener('change', async (e) => {
    const id = e.target.value;
    const model = MODELS.find(m => m.id === id);
    if (!model) return;
    
    try { 
      if (window.setPreferredModel) await window.setPreferredModel(id); 
      else localStorage.setItem('preferredModel', id); 
    } catch {}
    
    window.__lastSelectedModel = model;
    console.info('✓ AI Model changed to:', model.label, `(${model.provider})`);

    // If a Puter model is selected, ensure user is signed in
    if (id.startsWith('puter:')) {
      console.log('🟣 Puter model selected, checking authentication...');
      const signedIn = !!(window.Puter?.auth?.currentUser || window.PuterShim?.user);
      
      if (!signedIn) {
        console.log('🟣 Not signed in, prompting Puter authentication...');
        try {
          // Use PuterShim for consistent sign-in experience
          if (window.PuterShim?.ensureSignedInInteractive) {
            await window.PuterShim.ensureSignedInInteractive();
            console.log('✅ Puter sign-in successful');
          } else if (window.Puter?.auth?.signIn) {
            await window.Puter.auth.signIn();
            console.log('✅ Puter sign-in successful (direct SDK)');
          } else {
            console.error('❌ Puter SDK not available');
            alert('Puter AI requires signing in. Please ensure the Puter SDK is loaded and try again.');
          }
          window.dispatchEvent(new CustomEvent('puter:signin', { detail: window.Puter?.auth?.currentUser || null }));
        } catch (err) {
          console.error('❌ Puter sign-in failed:', err);
          alert(`Puter sign-in was cancelled or failed: ${err.message}\n\nPuter AI models require a free Puter account. Please try again or select a different AI model.`);
          // Revert to Gemini Flash
          select.value = 'lovable:gemini-flash';
          select.dispatchEvent(new Event('change'));
          return;
        }
      } else {
        console.log('✅ Already signed in to Puter');
      }
    }

    // Sync with app.js
    if (window.app && window.app.selectAIProvider) {
      window.app.selectAIProvider(id);
    }

    // Apply speaking style
    const suggestedStyle = MODEL_SPEECH_MAP[id] || 'professional';
    try {
      if (window.setPreferredAssistantStyle) window.setPreferredAssistantStyle(suggestedStyle);
      window.__preferredAssistantStyle = suggestedStyle;
      console.info('Assistant speaking style set to', suggestedStyle);
    } catch(e) { console.warn('Failed to set assistant style', e); }

  });

  // Expose helper functions
  window.listAvailableModels = () => MODELS.slice();
  window.pickModel = async (id) => {
    select.value = id;
    select.dispatchEvent(new Event('change'));
  };

  // Persisted preferences
  window.getPreferredModel = async () => {
    try {
      if (window.PuterAPI?.kv?.get) {
        const v = await window.PuterAPI.kv.get('preferredModel');
        if (v) return v;
      }
    } catch {}
    return localStorage.getItem('preferredModel') || 'lovable:gemini-flash';
  };
  
  window.setPreferredModel = async (id) => {
    try {
      localStorage.setItem('preferredModel', id);
      if (window.PuterAPI?.kv?.put) await window.PuterAPI.kv.put('preferredModel', id);
    } catch {}
    return id;
  };

  // Listen for Puter sign-in events
  window.addEventListener('puter:signin', () => {
    console.log('Puter signed in, refreshing AI selector...');
    loadPreferred();
  });

  // Initialize
  loadPreferred();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createSelector);
else createSelector();