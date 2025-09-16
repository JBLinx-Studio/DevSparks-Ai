// New file: puter_integration.js
// Lightweight Puter.js integration wrapper to ensure automatic init, sign-in prompt, and helpers.
// Exposes a safe global `PuterShim` and ensures `window.Puter` is available for existing code.

/* @tweakable [how long to wait for SDK to attach in ms] */
const PUTER_SDK_WAIT_MS = 5000;

const PuterShim = {
  ready: null,
  isInitialized: false,
  user: null,
  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      // Wait for Puter SDK to attach to window (if script loaded)
      const maxWait = PUTER_SDK_WAIT_MS;
      const start = Date.now();
      while (!window.Puter && Date.now() - start < maxWait) {
        await new Promise(r => setTimeout(r, 100));
      }
      if (!window.Puter) {
        console.warn('Puter SDK not found after wait. Create a minimal shim to avoid crashes.');
        // Minimal shim to avoid runtime errors in environments without Puter SDK.
        window.Puter = {
          auth: {
            currentUser: null,
            async signIn() { throw new Error('Puter SDK not available'); },
            async signOut() { throw new Error('Puter SDK not available'); },
            onAuthStateChanged() {}
          },
          fs: {
            async writeFile() { throw new Error('Puter.fs not available'); },
            async readFile() { throw new Error('Puter.fs not available'); },
            async listFiles() { return []; },
            async deleteFile() { throw new Error('Puter.fs not available'); },
            async writeJson() { throw new Error('Puter.fs not available'); },
            async readJson() { throw new Error('Puter.fs not available'); },
          },
          kv: {
            async put() { throw new Error('Puter.kv not available'); },
            async get() { return null; },
            async del() { throw new Error('Puter.kv not available'); },
            async incr() { throw new Error('Puter.kv not available'); },
            async decr() { throw new Error('Puter.kv not available'); },
          },
          ai: {
            async chat() { throw new Error('Puter.ai not available'); },
            async txt2img() { throw new Error('Puter.ai not available'); },
            async img2txt() { throw new Error('Puter.ai not available'); },
            async txt2speech() { throw new Error('Puter.ai not available'); },
          },
          host: {}
        };
        return window.Puter;
      }

      // If real SDK present, try init if provided
      try {
        if (typeof window.Puter.init === 'function') {
          await window.Puter.init();
        }
      } catch (e) {
        console.warn('Puter.init() failed or not required:', e?.message || e);
      }

      // Populate currentUser if available — try multiple non-interactive approaches and mirror into window.Puter.auth.currentUser
      try {
        // 1) Prefer direct auth.currentUser if present
        if (window.Puter.auth && window.Puter.auth.currentUser) {
          this.user = window.Puter.auth.currentUser;
        }

        // 2) If nothing, try identity.whoami() (non-interactive). This many SDKs expose it.
        if (!this.user && window.Puter.identity && typeof window.Puter.identity.whoami === 'function') {
          try {
            const who = await window.Puter.identity.whoami().catch(() => null);
            if (who) this.user = who;
          } catch (e) { /* ignore */ }
        }

        // 3) As a last resort, if Puter.auth exposes a synchronous getter, re-check
        if (!this.user && window.Puter.auth && window.Puter.auth.currentUser) {
          this.user = window.Puter.auth.currentUser;
        }

        // Mirror detected user into SDK surface so app modules relying on window.Puter.auth.currentUser get updated
        if (this.user) {
          window.Puter.auth = window.Puter.auth || {};
          window.Puter.auth.currentUser = this.user;
          // Emit a sign-in event so any listeners (App, managers) can react immediately
          try { window.dispatchEvent(new CustomEvent('puter:signin', { detail: this.user })); } catch(e) {}
        } else {
          // NEW: try additional SDK variations for getting current user to handle different Puter.js versions
          try {
            if (!this.user && window.Puter && window.Puter.auth && typeof window.Puter.auth.getCurrentUser === 'function') {
              const u2 = await window.Puter.auth.getCurrentUser().catch(() => null);
              if (u2) {
                this.user = u2;
                window.Puter.auth.currentUser = u2;
                try { window.dispatchEvent(new CustomEvent('puter:signin', { detail: u2 })); } catch(e) {}
              }
            }
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        /* ignore */
      }

      // Ensure UI is updated immediately if we found a user
      try { updateCloudStatusUI(); } catch(e) {}

      // If SDK supports auth state hook, forward to update UI
      try {
        if (window.Puter.auth && typeof window.Puter.auth.onAuthStateChanged === 'function') {
          window.Puter.auth.onAuthStateChanged((u) => {
            PuterShim.user = u || null;
            updateCloudStatusUI();
          });
        }
      } catch (e) { /* ignore */ }

      this.isInitialized = true;
      updateCloudStatusUI();
      // Immediately attempt an interactive sign-in so the app auto-connects.
      // If interactive sign-in fails or is blocked, show a styled sign-in prompt.
      (async () => {
        try {
          // try to sign-in interactively (will prefer SDK signIn() if available)
          const u = await this.ensureSignedInInteractive();
          if (!u) {
            // show styled prompt if sign-in wasn't completed
            showSignInPrompt(true);
          }
        } catch (e) {
          console.warn('Automatic interactive sign-in failed:', e?.message || e);
          showSignInPrompt(true);
        }
      })();
      return window.Puter;
    })();
    return this.ready;
  },
  async ensureSignedInInteractive() {
    await this.init();
    if (this.user) return this.user;

    // Prefer SDK signIn if available, otherwise open auth URL and poll for session
    if (window.Puter && window.Puter.auth && typeof window.Puter.auth.signIn === 'function') {
      try {
        const u = await window.Puter.auth.signIn();
        this.user = u;
        updateCloudStatusUI();
        return u;
      } catch (e) {
        console.warn('Puter.auth.signIn failed or cancelled:', e?.message || e);
        // fallback to popup below
      }
    }

    // Fallback: open auth popup and poll for session
    const authUrl = 'https://puter.com/action/sign-in?embedded_in_popup=true&request_auth=true';
    const popup = tryOpenPopup(authUrl, { width: 900, height: 720 });
    if (!popup) {
      // Popup blocked — show user clickable link and return
      showSignInPrompt(false);
      return null;
    }

    // Poll for user becoming available via Puter.identity.whoami or auth.currentUser
    const start = Date.now();
    const timeout = 60_000; // 60s
    while (Date.now() - start < timeout) {
      try {
        if (window.Puter && window.Puter.identity && typeof window.Puter.identity.whoami === 'function') {
          const u = await window.Puter.identity.whoami().catch(() => null);
          if (u) {
            this.user = u;
            // Mirror into global SDK auth surface and notify app listeners
            window.Puter.auth = window.Puter.auth || {};
            window.Puter.auth.currentUser = this.user;
            window.dispatchEvent(new CustomEvent('puter:signin', { detail: this.user }));
            updateCloudStatusUI();
            try { popup.close(); } catch {}
            return u;
          }
        }
        if (window.Puter && window.Puter.auth && window.Puter.auth.currentUser) {
          const u = window.Puter.auth.currentUser;
          if (u) {
            this.user = u;
            window.dispatchEvent(new CustomEvent('puter:signin', { detail: this.user }));
            updateCloudStatusUI();
            try { popup.close(); } catch {}
            return u;
          }
        }
      } catch (e) { /* ignore transient cross-origin errors */ }
      if (popup.closed) break;
      await new Promise(r => setTimeout(r, 800));
    }
    try { if (!popup.closed) popup.close(); } catch {}
    console.warn('Interactive sign-in timed out or was cancelled.');
    return null;
  }
};

