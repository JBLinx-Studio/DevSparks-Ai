// New file: puter-init.js
// Lightweight Puter initializer: checks sign-in on load, shows a clickable sign-in banner if needed,
// initializes a user folder, writes a last-login KV entry, and exposes testing/migration helpers.

// Persist Puter sign-in into localStorage so sessions survive page reloads (frontend-only persistence)
/* @tweakable [interactive sign-in timeout in ms] */
const SIGNIN_TIMEOUT_MS = 30000;
/* @tweakable [base folder for user data in Puter FS] */
const USER_FOLDER_BASE = 'devsparks';
/* @tweakable [postMessage sign-in timeout in ms] */
const PUTER_POSTMESSAGE_SIGNIN_TIMEOUT_MS = 30000;

/* @tweakable [How long (ms) to keep the "Signing in…" bottom notice before reverting to Not connected if no sign-in confirmation arrives] */
const PUTER_SIGNING_REVERT_MS = 12000; // <--- added tweakable so user can tune revert behavior

// tweakable: make the status badge require an authenticated user to show green connected state
/* @tweakable [If true, Puter status badge shows green on SDK init even without an authenticated user] */
const PUTER_REQUIRE_AUTH_FOR_CONNECTED_BADGE = true;

/* @tweakable [When true, broadcast sign-in to parent frame via postMessage so host iframe and parent stay in sync] */
const PUTER_BROADCAST_SIGNIN_TO_PARENT = true;

/* @tweakable [CSS selector ID for bottom Puter notice element — unify with App and allow tuning] */
const PUTER_BOTTOM_NOTICE_ID = 'puterBottomNotice';
/* @tweakable [z-index for the bottom Puter notice (should be below modal overlays)] */
const PUTER_BOTTOM_NOTICE_ZINDEX = 700;
/* @tweakable [Make bottom Puter notice square edged when true] */
const PUTER_BOTTOM_NOTICE_SQUARE = true;

