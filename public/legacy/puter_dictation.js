// New file: puter_dictation.js
// Lightweight dictation module: listens for wake-word "dictate", provides UI button toggle,
// transcribes speech into #messageInput and can auto-send on long pause (optional).
// Depends on window.devSparkApp being set by app.js.

const Dictation = (function () {
  const WAKEWORD = 'dictate';
  let recognition = null;
  let listening = false;
  let wakewordListening = false;
  let interimTimeout = null;

  function supports() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function createRecognition({ continuous = true, interim = true } = {}) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = 'en-US';
    r.continuous = continuous;
    r.interimResults = interim;
    r.maxAlternatives = 1;
    return r;
  }

  function setStatus(text) {
    const btn = document.getElementById('dictateBtn');
    if (!btn) return;
    btn.textContent = text;
  }

  function attachButton() {
    const btn = document.getElementById('dictateBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!supports()) return alert('Speech Recognition not supported in this browser.');
      if (!recognition) recognition = createRecognition();
      if (!listening) {
        startDictation({ interactive: true });
      } else {
        stopDictation();
      }
    });
  }

  async function startWakewordWatcher() {
    if (!supports()) return;
    if (wakewordListening) return;
    // create a light, short-continuous recognition to detect wakeword
    const r = createRecognition({ continuous: true, interim: false });
    if (!r) return;
    wakewordListening = true;
    r.onresult = (ev) => {
      try {
        const txt = Array.from(ev.results).map(r => r[0].transcript).join(' ').toLowerCase();
        if (txt.includes(WAKEWORD)) {
          // brief visual feedback
          setStatus('Listening…');
          // start full dictation
          startDictation({ interactive: true });
        }
      } catch (e) { console.warn('wakeword parse error', e); }
    };
    r.onerror = (e) => {
      console.debug('wakeword error', e);
      // graceful: stop and restart after delay
      try { r.stop(); } catch(e){}
      setTimeout(() => { if (wakewordListening) startWakewordWatcher(); }, 1200);
    };
    r.onend = () => {
      // restart watcher unless we've transitioned to active dictation
      if (wakewordListening) {
        setTimeout(() => { if (wakewordListening) startWakewordWatcher(); }, 500);
      }
    };
    try { r.start(); } catch (e) { console.warn('wakeword start failed', e); wakewordListening = false; }
  }

  function stopWakewordWatcher() {
    wakewordListening = false;
  }

  function startDictation({ interactive = false } = {}) {
    if (!supports()) return;
    if (listening) return;
    if (!recognition) recognition = createRecognition({ continuous: true, interim: true });
    const r = recognition;
    const input = document.getElementById('messageInput');
    let finalText = input ? input.value || '' : '';
    setStatus('Recording… (click to stop)');

    // helper to normalize spoken punctuation tokens into actual symbols
    function replaceSpokenPunctuation(s) {
      if (!s) return s;
      // common spoken-to-symbol mappings (handle multi-word tokens first)
      const mappings = [
        { re: /\b(full stop|period|dot)\b/gi, to: '.' },
        { re: /\b(comma)\b/gi, to: ',' },
        { re: /\b(question mark|question)\b/gi, to: '?' },
        { re: /\b(exclamation mark|exclamation|bang)\b/gi, to: '!' },
        { re: /\b(colon)\b/gi, to: ':' },
        { re: /\b(semicolon)\b/gi, to: ';' },
        { re: /\b(open parenthesis|open bracket)\b/gi, to: ' (' },
        { re: /\b(close parenthesis|close bracket)\b/gi, to: ')' },
        { re: /\b(quote|open quote)\b/gi, to: '“' },
        { re: /\b(end quote|close quote)\b/gi, to: '”' },
        { re: /\b(new line|newline|line break)\b/gi, to: '\n' },
        { re: /\b(new paragraph|paragraph)\b/gi, to: '\n\n' },
        { re: /\b(dash|hyphen)\b/gi, to: '-' },
        { re: /\b(slash)\b/gi, to: '/' },
        { re: /\b(underscore)\b/gi, to: '_' },
        { re: /\b(at sign|at)\b/gi, to: '@' },
        { re: /\b(and symbol|ampersand)\b/gi, to: '&' },
        { re: /\b(percent sign|percent)\b/gi, to: '%' },
        { re: /\b(asterisk)\b/gi, to: '*' }
      ];

      // Also convert spoken spelled-out punctuation like "comma" when adjacent to words:
      let out = s;
      mappings.forEach(m => {
        out = out.replace(m.re, m.to);
      });

      // Post-process spacing: collapse multiple spaces and remove space before punctuation
      out = out.replace(/\s+([,.:;?!%)])/g, '$1');   // no space before punctuation
      out = out.replace(/([(\n])\s+/g, '$1');        // no space after opening paren/newline
      out = out.replace(/\s{2,}/g, ' ');
      return out;
    }

    r.onresult = (ev) => {
      clearTimeout(interimTimeout);
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const transcript = res[0].transcript || '';
        if (res.isFinal) {
          // convert punctuation tokens in final results (more reliable)
          const converted = replaceSpokenPunctuation(transcript.trim());
          finalText = finalText ? finalText + (finalText.endsWith('\n') ? '' : ' ') + converted : converted;
        } else {
          // for interim, show best-effort conversion but keep it non-destructive
          interim += replaceSpokenPunctuation(transcript);
        }
      }
      if (input) {
        // Keep spacing tidy when combining finalText + interim
        const combined = (finalText + (interim ? (finalText && !finalText.endsWith('\n') ? ' ' : '') + interim : '')).trimStart();
        input.value = combined;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // auto-stop after user silence (no interim/final updates)
      interimTimeout = setTimeout(() => {
        // finalize and stop
        if (input && input.value.trim()) {
          // leave text in input; optionally auto-send:
          // document.getElementById('sendBtn').click();
        }
        stopDictation();
      }, 1400);
    };

    r.onerror = (e) => {
      console.warn('Dictation error', e);
      stopDictation();
    };

    r.onend = () => {
      listening = false;
      setStatus('Dictate');
      // resume wakeword watcher
      startWakewordWatcher();
    };

    try {
      r.start();
      listening = true;
      // stop wakeword watcher while actively recording
      stopWakewordWatcher();
    } catch (e) {
      console.warn('startDictation failed', e);
      listening = false;
    }
  }

  function stopDictation() {
    if (!recognition) return;
    try { recognition.stop(); } catch (e) {}
    listening = false;
    setStatus('Dictate');
    // resume wakeword watcher
    startWakewordWatcher();
  }

  function init() {
    attachButton();
    // labelled initial state
    setStatus('Dictate');
    // start passive wakeword listening in background
    try { startWakewordWatcher(); } catch (e) { console.warn('wakeword watcher failed', e); }
    // expose controls for debugging
    window.DevSparkDictation = { start: () => startDictation({ interactive: true }), stop: stopDictation };
  }

  return { init, startDictation, stopDictation, supports };
})();

// Initialize on DOM ready (and after app is constructed)
document.addEventListener('DOMContentLoaded', () => {
  // ensure app instance exists soon after DOM ready
  const startWhenReady = () => {
    if (window.devSparkApp) {
      Dictation.init();
    } else {
      // try again shortly
      setTimeout(startWhenReady, 200);
    }
  };
  startWhenReady();
});

export default Dictation;