// Replace updateCloudStatusUI with a slightly more robust version that queries PuterShim.getStorageInfo when available
function updateCloudStatusUI() {
  try {
    const el = document.getElementById('cloudStorageStatus');
    if (!el) return;
    // If PuterShim can provide storage info, prefer that (ensures options modal and main badge align)
    if (window.PuterShim && typeof window.PuterShim.getStorageInfo === 'function') {
      window.PuterShim.getStorageInfo().then(info => {
        if (!info || !info.connected) {
          el.textContent = 'Cloud Storage: Local (Puter.AI not connected)';
          el.className = 'cloud-storage-status disconnected';
        } else {
          let userLabel = info.user?.username ? ` — ${info.user.username}` : '';
          let quotaText = '';
          if (typeof info.usedBytes === 'number' || typeof info.quotaBytes === 'number') {
            const used = info.usedBytes != null ? formatBytes(Number(info.usedBytes)) : 'N/A';
            const quota = info.quotaBytes != null ? formatBytes(Number(info.quotaBytes)) : '∞';
            quotaText = ` | ${used} / ${quota}`;
          }
          el.textContent = `Cloud Storage: Connected (Puter.AI${userLabel})${quotaText}`;
          el.className = 'cloud-storage-status connected';
        }
      }).catch(() => {
        // fallback to simple check
        const user = PuterShim.user || (window.Puter && window.Puter.auth && window.Puter.auth.currentUser) || null;
        if (user) {
          el.textContent = `Cloud Storage: Connected (Puter.AI${user.username ? ` — ${user.username}` : ''})`;
          el.className = 'cloud-storage-status connected';
        } else {
          el.textContent = 'Cloud Storage: Local (Puter.AI not connected)';
          el.className = 'cloud-storage-status disconnected';
        }
      });
      return;
    }

    // fallback: previous simpler logic
    const sdkPresent = !!window.Puter && Object.keys(window.Puter).length > 0;
    const user = PuterShim.user || (window.Puter && window.Puter.auth && window.Puter.auth.currentUser) || null;
    if (sdkPresent && user) {
      el.textContent = `Cloud Storage: Connected (Puter.AI${user.username ? ` — ${user.username}` : ''})`;
      el.className = 'cloud-storage-status connected';
    } else {
      el.textContent = 'Cloud Storage: Local (Puter.AI not connected)';
      el.className = 'cloud-storage-status disconnected';
    }
  } catch (e) { /* ignore */ }
}

