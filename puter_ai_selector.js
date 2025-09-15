// Enhanced AI model selector UI — searchable, grouped, icons, presets, keyboard nav, saves to Puter KV + localStorage
// Comprehensive list of available AI models including Puter's free offerings
const MODELS = [
  // Puter.AI Free Models (comprehensive list)
  {id: 'puter:gpt-5', label: 'GPT-5', provider: 'Puter.AI', desc: 'Latest OpenAI model - free via Puter', category: 'puter'},
  {id: 'puter:gpt-4o', label: 'GPT-4o', provider: 'Puter.AI', desc: 'Advanced OpenAI model - free via Puter', category: 'puter'},
  {id: 'puter:claude-4-sonnet', label: 'Claude 4 Sonnet', provider: 'Puter.AI', desc: 'Advanced Claude model - free via Puter', category: 'puter'},
  {id: 'puter:claude-4-opus', label: 'Claude 4 Opus', provider: 'Puter.AI', desc: 'Most capable Claude model - free via Puter', category: 'puter'},
  {id: 'puter:deepseek-chat', label: 'DeepSeek Chat', provider: 'Puter.AI', desc: 'Advanced reasoning model - free via Puter', category: 'puter'},
  {id: 'puter:deepseek-reasoner', label: 'DeepSeek Reasoner', provider: 'Puter.AI', desc: 'Complex reasoning specialist - free via Puter', category: 'puter'},
  {id: 'puter:gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Puter.AI', desc: 'Fast Google model - free via Puter', category: 'puter'},
  {id: 'puter:llama-3.3-70b', label: 'Llama 3.3 70B', provider: 'Puter.AI', desc: 'Meta\'s powerful model - free via Puter', category: 'puter'},
  {id: 'puter:openrouter-auto', label: 'OpenRouter Auto', provider: 'Puter.AI', desc: 'Best available model - free via Puter', category: 'puter'},

  // WebSim Fallback Models
  {id: 'websim:gpt-5-nano', label: 'GPT-5 Nano', provider: 'WebSim', desc: 'Fast, efficient assistant', category: 'websim'},
  {id: 'websim:gpt-5-mini', label: 'GPT-5 Mini', provider: 'WebSim', desc: 'Balanced speed & quality', category: 'websim'},
  {id: 'websim:claude', label: 'Claude (WebSim)', provider: 'WebSim', desc: 'Helpful instruction-following', category: 'websim'},

  // Custom/Other
  {id: 'custom', label: 'Custom Model', provider: 'Custom', desc: 'User-defined model endpoint', category: 'other'}
];

