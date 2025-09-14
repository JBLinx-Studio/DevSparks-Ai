// New file: puter_demo.js
// Frontend-only Puter.js demo implementing auth, fs, kv, hosting, and AI chat/image features.
// Note: This page assumes Puter client lib is available via <script src="https://js.puter.com/v2/"></script>

const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const userInfoDiv = document.getElementById('userInfo');
const debugLog = document.getElementById('debugLog');

const createHelloBtn = document.getElementById('createHelloBtn');
const readHelloBtn = document.getElementById('readHelloBtn');

const saveFileBtn = document.getElementById('saveFileBtn');
const listFilesBtn = document.getElementById('listFilesBtn');
const fileListDiv = document.getElementById('fileList');
const newFilenameInput = document.getElementById('newFilename');
const newFileContent = document.getElementById('newFileContent');

const kvSelect = document.getElementById('kvSelect');
const savePrefBtn = document.getElementById('savePrefBtn');
const loadPrefBtn = document.getElementById('loadPrefBtn');

const hostFolderInput = document.getElementById('hostFolder');
const indexContent = document.getElementById('indexContent');
const createHostBtn = document.getElementById('createHostBtn');
const deleteHostBtn = document.getElementById('deleteHostBtn');
const hostUrlDiv = document.getElementById('hostUrl');