// Friendly lightweight prompt shown when interactive sign-in is not completed.
// Non-blocking: shows an unobtrusive modal with a Sign in button (requires user gesture).
// It intentionally does not auto-open popups to avoid popup blockers.
function showSignInPrompt(autoOpen = false) {
  try {
    const id = 'puterSignPrompt';
    document.getElementById(id)?.remove();
    const d = document.createElement('div');
    d.id = id;
    d.style.position = 'fixed';
    d.style.right = '18px';
    d.style.bottom = '18px';
    d.style.zIndex = 100000;
    d.style.background = 'var(--color-bg-light)';
    d.style.color = 'var(--color-text-dark)';
    d.style.padding = '10px';
    d.style.border = '1px solid var(--color-border)';
    d.style.boxShadow = 'var(--shadow-md)';
    d.innerHTML = `<div style="font-weight:600;margin-bottom:6px">Sign in to Puter</div><div style="font-size:13px;margin-bottom:8px;color:var(--color-text-medium)">Connect your account to enable cloud storage, KV and AI services.</div><div style="display:flex;gap:8px"><button id="${id}-btn" class="btn btn-primary">Sign in with Puter</button><button id="${id}-close" class="btn btn-secondary btn-sm">Close</button></div>`;
    document.body.appendChild(d);
    document.getElementById(`${id}-btn`).addEventListener('click', async () => {
      try {
        await PuterShim.ensureSignedInInteractive();
        document.getElementById(id)?.remove();
      } catch (e) {
        alert('Sign-in failed: ' + (e?.message || e));
      }
    });
    document.getElementById(`${id}-close`).addEventListener('click', () => d.remove());
    if (autoOpen) { /* do not auto-open popups; just show prompt */ }
  } catch (e) { /* ignore UI errors */ }
}

