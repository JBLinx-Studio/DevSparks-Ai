// Unified AI model selector - WebSim, Puter.AI, and Lovable AI (FREE Gemini!)
const MODELS = [
  // 🆓 Lovable AI - FREE Gemini Models (Sept 29 - Oct 6)
  {id: 'lovable:gemini-flash', label: '⚡ Gemini 2.5 Flash', provider: 'Lovable AI', desc: '🆓 FREE - Fast & balanced (default)', category: 'lovable', isFree: true},
  {id: 'lovable:gemini-pro', label: '🚀 Gemini 2.5 Pro', provider: 'Lovable AI', desc: '🆓 FREE - Most capable, complex reasoning', category: 'lovable', isFree: true},
  {id: 'lovable:gemini-lite', label: '⚡ Gemini 2.5 Lite', provider: 'Lovable AI', desc: '🆓 FREE - Ultra-fast, simple tasks', category: 'lovable', isFree: true},
  
  // WebSim AI (Main)
  {id: 'websim:gpt5-nano', label: 'WebSim AI', provider: 'WebSim', desc: 'Default WebSim assistant', category: 'websim'},

  // Puter.AI Free Unlimited Models
  {id: 'puter:openai', label: 'OpenAI GPT', provider: 'Puter.AI', desc: 'Free unlimited OpenAI via Puter', category: 'puter'},
  {id: 'puter:claude-35-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Puter.AI', desc: 'Free unlimited Claude via Puter', category: 'puter'},
  {id: 'puter:deepseek', label: 'DeepSeek', provider: 'Puter.AI', desc: 'Free unlimited DeepSeek via Puter', category: 'puter'}
];

/* @tweakable [Labels for selector groups: shown as headings inside the model list] */
const AI_SELECTOR_GROUP_LABELS = {
  lovable: '🆓 Lovable AI (FREE Gemini - Limited Time!)',
  websim: '🌐 WebSim AI',
  puter: '🟢 Puter.AI (Free & Unlimited)'
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
  if (!select) return;

  // Populate select with grouped options
  const groups = { lovable: [], websim: [], puter: [] };
  MODELS.forEach(m => {
    const category = m.category || 'websim';
    if (groups[category]) groups[category].push(m);
  });

  // Create optgroups matching the AI Thoughts style
  const createOptGroup = (label, items) => {
    if (!items || items.length === 0) return;
    const optgroup = document.createElement('optgroup');
    optgroup.label = label;
    items.forEach(m => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = `${m.label} - ${m.desc}`;
      if (m.isFree) option.textContent = `🆓 ${option.textContent}`;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  };

  // Order: Lovable AI FREE first
  createOptGroup(AI_SELECTOR_GROUP_LABELS.lovable, groups.lovable);
  createOptGroup(AI_SELECTOR_GROUP_LABELS.websim, groups.websim);
  createOptGroup(AI_SELECTOR_GROUP_LABELS.puter, groups.puter);

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