// Replace initial PUTER lookup to prefer PuterShim/PuterService and avoid double interactive sign-in
(async function puterInit() {
  // Prefer a safe, single integration surface:
  // 1) PuterShim (integration shim created by puter_integration.js)
  // 2) PuterService (friendly wrapper)
  // 3) native window.Puter (SDK)
  const PUTER = window.PuterShim || window.PuterService || window.Puter || null;
  let statusEl = document.getElementById('puter-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = PUTER_BOTTOM_NOTICE_ID; // unified bottom notice id
    /* Make the status badge square-edged and consistent with app theme */
    /* @tweakable [Puter status badge CSS - keep sharp corners when true] */
    statusEl.style.cssText = `position:fixed;right:12px;bottom:12px;padding:8px 12px;${PUTER_BOTTOM_NOTICE_SQUARE ? 'border-radius:0;' : 'border-radius:6px;'}background:#d33;color:#fff;z-index:${PUTER_BOTTOM_NOTICE_ZINDEX};font-family:system-ui;cursor:pointer;pointer-events:auto;`;
    statusEl.innerText = 'Puter: initializing...';
    document.body.appendChild(statusEl);
  }

  function setStatus(text, ok = false) {
    statusEl.innerText = text;
    statusEl.style.background = ok ? '#0aa' : '#d33';
    statusEl.title = text;
    try {
      const cloudEl = document.getElementById('cloudStorageStatus');
      if (cloudEl) cloudEl.textContent = ok ? text.replace(/^Puter:/,'Cloud Storage: Connected (Puter.AI') : 'Cloud Storage: Local (Puter.AI not connected)', cloudEl.className = ok ? 'cloud-storage-status connected' : 'cloud-storage-status disconnected';
      const optsEl = document.getElementById('puterAccountStatus');
      if (optsEl) optsEl.textContent = text;
    } catch (e) {}
    // emit a shared event so App and other modules can react and keep UI fully synchronized
    try {
      window.dispatchEvent(new CustomEvent('puter:status-updated', { detail: { text, state: ok ? 'connected' : ( /signing/i.test(text) ? 'signing' : 'disconnected' ), cloudText: (ok ? `Cloud Storage: Connected (Puter.AI${(window.PuterShim?.user?.username) ? ` — ${window.PuterShim.user.username}` : ''})` : 'Cloud Storage: Local (Puter.AI not connected)'), accountText: text } }));
    } catch(e){}
    try {
      if (/signing in/i.test(text)) {
        if (window.__PUTER_SIGNING_REVERT_TIMER__) clearTimeout(window.__PUTER_SIGNING_REVERT_TIMER__);
        window.__PUTER_SIGNING_REVERT_TIMER__ = setTimeout(() => {
          const current = statusEl && statusEl.innerText;
          if (current && /signing in/i.test(current)) {
            setStatus('Puter: Not connected (click to sign in)', false);
          }
          window.__PUTER_SIGNING_REVERT_TIMER__ = null;
        }, typeof PUTER_SIGNING_REVERT_MS === 'number' ? PUTER_SIGNING_REVERT_MS : 12000);
      } else {
        if (window.__PUTER_SIGNING_REVERT_TIMER__) { clearTimeout(window.__PUTER_SIGNING_REVERT_TIMER__); window.__PUTER_SIGNING_REVERT_TIMER__ = null; }
      }
    } catch(e){}
  }

  const api = {
    async isSignedIn() {
      try {
        if (window.Puter && window.Puter.auth && typeof window.Puter.auth.isSignedIn === 'function') return window.Puter.auth.isSignedIn();
        if (window.PuterService && window.PuterService.auth) return !!(await window.PuterService.auth.currentUser());
        if (window.Puter && window.Puter.auth && window.Puter.auth.currentUser) return !!window.Puter.auth.currentUser;
      } catch (e) {}
      return false;
    },
    async getUser() {
      try {
        if (window.Puter && window.Puter.auth && typeof window.Puter.auth.getUser === 'function') return window.Puter.auth.getUser();
        if (window.Puter && window.Puter.identity && typeof window.Puter.identity.whoami === 'function') return window.Puter.identity.whoami();
        if (window.PuterService && window.PuterService.auth) return window.PuterService.auth.currentUser();
        return window.Puter?.auth?.currentUser || null;
      } catch (e) { return null; }
    },
    async signIn() {
      if (window.Puter && window.Puter.auth && typeof window.Puter.auth.signIn === 'function') return window.Puter.auth.signIn();
      if (window.PuterService && window.PuterService.auth && typeof window.PuterService.auth.signIn === 'function') return window.PuterService.auth.signIn();
      const url = 'https://puter.com/action/sign-in?embedded_in_popup=true';
      const w = window.open(url, 'PuterSignIn', 'width=900,height=720');
      const start = Date.now();
      while (Date.now() - start < SIGNIN_TIMEOUT_MS) {
        const u = await api.getUser();
        if (u) { try { w?.close(); } catch {} return u; }
        await new Promise(r => setTimeout(r, 800));
      }
      throw new Error('Interactive sign-in timed out or was blocked.');
    },
    async fsMkdir(path) {
      try {
        if (window.Puter && window.Puter.fs && typeof window.Puter.fs.mkdir === 'function') return window.Puter.fs.mkdir(path);
        if (window.PuterService && window.PuterService.fs && typeof window.PuterService.fs.mkdir === 'function') return window.PuterService.fs.mkdir(path);
        return true;
      } catch (e) { console.warn('fs.mkdir failed', e); return false; }
    },
    async fsWrite(path, content) {
      try {
        if (window.Puter && window.Puter.fs && typeof window.Puter.fs.writeFile === 'function') return window.Puter.fs.writeFile(path, content);
        if (window.PuterService && window.PuterService.fs && typeof window.PuterService.fs.writeFile === 'function') return window.PuterService.fs.writeFile(path, content);
        if (window.Puter && window.Puter.fs && typeof window.Puter.fs.write === 'function') return window.Puter.fs.write(path, content);
      } catch (e) { console.warn('fs.write fallback failed', e); }
      throw new Error('No Puter.fs.write available');
    },
    async kvPut(k, v) {
      try {
        if (window.Puter && window.Puter.kv && typeof window.Puter.kv.put === 'function') return window.Puter.kv.put(k, v);
        if (window.PuterService && window.PuterService.kv && typeof window.PuterService.kv.put === 'function') return window.PuterService.kv.put(k, v);
        if (window.Puter && window.Puter.kv && typeof window.Puter.kv.set === 'function') return window.Puter.kv.set(k, v);
      } catch (e) { console.warn('kv put failed', e); }
      try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch { return false; }
    },
    async kvGet(k) {
      try {
        if (window.Puter && window.Puter.kv && typeof window.Puter.kv.get === 'function') return window.Puter.kv.get(k);
        if (window.PuterService && window.PuterService.kv && typeof window.PuterService.kv.get === 'function') return window.PuterService.kv.get(k);
        if (window.Puter && window.Puter.kv && typeof window.Puter.kv.getItem === 'function') return window.Puter.kv.getItem(k);
      } catch (e) { console.warn('kv get failed', e); }
      const v = localStorage.getItem(k); try { return JSON.parse(v); } catch { return v; }
    },
    async aiChat(opts) {
      try {
        if (window.Puter && window.Puter.ai && typeof window.Puter.ai.chat === 'function') return window.Puter.ai.chat(opts);
        if (window.PuterService && window.PuterService.ai && typeof window.PuterService.ai.chat === 'function') return window.PuterService.ai.chat(opts);
        if (window.websim && websim.chat && websim.chat.completions && typeof websim.chat.completions.create === 'function') return websim.chat.completions.create(opts);
      } catch (e) { console.warn('ai chat failed', e); }
      throw new Error('No AI chat provider available');
    }
  };

  try {
    // If a session already persisted via PuterShim, mirror it once and DO NOT trigger any interactive sign-in.
    const stored = localStorage.getItem('puter_session');
    if (stored) {
      const u = JSON.parse(stored);
      if (u) {
        // Mirror into PuterShim and Puter surface but avoid calling signIn flows here to prevent duplicates.
        window.PuterShim = window.PuterShim || {};
        window.PuterShim.user = window.PuterShim.user || u;
        window.Puter = window.Puter || {};
        window.Puter.auth = window.Puter.auth || {};
        window.Puter.auth.currentUser = window.Puter.auth.currentUser || u;
        try { window.dispatchEvent(new CustomEvent('puter:signin', { detail: u })); } catch(e){}
      }
    }
  } catch (e) {}

  async function afterSignInInit(user) {
    try {
      const id = user?.id || user?.sub || user?.username || user?.name || 'user';
      const folder = `${USER_FOLDER_BASE}/${id}`;
      await api.fsMkdir(folder).catch(() => {});
      await api.kvPut('devsparks_lastLogin', new Date().toISOString()).catch(() => {});
      setStatus(`Puter: Connected (${user?.name || user?.username || id})`, true);
      window.puterUserFolder = folder;
      // persist single canonical session to avoid duplicate sign-in flows
      try { localStorage.setItem('puter_session', JSON.stringify({ id: user?.id, username: user?.username, email: user?.email })); } catch(e){}
      // notify other modules so options modal and bottom badge unify
      try { 
        window.dispatchEvent(new CustomEvent('puter:signin', { detail: user })); 
        // Also mirror explicit host legacy message used by the React host iframe handshake
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'legacy:puter-session', user: { id: user?.id, username: user?.username, email: user?.email } }, '*');
        }
      } catch(e){}
      try { await window.checkAndSetProjectBadge?.(); } catch(e){}
      window.puterTestAI = async (prompt = 'Hello from VisionStack test') => {
        try {
          const result = await api.aiChat({ messages: [{ role: 'user', content: prompt }], json: false });
          return result;
        } catch (e) { console.error('puterTestAI error', e); throw e; }
      };
      window.migrateLocalToPuter = async (opts = {}) => {
        const prefix = opts.prefix || 'project_file:';
        const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
        for (const k of keys) {
          const filename = k.slice(prefix.length);
          const content = localStorage.getItem(k);
          try { await api.fsWrite(`${folder}/${filename}`, content); console.log('migrated', filename); } catch (e) { console.warn('migrate write failed for', filename, e); }
        }
        return true;
      };

      // Broadcast sign-in to parent window (useful when inside Websim iframe)
      try {
        if (PUTER_BROADCAST_SIGNIN_TO_PARENT && window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'legacy:puter-session', user: { id: user?.id, username: user?.username, email: user?.email } }, '*');
        }
      } catch (e) { console.warn('postMessage to parent failed', e); }

    } catch (e) {
      console.error('afterSignInInit error', e);
      setStatus('Puter: Connected — init failed (see console)', false);
    }
  }

  try {
    // Non-interactive checks: if a user is already known via PuterShim/PuterService, initialize and return.
    const shimUser = window.PuterShim?.user || null;
    const nonInteractiveSigned = await api.isSignedIn().catch(()=>false);
    if (shimUser || nonInteractiveSigned) {
      const user = await api.getUser().catch(()=> shimUser || null);
      if (user) { await afterSignInInit(user); return; }
    }
  } catch (e) { console.warn('isSignedIn check failed', e); }

  // Show unobtrusive prompt but avoid auto popups to prevent duplicate sign-in flows.
  setStatus('Puter: Not connected (click to sign in)', false);
  statusEl.onclick = async () => {
    try {
      // use explicit red for signing to indicate action required inside websim
      setStatus('Puter: Signing in…', false);
      const user = await api.signIn();
      if (user) { await afterSignInInit(user); }
      else { 
        // If configured to require auth to show connected, keep it explicit
        if (PUTER_REQUIRE_AUTH_FOR_CONNECTED_BADGE) {
          setStatus('Puter: sign-in incomplete', false);
        } else {
          setStatus('Puter: Connected (session present)', true);
        }
      }
    } catch (err) {
      console.error('Puter signIn failed', err);
      const reason = err?.message || (err && JSON.stringify(err)) || 'Unknown error';
      // Ensure failures show as red and an explicit 'incomplete' state for clarity
      setStatus(`Puter: sign-in failed — ${reason}`, false);
      setTimeout(() => { setStatus('Puter: Not connected (click to sign in)', false); }, 800);
    }
  };

  // Listen for postMessage sign-in confirmations (useful when sign-in occurs in a popup or parent frame,
  // especially inside nested environments like Websim). This will mirror the received user into the local session.
  window.addEventListener('message', async (ev) => {
    try {
      if (!ev?.data) return;
      if (ev.data?.type === 'puter:signin' || ev.data?.type === 'legacy:puter-session' || ev.data?.type === 'puter:whoami') {
        const u = ev.data.user || ev.data.who || ev.data.detail || null;
        if (u) {
          await afterSignInInit(u);
        }
      }
    } catch (err) { console.warn('postMessage sign-in handler error', err); }
  }, false);

  // Listen for host->iframe session messages so iframe can accept parent sign-in (enables sign-in while inside Websim)
  window.addEventListener('message', (ev) => {
    try {
      if (!ev?.data) return;
      if (ev.data.type === 'host:puter-session' || ev.data.type === 'legacy:puter-session') {
        const u = ev.data.user || ev.data.detail || null;
        if (u) {
          // mirror into local storage and trigger local UI update without forcing another sign-in popup
          try { localStorage.setItem('puter_session', JSON.stringify(u)); } catch(e){}
          // apply immediate UI updates
          const optsEl = document.getElementById('puterAccountStatus');
          const detailsEl = document.getElementById('puterAccountDetails');
          if (optsEl) optsEl.textContent = `Puter: Connected — ${u.username || u.id}`;
          if (detailsEl) { detailsEl.style.display = 'block'; detailsEl.textContent = `ID: ${u.id || 'N/A'}${u.email ? ` | Email: ${u.email}` : ''}`; }
          // notify app modules
          try { window.dispatchEvent(new CustomEvent('puter:signin', { detail: u })); } catch(e){}
          // update badge
          try { window.checkAndSetProjectBadge?.(); } catch(e){}
        }
      }
    } catch(e){}
  }, false);

  // Mirror puter:signin events into DOM so all UI pieces update in-sync
  window.addEventListener('puter:signin', (ev) => {
    try {
      const user = ev?.detail || null;
      if (!user) return;
      // Mark connected with green background and ensure storage badge flips to connected state
      setStatus(`Puter: Connected (${user.username || user.name || user.id})`, true);
      const cloudEl = document.getElementById('cloudStorageStatus');
      if (cloudEl) cloudEl.textContent = `Cloud Storage: Connected (Puter.AI${user.username ? ` - ${user.username}` : ''})`, cloudEl.className = 'cloud-storage-status connected';
      const optsEl = document.getElementById('puterAccountStatus');
      if (optsEl) optsEl.textContent = `Puter: Connected — ${user.username || user.id}`;
      const detailsEl = document.getElementById('puterAccountDetails');
      if (detailsEl) { detailsEl.style.display = 'block'; detailsEl.textContent = `ID: ${user.id || 'N/A'}${user.email ? ` | Email: ${user.email}` : ''}`; }
      // Also ensure the bottom notice element exists and mirrors the same state (keeps a single source of truth)
      try {
        const bottom = document.getElementById(PUTER_BOTTOM_NOTICE_ID);
        if (bottom) {
          bottom.textContent = `Puter: Connected — ${user.username || user.id}`;
          bottom.className = 'puter-bottom-notice connected';
          bottom.style.zIndex = PUTER_BOTTOM_NOTICE_ZINDEX;
        }
      } catch(e){}
    } catch (e) { console.warn('puter:signin mirror failed', e); }
  });

  window.getPreferredModel = async function() {
    try {
      if (window.Puter && window.Puter.kv && typeof window.Puter.kv.get === 'function') {
        const v = await window.Puter.kv.get('preferredModel'); if (v) return v;
      }
      if (window.PuterService && window.PuterService.kv && typeof window.PuterService.kv.get === 'function') {
        const v = await window.PuterService.kv.get('preferredModel'); if (v) return v;
      }
    } catch (e) { console.warn('getPreferredModel kv.get failed', e); }
    return localStorage.getItem('preferredModel') || 'gpt-5-nano';
  };

  window.setPreferredModel = async function(model) {
    try {
      if (window.Puter && window.Puter.kv && typeof window.Puter.kv.put === 'function') {
        await window.Puter.kv.put('preferredModel', model);
      } else if (window.PuterService && window.PuterService.kv && typeof window.PuterService.kv.put === 'function') {
        await window.PuterService.kv.put('preferredModel', model);
      } else {
        localStorage.setItem('preferredModel', model);
      }
      return true;
    } catch (e) {
      console.error('setPreferredModel failed', e);
      try { localStorage.setItem('preferredModel', model); } catch {}
      return false;
    }
  };

  window.checkAndSetProjectBadge = async function() {
    try {
      const signed = await api.isSignedIn().catch(()=>false);
      const statusEl = document.getElementById('cloudStorageStatus');
      if (!statusEl) return;
      // If not signed show explicit disconnected (red-like) state so users notice it's not connected
      if (!signed) { statusEl.textContent = 'Cloud Storage: Local (Puter.AI not connected)'; statusEl.className = 'cloud-storage-status disconnected'; return; }
      const user = await api.getUser();
      const folder = `devsparks/${user?.id || user?.sub || user?.username || 'user'}`;
      try { await api.fsMkdir(folder); } catch(e){}
      statusEl.textContent = `Cloud Storage: Connected (Puter.AI${user?.username ? ` - ${user.username}` : ''})`; statusEl.className = 'cloud-storage-status connected';
    } catch (e) {
      console.error('checkAndSetProjectBadge', e);
      const statusEl = document.getElementById('cloudStorageStatus');
      if (statusEl) { statusEl.textContent = 'Cloud Storage: Local (Puter.AI not connected)'; statusEl.className = 'cloud-storage-status disconnected'; }
    }
  };

  window.__puterInit = { statusEl, setStatus };
  try { window.checkAndSetProjectBadge?.(); } catch(e){}
})();