function tryOpenPopup(url, { width = 900, height = 720 } = {}) {
  try {
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const screenWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const screenHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;
    const left = ((screenWidth / 2) - (width / 2)) + dualScreenLeft;
    const top = ((screenHeight / 2) - (height / 2)) + dualScreenTop;
    const features = `scrollbars=yes, width=${width}, height=${height}, top=${top}, left=${left}`;
    const popup = window.open(url, 'PuterSignIn', features);
    if (popup) {
      try { popup.focus(); } catch (e) {}
    }
    return popup;
  } catch (e) {
    return null;
  }
}

// New helper: check FS access for user folder and update project badge accordingly
async function checkAndSetProjectBadge() {
  try {
    // prefer Puter.auth.isSignedIn() if available
    const signed = Boolean((window.Puter && window.Puter.auth && typeof window.Puter.auth.isSignedIn === 'function')
      ? await window.Puter.auth.isSignedIn()
      : (PuterShim.user || (window.Puter && window.Puter.auth && window.Puter.auth.currentUser)));

    if (!signed) {
      const el = document.getElementById('cloudStorageStatus');
      if (el) { el.textContent = 'Cloud Storage: Local (Puter.AI not connected)'; el.className = 'cloud-storage-status disconnected'; }
      return;
    }

    // attempt to stat / create user folder
    const user = PuterShim.user || (window.Puter && window.Puter.auth && window.Puter.auth.currentUser) || null;
    const uid = user?.id || user?.sub || user?.username || 'unknown';
    const folder = `devsparks/${uid}`;

    if (window.Puter && window.Puter.fs && typeof window.Puter.fs.stat === 'function') {
      await window.Puter.fs.stat(folder).catch(async () => { try { await window.Puter.fs.mkdir(folder); } catch(_){} });
      const el = document.getElementById('cloudStorageStatus');
      if (el) { el.textContent = `Cloud Storage: Connected (Puter.AI${user?.username ? ` — ${user.username}` : ''})`; el.className = 'cloud-storage-status connected'; }
    } else {
      // If no fs.stat available, fall back to getStorageInfo flow
      updateCloudStatusUI();
    }
  } catch (e) {
    console.error('checkAndSetProjectBadge', e);
    const el = document.getElementById('cloudStorageStatus');
    if (el) { el.textContent = 'Cloud Storage: Local (Puter.AI not connected)'; el.className = 'cloud-storage-status disconnected'; }
  }
}

// Prefer existing SDK if present, otherwise ensure a safe global object exists for compatibility.
window.Puter = window.Puter || {};
window.PuterShim = PuterShim;

// Provide a compatibility "Puter.init()" if app expects global Puter.init()
if (typeof window.Puter.init !== 'function') {
  window.Puter.init = async function() {
    return PuterShim.init();
  };
}

// If app calls Puter.identity.whoami, forward to SDK if available
if (!window.Puter?.identity && window.Puter && typeof window.Puter.init === 'function') {
  window.Puter.identity = window.Puter.identity || {};
  window.Puter.identity.whoami = async function() {
    if (PuterShim.user) return PuterShim.user;
    if (window.Puter && window.Puter.auth && window.Puter.auth.currentUser) {
      PuterShim.user = window.Puter.auth.currentUser;
      return PuterShim.user;
    }
    return null;
  };
}

// Provide a simple test button integration for the app to validate connectivity
window.PuterShim.testConnection = async function() {
  await PuterShim.init();
  const connected = !!(PuterShim.user || (window.Puter && window.Puter.auth && window.Puter.auth.currentUser));
  return {
    ok: connected,
    user: PuterShim.user || (window.Puter && window.Puter.auth && window.Puter.auth.currentUser) || null
  };
};

