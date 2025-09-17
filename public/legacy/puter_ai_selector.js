// Enhanced AI model selector UI — searchable, grouped, icons, presets, keyboard nav, saves to Puter KV + localStorage
const MODELS = [
  {id: 'gpt-5-nano', label: 'GPT-5 Nano', provider: 'OpenAI', desc: 'Fast, cheap assistant'},
  {id: 'gpt-5-mini', label: 'GPT-5 Mini', provider: 'OpenAI', desc: 'Balanced speed & quality'},
  {id: 'gpt-5-pro', label: 'GPT-5 Pro', provider: 'OpenAI', desc: 'Higher quality responses'},
  {id: 'claude', label: 'Anthropic Claude', provider: 'Anthropic', desc: 'Helpful instruction-following'},
  {id: 'gemini', label: 'Gemini', provider: 'Google', desc: 'Large generalist model'},
  {id: 'dall-e-3', label: 'DALL·E 3', provider: 'OpenAI', desc: 'Image generation'},
  // allow adding "puter" / free models
  {id: 'puter-free', label: 'Puter.AI (free)', provider: 'Puter', desc: 'In-browser free assistant'}
];

/* @tweakable [Labels for selector groups: shown as headings inside the model list] */
const AI_SELECTOR_GROUP_LABELS = {
  site: 'Site / Web AI',
  other: 'Other Providers',
  puter: 'Puter.AI (Account Models)'
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
  if (!container) return;
  container.innerHTML = ''; // clear existing select
  container.classList.add('ai-selector-enhanced');

  const currentBadge = document.createElement('button');
  currentBadge.className = 'btn btn-secondary btn-sm';
  currentBadge.style.display = 'inline-flex';
  currentBadge.style.alignItems = 'center';
  currentBadge.style.gap = '8px';
  currentBadge.setAttribute('aria-haspopup','listbox');

  const label = document.createElement('span');
  label.textContent = 'AI:';
  label.style.fontWeight = 600;
  label.style.fontSize = '13px';
  label.style.marginRight = '6px';
  container.appendChild(label);
  container.appendChild(currentBadge);

  // dropdown panel
  const panel = document.createElement('div');
  panel.className = 'ai-model-panel';
  panel.style.position = 'absolute';
  panel.style.background = 'var(--color-bg-primary)';
  panel.style.border = '1px solid var(--color-border)';
  panel.style.boxShadow = 'var(--shadow-md)';
  panel.style.padding = '8px';
  panel.style.minWidth = '320px';
  panel.style.zIndex = 10000;
  panel.style.display = 'none';
  panel.setAttribute('role','listbox');

  // search
  const search = document.createElement('input');
  search.className = 'form-select';
  search.placeholder = 'Search models (type to filter)...';
  search.style.width = '100%';
  search.style.marginBottom = '8px';
  // enforce badge min width tweakable
  panel.style.minWidth = Math.max(320, AI_BADGE_MIN_WIDTH + 100) + 'px';
  panel.appendChild(search);

  // list
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
    // categorize models into Site/Web, Other providers, and Puter
    const groups = { site: [], other: [], puter: [] };
    MODELS.forEach(m=>{
      if (filter && !`${m.label} ${m.provider} ${m.desc} ${m.id}`.toLowerCase().includes(filter.toLowerCase())) return;
      const providerKey = (m.provider && m.provider.toLowerCase().includes('puter')) ? 'puter' : (m.provider && (m.provider.toLowerCase().includes('openai') || m.provider.toLowerCase().includes('websim') || m.provider.toLowerCase().includes('google'))) ? 'site' : 'other';
      groups[providerKey].push(m);
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

    // order: Site / Web AI, Other Providers, Puter.AI
    appendGroup(AI_SELECTOR_GROUP_LABELS.site, groups.site);
    appendGroup(AI_SELECTOR_GROUP_LABELS.other, groups.other);
    appendGroup(AI_SELECTOR_GROUP_LABELS.puter, groups.puter);

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
    let pref = 'gpt-5-nano';
    try { pref = (window.getPreferredModel && await window.getPreferredModel()) || localStorage.getItem('preferredModel') || pref; } catch {}
    const found = MODELS.find(m=>m.id===pref) || MODELS[0];
    updateBadge(found);
    return found;
  }
  function updateBadge(m) {
    currentBadge.innerHTML = '';
    const span = document.createElement('span'); span.textContent = m.label; span.style.fontWeight = 700;
    const sub = document.createElement('span'); sub.textContent = ` ${m.provider}`; sub.style.opacity = 0.7; sub.style.fontSize = '12px';
    currentBadge.appendChild(span); currentBadge.appendChild(sub);
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
    if (!open) { search.focus(); renderItems(search.value); }
  });
  search.addEventListener('input', ()=> renderItems(search.value));
  document.addEventListener('click', (e)=> { if (!container.contains(e.target)) panel.style.display = 'none'; });

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

  // Persist preferred model in Puter KV when available, else localStorage
  window.getPreferredModel = async () => {
    try {
      if (window.PuterAPI?.kv?.get) {
        const v = await window.PuterAPI.kv.get('preferredModel');
        if (v) return v;
      }
    } catch {}
    return localStorage.getItem('preferredModel') || 'gpt-5-nano';
  };
  window.setPreferredModel = async (id) => {
    try {
      localStorage.setItem('preferredModel', id);
      if (window.PuterAPI?.kv?.put) await window.PuterAPI.kv.put('preferredModel', id);
    } catch {}
    return id;
  };

  // init
  renderItems('');
  loadPreferred();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createSelector);
else createSelector();