// Ensure bottom notice is interactive and kept in sync with global events (prevents stuck "Signing in..." state)
function ensureBottomNoticeBehavior() {
  try {
    const id = PUTER_BOTTOM_NOTICE_ID;
    const bottom = document.getElementById(id);
    if (!bottom) return;

    // Click triggers the unified sign-in flow (same as options button)
    bottom.addEventListener('click', async () => {
      try {
        // use explicit red for signing to indicate action required inside websim
        setStatus('Puter: Signing in…', false);
        const user = await api.signIn();
        if (user) { await afterSignInInit(user); }
      } catch (err) {
        console.warn('Bottom notice sign-in failed:', err);
        setStatus('Puter: Not connected (click to sign in)', false);
      }
    });

    // Listen to unified status updates broadcast by other modules and mirror them immediately
    window.addEventListener('puter:status-updated', (ev) => {
      try {
        const d = ev.detail || {};
        if (!d || !bottom) return;
        bottom.textContent = d.text || bottom.textContent;
        bottom.className = `puter-bottom-notice ${d.state || 'disconnected'}`;
        // clear any lingering signing revert timer when explicit connected/disconnected arrives
        if (window.__PUTER_SIGNING_REVERT_TIMER__ && d.state && d.state !== 'signing') {
          clearTimeout(window.__PUTER_SIGNING_REVERT_TIMER__);
          window.__PUTER_SIGNING_REVERT_TIMER__ = null;
        }
      } catch (e) { console.warn('puter:status-updated handler error', e); }
    }, false);

    // Ensure when a puter:signin event occurs we immediately set connected state on bottom notice
    window.addEventListener('puter:signin', (ev) => {
      try {
        const user = ev?.detail || null;
        if (!user) return;
        bottom.textContent = `Puter: Connected — ${user.username || user.id}`;
        bottom.className = 'puter-bottom-notice connected';
        if (window.__PUTER_SIGNING_REVERT_TIMER__) { clearTimeout(window.__PUTER_SIGNING_REVERT_TIMER__); window.__PUTER_SIGNING_REVERT_TIMER__ = null; }
      } catch (e) { console.warn('puter:signin mirror failed', e); }
    }, false);

    // NEW: mirror host modal open/close to ensure notice z-index matches app overlays
    window.addEventListener('modal:open', () => {
      try { bottom.style.zIndex = PUTER_BOTTOM_NOTICE_ZINDEX - 100; } catch(e) {}
    });
    window.addEventListener('modal:close', () => {
      try { bottom.style.zIndex = PUTER_BOTTOM_NOTICE_ZINDEX; } catch(e) {}
    });

  } catch (e) { console.warn('ensureBottomNoticeBehavior failed', e); }
}

// Attach behavior once DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  ensureBottomNoticeBehavior();
} else {
  document.addEventListener('DOMContentLoaded', ensureBottomNoticeBehavior);
}