// New: try to fetch storage/quota details from Puter SDK (best-effort)
window.PuterShim.getStorageInfo = async function() {
  await PuterShim.init();
  const info = { connected: false, user: null, quotaBytes: null, usedBytes: null, details: {} };
  try {
    let user = PuterShim.user || null;
    if (!user && window.Puter && window.Puter.identity && typeof window.Puter.identity.whoami === 'function') {
      user = await window.Puter.identity.whoami().catch(() => null);
      if (user) {
        PuterShim.user = user;
        window.Puter.auth = window.Puter.auth || {};
        window.Puter.auth.currentUser = user;
        try { window.dispatchEvent(new CustomEvent('puter:signin', { detail: user })); } catch(e) {}
      }
    }
    user = user || (window.Puter && window.Puter.auth && window.Puter.auth.currentUser) || null;
    info.user = user;
    if (!user) {
      info.details.note = 'No signed-in Puter user';
      return info;
    }
    info.connected = true;

    // Try common SDK methods (best-effort): Puter.fs.getUsage(), Puter.account.getQuota(), Puter.identity.whoami()
    if (window.Puter && window.Puter.fs && typeof window.Puter.fs.getUsage === 'function') {
      try {
        const usage = await window.Puter.fs.getUsage();
        // usage may be { used: n, quota: n } or similar
        info.usedBytes = usage.used ?? usage.usedBytes ?? usage.storageUsed ?? null;
        info.quotaBytes = usage.quota ?? usage.quotaBytes ?? usage.storageQuota ?? null;
        info.details.fs_getUsage = usage;
      } catch (e) {
        info.details.fs_getUsage_error = String(e?.message || e);
      }
    }

    if (window.Puter && window.Puter.account && typeof window.Puter.account.getQuota === 'function') {
      try {
        const q = await window.Puter.account.getQuota();
        info.quotaBytes = info.quotaBytes ?? q.quota ?? q.storageQuota ?? null;
        info.details.account_getQuota = q;
      } catch (e) {
        info.details.account_getQuota_error = String(e?.message || e);
      }
    }

    // Some SDKs expose billing/balance info on user object or identity
    try {
      const who = window.Puter.identity && typeof window.Puter.identity.whoami === 'function'
        ? await window.Puter.identity.whoami().catch(() => null)
        : null;
      if (who) {
        info.user = who;
        info.details.whoami = who;
        // attempt common fields for storage/balance
        info.details.balance = who.balance ?? who.credits ?? null;
      }
    } catch (e) {
      info.details.whoami_error = String(e?.message || e);
    }

    // If we couldn't find quota via SDK, attempt reading a known metadata file as heuristic
    if (info.quotaBytes == null && window.Puter && window.Puter.fs && typeof window.Puter.fs.readJson === 'function') {
      try {
        const meta = await window.Puter.fs.readJson('/.puter/account-meta.json').catch(() => null);
        if (meta) {
          info.quotaBytes = meta.quotaBytes ?? meta.quota ?? info.quotaBytes;
          info.usedBytes = meta.usedBytes ?? meta.used ?? info.usedBytes;
          info.details.account_meta = meta;
        }
      } catch (e) {
        info.details.account_meta_error = String(e?.message || e);
      }
    }

    return info;
  } catch (err) {
    info.details.error = String(err?.message || err);
    return info;
  }
};