/* @tweakable [Labels for selector groups: shown as headings inside the model list] */
const AI_SELECTOR_GROUP_LABELS = {
  puter: '🟢 Puter.AI (Free & Unlimited)',
  websim: '🔄 WebSim (Fallback)',
  other: '⚙️ Custom & Other'
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
  const container = document.getElementById('ai-model-selector');
  const currentBadge = document.getElementById('ai-model-badge');
  const panel = document.getElementById('ai-model-menu');
  
  if (!container || !currentBadge || !panel) return;

  // Clear existing content in panel
  panel.innerHTML = '';
  panel.style.display = 'none';

  // search input
  const search = document.createElement('input');
  search.className = 'form-select';
  search.placeholder = 'Search models (type to filter)...';
  search.style.width = '100%';
  search.style.marginBottom = '8px';
  search.style.fontSize = '14px';
  panel.appendChild(search);

  // list container
  const list = document.createElement('div');
  list.style.maxHeight = '240px';
  list.style.overflow = 'auto';
  panel.appendChild(list);

  // footer: add custom model
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.gap = '8px';
  footer.style.marginTop = '8px';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-secondary btn-sm';
  addBtn.textContent = 'Add Custom Model';
  footer.appendChild(addBtn);
  panel.appendChild(footer);

  // helpers to render list
  function renderItems(filter='') {
    list.innerHTML = '';
    // categorize models by their category
    const groups = { puter: [], websim: [], other: [] };
    MODELS.forEach(m=>{
      if (filter && !`${m.label} ${m.provider} ${m.desc} ${m.id}`.toLowerCase().includes(filter.toLowerCase())) return;
      const category = m.category || 'other';
      if (groups[category]) {
        groups[category].push(m);
      } else {
        groups.other.push(m);
      }
    });

    const appendGroup = (title, items) => {
      if (!items || items.length === 0) return;
      const heading = document.createElement('div');
      heading.textContent = title;
      heading.style.fontWeight = 700;
      heading.style.padding = '8px';
      heading.style.fontSize = '12px';
      heading.style.color = 'var(--color-text-medium)';
      heading.style.borderBottom = '1px solid rgba(0,0,0,0.04)';
      list.appendChild(heading);
      items.forEach(m=>{
        const row = document.createElement('div');
        row.className = 'ai-model-row';
        row.tabIndex = 0;
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px';
        row.style.cursor = 'pointer';
        row.style.gap = '8px';
        row.dataset.id = m.id;
        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.flexDirection = 'column';
        const name = document.createElement('div');
        name.textContent = m.label;
        name.style.fontWeight = 600;
        const desc = document.createElement('div');
        desc.textContent = m.desc || m.id;
        desc.style.fontSize = '12px';
        desc.style.color = 'var(--color-text-medium)';
        left.appendChild(name); left.appendChild(desc);
        const badge = document.createElement('div');
        badge.style.fontSize = '12px';
        badge.style.color = 'var(--color-text-light)';
        badge.textContent = m.id === 'dall-e-3' ? 'images' : '';
        row.appendChild(left);
        row.appendChild(badge);
        row.addEventListener('click', () => selectModel(m.id));
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter') selectModel(m.id); });
        list.appendChild(row);
      });
      // separator between groups
      const sep = document.createElement('div');
      sep.style.height = '8px';
      list.appendChild(sep);
    };

    // order: Puter.AI (prioritized), WebSim, then Other
    appendGroup(AI_SELECTOR_GROUP_LABELS.puter, groups.puter);
    appendGroup(AI_SELECTOR_GROUP_LABELS.websim, groups.websim);
    appendGroup(AI_SELECTOR_GROUP_LABELS.other, groups.other);

    if (!list.children.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No models found';
      empty.style.padding = '12px';
      empty.style.color = 'var(--color-text-medium)';
      list.appendChild(empty);
    }
  }

  // selection logic
  async function loadPreferred() {
    let pref = 'puter:gpt-5'; // Default to Puter's best free model
    try { pref = (window.getPreferredModel && await window.getPreferredModel()) || localStorage.getItem('preferredModel') || pref; } catch {}
    const found = MODELS.find(m=>m.id===pref) || MODELS[0];
    updateBadge(found);
    return found;
  }
  function updateBadge(m) {
    const badgeLabel = document.getElementById('ai-model-badge-label');
    if (badgeLabel) {
      badgeLabel.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9"/>
        </svg>
        <span style="font-weight:600;">${m.label}</span>
        <span style="opacity:0.7;font-size:12px;">${m.provider}</span>
      `;
    }
  }
  async function selectModel(id) {
    const model = MODELS.find(m=>m.id===id);
    if (!model) return;
    try { if (window.setPreferredModel) await window.setPreferredModel(id); else localStorage.setItem('preferredModel', id); } catch {}
    updateBadge(model);
    panel.style.display = 'none';
    currentBadge.setAttribute('aria-expanded','false');
    currentBadge.focus();
    currentBadge.classList.add('loading');
    setTimeout(()=>currentBadge.classList.remove('loading'), 650);
    window.__lastSelectedModel = model;
    console.info('Preferred model set to', id);

    // Apply speaking style hint to global app (chatManager should listen for this)
    const suggestedStyle = MODEL_SPEECH_MAP[id] || 'casual';
    try {
      // setPreferredAssistantStyle is optional hook consumed by chatManager/app
      if (window.setPreferredAssistantStyle) window.setPreferredAssistantStyle(suggestedStyle);
      // also expose on window for ad-hoc use and debugging
      window.__preferredAssistantStyle = suggestedStyle;
      console.info('Assistant speaking style set to', suggestedStyle);
    } catch(e){ console.warn('Failed to set assistant style', e); }
  }

  // interactions
  currentBadge.addEventListener('click', (e)=> {
    const open = panel.style.display === 'block';
    panel.style.display = open ? 'none' : 'block';
    currentBadge.setAttribute('aria-expanded', String(!open));
    if (!open) { 
      search.focus(); 
      renderItems(search.value); 
    }
  });
  search.addEventListener('input', ()=> renderItems(search.value));
  document.addEventListener('click', (e)=> { 
    if (!container.contains(e.target)) {
      panel.style.display = 'none';
      currentBadge.setAttribute('aria-expanded', 'false');
    }
  });

  addBtn.addEventListener('click', async ()=> {
    const custom = prompt('Enter custom model id (e.g. myorg/gpt-xyz)'); if (!custom) return;
    const label = prompt('Label for this model', custom) || custom;
    const entry = { id: custom, label, provider: 'Custom', desc: 'User added' };
    MODELS.unshift(entry);
    await selectModel(custom);
    renderItems(search.value);
  });

  // keyboard: open with Alt+M, cycle with arrow keys when open
  document.addEventListener('keydown', (e)=> {
    if (e.altKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); currentBadge.click(); }
    if (panel.style.display === 'block') {
      const rows = Array.from(list.querySelectorAll('.ai-model-row'));
      const active = document.activeElement;
      if (e.key === 'ArrowDown') { e.preventDefault(); const idx = rows.indexOf(active); const next = rows[Math.min(rows.length-1, Math.max(0, idx+1))] || rows[0]; next.focus(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); const idx = rows.indexOf(active); const prev = rows[Math.max(0, idx-1)] || rows[rows.length-1]; prev.focus(); }
      if (e.key === 'Escape') { panel.style.display = 'none'; currentBadge.focus(); }
    }
  });

  // expose helper to list models and pick programmatically
  window.listAvailableModels = () => MODELS.slice();
  window.pickModel = async (id) => selectModel(id);

  // Listen for Puter sign-in events to refresh the selector
  window.addEventListener('puter:signin', () => {
    console.log('Puter signed in, refreshing AI selector...');
    renderItems('');
    loadPreferred();
  });

  // init
  renderItems('');
  loadPreferred();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createSelector);
else createSelector();