const aiInput = document.getElementById('aiInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const streamChatBtn = document.getElementById('streamChatBtn');
const genImageBtn = document.getElementById('genImageBtn');
const aiOutput = document.getElementById('aiOutput');
const aiImage = document.getElementById('aiImage');
const aiProviderSelect = document.getElementById('aiProviderSelect'); // NEW

// Default provider state
let selectedAIProvider = (aiProviderSelect && aiProviderSelect.value) || 'websim';
if (aiProviderSelect) {
  aiProviderSelect.addEventListener('change', (e) => {
    selectedAIProvider = e.target.value;
    log('AI Provider selected:', selectedAIProvider);
  });
}

// Utility: write debug with puter.print and local UI log
function log(...args) {
  try { window.Puter?.print?.(...args); } catch (e) { /* ignore */ }
  const line = document.createElement('div');
  const ts = new Date().toLocaleTimeString();
  line.textContent = `[${ts}] ${args.map(a => (typeof a === 'object' && a !== null) ? JSON.stringify(a) : String(a)).join(' ')}`;
  debugLog.appendChild(line);
  debugLog.scrollTop = debugLog.scrollHeight;
}

// Initialize UI state
async function updateUserUI() {
  const user = window.Puter?.auth?.currentUser || null;
  if (user) {
    userInfoDiv.innerHTML = `<div><strong>${user.name || user.username || 'User'}</strong></div>
      <div class="small">Email: ${user.email || 'N/A'}</div>
      <div class="small">ID: ${user.id || 'N/A'}</div>
      <div class="small">Balance: ${user.balance ?? 'N/A'}</div>`;
    signInBtn.style.display = 'none';
    signOutBtn.style.display = 'inline-block';
    log('User signed in:', user);
  } else {
    userInfoDiv.innerHTML = `<div class="small">Not signed in.</div>`;
    signInBtn.style.display = 'inline-block';
    signOutBtn.style.display = 'none';
    log('No user signed in');
  }
}

// Sign in flow (Puter popup)
signInBtn.addEventListener('click', async () => {
  try {
    log('Starting Puter sign-in...');
    // Puter.auth.signIn returns a promise that resolves when user completes auth
    const user = await window.Puter.auth.signIn();
    log('Sign-in result:', user);
    await updateUserUI();
  } catch (e) {
    log('Sign-in error:', e?.message || e);
  }
});

signOutBtn.addEventListener('click', async () => {
  try {
    await window.Puter.auth.signOut();
    log('Signed out');
    await updateUserUI();
  } catch (e) {
    log('Sign-out error', e);
  }
});

// On load, populate UI with current user if already authenticated
document.addEventListener('DOMContentLoaded', async () => {
  // If Puter is not available, show message
  if (!window.Puter) {
    log('Puter SDK not loaded. Ensure <script src="https://js.puter.com/v2/"></script> is present.');
    userInfoDiv.innerHTML = '<div class="small">Puter SDK not found.</div>';
    return;
  }

  // Hook auth state changes if available
  try {
    if (window.Puter.auth && typeof window.Puter.auth.onAuthStateChanged === 'function') {
      window.Puter.auth.onAuthStateChanged(async (u) => {
        log('Auth state changed', u);
        await updateUserUI();
      });
    }
  } catch (e) {
    log('onAuthStateChanged hook error', e);
  }

  await updateUserUI();

  // Try to fetch and display KV preference if signed in
  try {
    if (window.Puter.auth.currentUser) {
      const pref = await window.Puter.kv.get('themePreference');
      if (pref) {
        kvSelect.value = pref;
        log('Loaded KV preference on startup:', pref);
      }
    }
  } catch (e) {
    log('KV load on startup failed:', e);
  }
});

// File operations: create hello.txt quickly
createHelloBtn.addEventListener('click', async () => {
  try {
    const content = 'Hello from Puter.js demo! ' + new Date().toISOString();
    await window.Puter.fs.writeFile('hello.txt', content);
    log('Created hello.txt with content:', content);
    alert('hello.txt created');
  } catch (e) {
    log('createHello error:', e);
  }
});

readHelloBtn.addEventListener('click', async () => {
  try {
    const txt = await window.Puter.fs.readFile('hello.txt', { encoding: 'utf-8' });
    log('Read hello.txt content:', txt);
    alert('hello.txt:\n\n' + txt);
  } catch (e) {
    log('readHello error:', e);
    alert('Failed to read hello.txt: ' + (e?.message || e));
  }
});

// Save arbitrary file from UI
saveFileBtn.addEventListener('click', async () => {
  const name = newFilenameInput.value.trim() || 'untitled.txt';
  const content = newFileContent.value || '';
  try {
    await window.Puter.fs.writeFile(name, content);
    log('Saved file', name);
    alert(`Saved ${name}`);
  } catch (e) {
    log('saveFile error', e);
    alert('Save failed: ' + (e?.message || e));
  }
});

// List files
listFilesBtn.addEventListener('click', async () => {
  try {
    const files = await window.Puter.fs.listFiles('/');
    fileListDiv.innerHTML = '';
    if (files.length === 0) {
      fileListDiv.textContent = 'No files found.';
      log('No files found in cloud storage');
      return;
    }
    for (const f of files) {
      const row = document.createElement('div');
      row.className = 'file-item';
      const nameSpan = document.createElement('div');
      nameSpan.textContent = f;
      const actions = document.createElement('div');
      const openBtn = document.createElement('button');
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', async () => {
        try {
          const content = await window.Puter.fs.readFile(f, { encoding: 'utf-8' });
          log('Opened file', f, content);
          alert(`${f}:\n\n${content}`);
        } catch (e) {
          log('open file error', e);
          alert('Open failed: ' + (e?.message || e));
        }
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.style.marginLeft = '8px';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete ${f}?`)) return;
        try {
          await window.Puter.fs.deleteFile(f);
          log('Deleted file', f);
          row.remove();
        } catch (e) {
          log('delete file error', e);
        }
      });
      actions.appendChild(openBtn);
      actions.appendChild(delBtn);
      row.appendChild(nameSpan);
      row.appendChild(actions);
      fileListDiv.appendChild(row);
    }
    log('Listed files:', files);
  } catch (e) {
    log('listFiles error', e);
  }
});

// KV operations
savePrefBtn.addEventListener('click', async () => {
  const val = kvSelect.value;
  try {
    await window.Puter.kv.put('themePreference', val);
    log('Saved KV themePreference=', val);
    alert('Preference saved');
  } catch (e) {
    log('KV put error', e);
  }
});

loadPrefBtn.addEventListener('click', async () => {
  try {
    const val = await window.Puter.kv.get('themePreference');
    if (val) {
      kvSelect.value = val;
      log('Loaded KV themePreference=', val);
      alert('Loaded preference: ' + val);
    } else {
      log('KV preference not set');
      alert('No preference set yet');
    }
  } catch (e) {
    log('KV get error', e);
  }
});

// Hosting: create folder and write index.html, then create a static site (user-paid resources)
createHostBtn.addEventListener('click', async () => {
  const folder = (hostFolderInput.value || 'mysite').replace(/^\/+|\/+$/g, '');
  const index = indexContent.value || '<h1>Empty</h1>';
  try {
    log('Uploading index.html to folder', folder);
    await window.Puter.fs.writeFile(`${folder}/index.html`, index);
    log('Attempting to create a static site (hosting) from folder:', folder);
    // The Puter hosting API varies — using a common pattern: Puter.host.createSite(folder)
    // This demo uses a safe guard: check for existence of puter.host.createSite
    if (window.Puter.host && typeof window.Puter.host.createSite === 'function') {
      const site = await window.Puter.host.createSite({ folder, ttl: 3600 }); // ttl optional
      // site.url expected
      hostUrlDiv.textContent = site.url || 'Created (no URL returned)';
      log('Hosted site created:', site);
      alert('Hosted site created: ' + (site.url || 'no-url'));
    } else if (window.Puter.host && typeof window.Puter.host.create === 'function') {
      const site = await window.Puter.host.create(folder);
      hostUrlDiv.textContent = site.url || 'Created (no URL returned)';
      log('Hosted site created:', site);
      alert('Hosted site created: ' + (site.url || 'no-url'));
    } else {
      // Fallback instruction if Puter hosting API is not available in this environment
      const msg = 'Hosting API not available in this Puter SDK version in this environment.';
      log(msg);
      alert(msg);
    }
  } catch (e) {
    log('createHost error', e);
    alert('Hosting failed: ' + (e?.message || e));
  }
});

deleteHostBtn.addEventListener('click', async () => {
  const folder = (hostFolderInput.value || 'mysite').replace(/^\/+|\/+$/g, '');
  if (!confirm(`Delete hosted site and files for folder "${folder}"? This may incur costs.`)) return;
  try {
    // Try delete via Puter.host if available
    if (window.Puter.host && typeof window.Puter.host.deleteSite === 'function') {
      await window.Puter.host.deleteSite({ folder });
      hostUrlDiv.textContent = '—';
      log('Hosted site deleted for folder', folder);
      alert('Hosted site deleted');
    } else {
      // fallback: delete files in folder and notify user
      const files = await window.Puter.fs.listFiles(`/${folder}`) || [];
      for (const f of files) {
        await window.Puter.fs.deleteFile(`${folder}/${f}`);
      }
      hostUrlDiv.textContent = '—';
      log('Deleted files under folder', folder);
      alert('Deleted files for folder (hosting API not present).');
    }
  } catch (e) {
    log('deleteHost error', e);
  }
});

// AI Chat: send message
sendChatBtn.addEventListener('click', async () => {
  const prompt = aiInput.value.trim();
  if (!prompt) return;
  aiOutput.textContent = 'Thinking...';
  try {
    let resp, text;
    if (selectedAIProvider === 'puter' && window.Puter && window.Puter.ai && typeof window.Puter.ai.chat === 'function') {
      resp = await window.Puter.ai.chat({ model: 'gpt-5-nano', messages: [{ role: 'user', content: prompt }] });
      text = resp?.choices?.[0]?.message?.content || resp?.content || String(resp);
    } else {
      // fallback to websim
      resp = await websim.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-5-nano'
      }).catch(() => null);
      text = resp?.content || resp?.choices?.[0]?.message?.content || String(resp);
    }
    aiOutput.textContent = text;
    log('AI chat response', text);
  } catch (e) {
    aiOutput.textContent = 'Error: ' + (e?.message || e);
    log('AI chat error', e);
  }
});

// Streamed AI chat (bonus)
streamChatBtn.addEventListener('click', async () => {
  const prompt = aiInput.value.trim(); if (!prompt) return;
  aiOutput.textContent = '';
  try {
    if (selectedAIProvider === 'puter' && window.Puter && window.Puter.ai && typeof window.Puter.ai.chat === 'function') {
      const stream = await window.Puter.ai.chat({ model: 'gpt-5-nano', messages: [{ role: 'user', content: prompt }], stream: true });
      if (stream[Symbol.asyncIterator]) {
        for await (const chunk of stream) {
          const part = chunk?.delta?.content || chunk?.choices?.[0]?.delta?.content || chunk?.content || String(chunk);
          aiOutput.textContent += part;
        }
      } else {
        aiOutput.textContent = stream?.choices?.[0]?.message?.content || stream?.content || String(stream);
      }
    } else {
      // Websim streaming pattern (if available)
      const stream = await websim.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-5-nano',
        stream: true
      }).catch(() => null);
      if (stream && stream[Symbol.asyncIterator]) {
        for await (const chunk of stream) {
          aiOutput.textContent += chunk?.content || String(chunk);
        }
      } else {
        aiOutput.textContent = stream?.content || String(stream);
      }
    }
    log('AI stream completed');
  } catch (e) {
    aiOutput.textContent = 'Stream error: ' + (e?.message || e);
    log('AI stream error', e);
  }
});

// Image generation
genImageBtn.addEventListener('click', async () => {
  const prompt = aiInput.value.trim() || 'A beautiful minimal web UI illustration';
  aiImage.style.display = 'none';
  try {
    log('Requesting image generation (txt2img) with prompt:', prompt);
    let res, url;
    if (selectedAIProvider === 'puter' && window.Puter && window.Puter.ai && typeof window.Puter.ai.txt2img === 'function') {
      res = await window.Puter.ai.txt2img({ prompt, size: '1024x1024' });
      url = res?.url || res?.imageUrl || res?.b64;
    } else {
      res = await websim.imageGen({ prompt, aspect_ratio: '1:1' }).catch(() => null);
      url = res?.url || res?.imageUrl || res?.b64;
    }
    if (!url) throw new Error('No image url returned');
    if (url.startsWith('data:') || url.startsWith('http')) aiImage.src = url;
    else if (res?.b64) aiImage.src = `data:image/png;base64,${res.b64}`;
    else aiImage.src = url;
    aiImage.style.display = 'block';
    log('Image generation response', res);
  } catch (e) {
    log('Image generation error', e);
    alert('Image generation failed: ' + (e?.message || e));
  }
});

// Demonstrate how User Pays Model works (UI note)
(function explainUserPays() {
  const note = 'Note: Hosted sites, AI and storage operations may consume your Puter account resources — users pay for resource usage directly via their Puter account (User Pays Model).';
  log(note);
})();