// UI helper: present storage info and update status element if possible
window.PuterShim.showStorageInfo = async function() {
  const info = await window.PuterShim.getStorageInfo();
  try {
    const el = document.getElementById('cloudStorageStatus');
    if (el) {
      if (!info || !info.connected) {
        el.textContent = 'Cloud Storage: Local (Puter.AI not connected)';
        el.className = 'cloud-storage-status disconnected';
      } else {
        let userLabel = info.user?.username ? ` — ${info.user.username}` : '';
        let quotaText = '';
        if (typeof info.usedBytes === 'number' || typeof info.quotaBytes === 'number') {
          const used = info.usedBytes != null ? formatBytes(Number(info.usedBytes)) : 'N/A';
          const quota = info.quotaBytes != null ? formatBytes(Number(info.quotaBytes)) : '∞';
          quotaText = ` | ${used} / ${quota}`;
        }
        el.textContent = `Cloud Storage: Connected (Puter.AI${userLabel})${quotaText}`;
        el.className = 'cloud-storage-status connected';
      }
    }
  } catch (e) { /* ignore UI errors */ }

  // Show an info modal/alert with details (best-effort)
  const lines = [];
  lines.push(info.connected ? 'Puter: Connected' : 'Puter: Not connected');
  if (info.user) {
    lines.push(`User: ${info.user.username ?? info.user.name ?? info.user.id ?? 'N/A'}`);
    if (info.user.email) lines.push(`Email: ${info.user.email}`);
  }
  if (info.usedBytes != null || info.quotaBytes != null) {
    lines.push(`Storage: ${info.usedBytes != null ? formatBytes(info.usedBytes) : 'N/A'} used / ${info.quotaBytes != null ? formatBytes(info.quotaBytes) : 'N/A'} quota`);
  }
  lines.push('Details (raw):');
  lines.push(JSON.stringify(info.details, null, 2));
  // Use a non-blocking modal if available, fallback to alert
  try {
    // prefer console first for quiet feedback
    console.info('Puter storage info:', info);
    // simple modal: create a small pre inside an overlay
    const modalId = 'puterInfoModal';
    if (document.getElementById(modalId)) document.getElementById(modalId).remove();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.style.position = 'fixed';
    modal.style.left = '50%';
    modal.style.top = '50%';
    modal.style.transform = 'translate(-50%,-50%)';
    modal.style.zIndex = 100000;
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '80vh';
    modal.style.overflow = 'auto';
    modal.style.background = 'var(--color-bg-light, #fff)';
    modal.style.color = 'var(--color-text-dark, #111)';
    modal.style.border = '1px solid rgba(0,0,0,0.08)';
    modal.style.padding = '12px';
    modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
    modal.style.fontFamily = 'Inter, system-ui, sans-serif';
    modal.style.fontSize = '13px';
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';
    const h = document.createElement('strong');
    h.textContent = 'Puter Account Info';
    header.appendChild(h);
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'btn btn-secondary btn-sm';
    closeBtn.addEventListener('click', () => modal.remove());
    header.appendChild(closeBtn);
    modal.appendChild(header);
    const pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.maxHeight = '60vh';
    pre.style.overflow = 'auto';
    pre.textContent = lines.join('\n\n');
    modal.appendChild(pre);
    document.body.appendChild(modal);
  } catch (e) {
    alert(lines.join('\n\n'));
  }
};

// small helper to format bytes human-friendly
function formatBytes(bytes) {
  if (bytes == null) return 'N/A';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = (bytes / Math.pow(k, i));
  return `${v.toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
}

// Auto init in background so app can rely on Puter soon after load
(async () => {
  try {
    await PuterShim.init();
    updateCloudStatusUI();

    // ensure project badge reflects actual FS connectivity
    try { checkAndSetProjectBadge(); } catch(e) { console.warn('checkAndSetProjectBadge failed', e); }

    // attach controls once DOM is ready (fixes missing element binds when script runs early)
    const attachOptionsControls = () => {
      const infoBtn = document.getElementById('puterInfoBtn');
      const testBtn = document.getElementById('puterTestBtn');
      // Also wire the Options modal buttons (IDs used in options-modal)
      const optSignInBtn = document.getElementById('puterOptionsSignInBtn');
      const optSignOutBtn = document.getElementById('puterOptionsSignOutBtn');
      const optStorageInfoBtn = document.getElementById('puterOptionsStorageInfoBtn');
      const optStatusEl = document.getElementById('puterAccountStatus');
      const optDetailsEl = document.getElementById('puterAccountDetails');

      if (infoBtn) {
        infoBtn.addEventListener('click', async () => {
          try {
            await PuterShim.showStorageInfo();
          } catch (e) {
            console.warn('showStorageInfo failed:', e);
            alert('Failed to retrieve Puter info: ' + (e?.message || e));
          }
        });
      }

      // New: quick connectivity test that checks auth, FS, KV and AI endpoints (frontend-only)
      if (testBtn) {
        testBtn.addEventListener('click', async () => {
          const out = [];
          out.push('Starting Puter connectivity test...');
          try {
            await PuterShim.init();
            const conn = await PuterShim.testConnection();
            out.push(`Auth: ${conn.ok ? 'Signed in' : 'Not signed in'}`);
            if (conn.user) out.push(`User: ${conn.user.username || conn.user.id || 'N/A'}`);

            // FS test: try listFiles (best-effort)
            try {
              if (window.Puter && window.Puter.fs && typeof window.Puter.fs.listFiles === 'function') {
                const files = await window.Puter.fs.listFiles('/').catch(() => null);
                out.push(`FS.listFiles: ${Array.isArray(files) ? files.length + ' entries' : 'no response'}`);
              } else {
                out.push('FS.listFiles: not available');
              }
            } catch (e) { out.push('FS test error: ' + e?.message || e); }

            // KV test: put/get/delete (non-destructive key)
            try {
              if (window.Puter && window.Puter.kv && typeof window.Puter.kv.put === 'function') {
                const k = `_devspark_test_${Date.now()}`;
                await window.Puter.kv.put(k, 'ok').catch(() => null);
                const val = await window.Puter.kv.get(k).catch(() => null);
                await window.Puter.kv.del(k).catch(() => null);
                out.push(`KV: write/read/delete => ${val === 'ok' ? 'OK' : 'Failed'}`);
              } else {
                out.push('KV: not available');
              }
            } catch (e) { out.push('KV test error: ' + e?.message || e); }

            // AI test: call a safe lightweight endpoint if available (no-charge / small)
            try {
              if (window.Puter && window.Puter.ai && typeof window.Puter.ai.chat === 'function') {
                // best-effort, use a short prompt and timeout so UI doesn't hang
                const aiPromise = window.Puter.ai.chat({ model: 'gpt-5-nano', messages: [{ role: 'user', content: 'Ping' }], timeout: 10000 }).catch(() => null);
                const aiResp = await aiPromise;
                const aiOk = !!(aiResp && (aiResp.choices || aiResp.content));
                out.push(`AI.chat: ${aiOk ? 'Ready' : 'No response'}`);
              } else {
                out.push('AI.chat: not available');
              }
            } catch (e) { out.push('AI test error: ' + e?.message || e); }

            // Hosting capability (best-effort detection)
            try {
              if (window.Puter && window.Puter.host && (typeof window.Puter.host.createSite === 'function' || typeof window.Puter.host.create === 'function')) {
                out.push('Hosting: API available');
              } else {
                out.push('Hosting: not available in this SDK/environment');
              }
            } catch (e) { out.push('Hosting check error: ' + e?.message || e); }

          } catch (err) {
            out.push('PuterShim init failed: ' + (err?.message || err));
          }

          // Present results in a small modal-like overlay (non-blocking)
          try {
            const id = 'puterTestResultModal';
            document.getElementById(id)?.remove();
            const modal = document.createElement('div');
            modal.id = id;
            modal.style.position = 'fixed';
            modal.style.right = '18px';
            modal.style.bottom = '18px';
            modal.style.zIndex = 100000;
            modal.style.maxWidth = '420px';
            modal.style.background = 'var(--color-bg-light, #fff)';
            modal.style.color = 'var(--color-text-dark, #111)';
            modal.style.border = '1px solid rgba(0,0,0,0.08)';
            modal.style.padding = '12px';
            modal.style.boxShadow = 'var(--shadow-md, 0 6px 18px rgba(0,0,0,0.12))';
            modal.style.fontFamily = 'Inter, system-ui, sans-serif';
            modal.style.fontSize = '13px';
            modal.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong>Puter Connectivity Test</strong><button id="${id}-close" class="btn btn-secondary btn-sm">Close</button></div><pre style="white-space:pre-wrap;font-family: monospace;max-height:40vh;overflow:auto;margin:0;">${out.join('\n')}</pre>`;
            document.body.appendChild(modal);
            document.getElementById(`${id}-close`).addEventListener('click', () => modal.remove());
          } catch (e) {
            // fallback to alert
            alert(out.join('\n'));
          }
        });
      }

      // Options modal sign-in/sign-out/storage wiring (use existing PuterShim helpers)
      if (optSignInBtn) {
        optSignInBtn.addEventListener('click', async () => {
          try {
            const u = await PuterShim.ensureSignedInInteractive();
            PuterShim.user = u || PuterShim.user;
            updateCloudStatusUI();
            if (optStatusEl) optStatusEl.textContent = `Puter: ${u ? 'Connected — ' + (u.username || u.id) : 'Not connected'}`;
            if (optDetailsEl && u) optDetailsEl.style.display = 'block', optDetailsEl.textContent = `ID: ${u.id || 'N/A'}${u.email ? ` | Email: ${u.email}` : ''}`;
          } catch (e) { console.warn('Options sign-in failed:', e); }
        });
      }
      if (optSignOutBtn) {
        optSignOutBtn.addEventListener('click', async () => {
          try { if (window.Puter?.auth?.signOut) await window.Puter.auth.signOut(); } catch (e) { console.warn('Puter signOut failed:', e); }
          PuterShim.user = null;
          updateCloudStatusUI();
          if (optStatusEl) optStatusEl.textContent = 'Puter: Not connected';
          if (optDetailsEl) { optDetailsEl.style.display = 'none'; optDetailsEl.textContent = ''; }
        });
      }
      if (optStorageInfoBtn) {
        optStorageInfoBtn.addEventListener('click', async () => {
          try { await PuterShim.showStorageInfo(); } catch (e) { console.warn('showStorageInfo failed:', e); alert('Failed to retrieve Puter info: ' + (e?.message || e)); }
        });
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      attachOptionsControls();
    } else {
      document.addEventListener('DOMContentLoaded', attachOptionsControls);
    }

    // NEW: Listen for Puter SDK auth state changes and mirror them to UI immediately
    try {
      if (window.Puter && window.Puter.auth && typeof window.Puter.auth.onAuthStateChanged === 'function') {
        window.Puter.auth.onAuthStateChanged((u) => {
          PuterShim.user = u || null;
          updateCloudStatusUI();
          // also refresh options UI elements if they exist
          const statusEl = document.getElementById('puterAccountStatus');
          const detailsEl = document.getElementById('puterAccountDetails');
          if (statusEl && detailsEl) {
            if (PuterShim.user) {
              statusEl.textContent = `Puter: Connected — ${PuterShim.user.username || PuterShim.user.id || 'User'}`;
              detailsEl.style.display = 'block';
              detailsEl.textContent = `ID: ${PuterShim.user.id || 'N/A'}${PuterShim.user.email ? ` | Email: ${PuterShim.user.email}` : ''}`;
            } else {
              statusEl.textContent = 'Puter: Not connected';
              detailsEl.style.display = 'none';
              detailsEl.textContent = '';
            }
          }
          // update project badge on auth changes
          try { checkAndSetProjectBadge(); } catch(e) {}
        });
      }
    } catch (e) { /* ignore */ }

  } catch (e) {
    console.warn('PuterShim auto-init failed:', e?.message || e);
  }
})();