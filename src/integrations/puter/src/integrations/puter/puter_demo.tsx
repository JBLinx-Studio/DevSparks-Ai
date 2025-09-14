import React, { useEffect, useState } from "react";
import puterIntegration from "../integrations/puter/puter_integration";
import PuterAPI from "../../puter_api.js";

/* @tweakable [Default AI model to request when sending chat] */
const DEFAULT_MODEL = /* @tweakable */ "gpt-5-nano";

/* @tweakable [Default user folder base used by demo when creating host/files] */
const USER_FOLDER_BASE = /* @tweakable */ "devsparks";

export default function PuterDemo(): JSX.Element {
  const [user, setUser] = useState<any>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [newFilename, setNewFilename] = useState("hello.txt");
  const [newFileContent, setNewFileContent] = useState("Hello from Puter.js demo!");
  const [aiInput, setAiInput] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [hostUrl, setHostUrl] = useState<string | null>(null);

  function appendLog(...args: any[]) {
    const ts = new Date().toLocaleTimeString();
    const text = `[${ts}] ${args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`;
    setLogLines((s) => [text, ...s].slice(0, 200));
    try { (window as any).Puter?.print?.(text); } catch {}
  }

  async function refreshUser() {
    try {
      const u = await puterIntegration.getUser();
      setUser(u);
      appendLog("User updated:", u || "no user");
    } catch (e) {
      appendLog("refreshUser error", (e as Error).message || e);
    }
  }

  useEffect(() => {
    refreshUser();
    const onSignIn = () => refreshUser();
    const onSignOut = () => { setUser(null); appendLog("signed out"); };
    window.addEventListener("puter:signin", onSignIn);
    window.addEventListener("puter:signout", onSignOut);
    return () => {
      window.removeEventListener("puter:signin", onSignIn);
      window.removeEventListener("puter:signout", onSignOut);
    };
  }, []);

  async function signIn() {
    try {
      appendLog("Starting sign in...");
      const u = await puterIntegration.signIn();
      setUser(u);
      appendLog("Sign-in result:", u || "no user returned");
    } catch (e) {
      appendLog("Sign-in error:", (e as Error).message || e);
      alert("Sign-in failed: " + ((e as Error).message || e));
    }
  }

  async function signOut() {
    try {
      await puterIntegration.signOut();
      setUser(null);
      appendLog("Signed out");
    } catch (e) {
      appendLog("Sign-out error:", (e as Error).message || e);
    }
  }

  async function saveFile() {
    try {
      await PuterAPI.fs.writeFile(`${USER_FOLDER_BASE}/${user?.id || "anon"}/${newFilename}`, newFileContent);
      appendLog("Saved file:", newFilename);
      alert("Saved " + newFilename);
    } catch (e) {
      appendLog("saveFile error:", (e as Error).message || e);
      alert("Save failed: " + ((e as Error).message || e));
    }
  }

  async function listFiles() {
    try {
      const list = await PuterAPI.fs.listFiles(`${USER_FOLDER_BASE}/${user?.id || "anon"}`); // best-effort
      setFiles(Array.isArray(list) ? list : []);
      appendLog("Listed files:", list);
    } catch (e) {
      appendLog("listFiles error:", (e as Error).message || e);
      alert("List failed: " + ((e as Error).message || e));
    }
  }

  async function createHost() {
    try {
      const folder = `${USER_FOLDER_BASE}/${user?.id || "anon"}/mysite`;
      await PuterAPI.fs.writeFile(`${folder}/index.html`, "<h1>Hello from Puter hosted site</h1>");
      if ((PuterAPI as any).host && typeof (PuterAPI as any).host.createSite === "function") {
        const site = await (PuterAPI as any).host.createSite({ folder, ttl: 3600 }).catch(() => null);
        setHostUrl(site?.url || "Created (no URL returned)");
        appendLog("Hosting created:", site);
      } else {
        appendLog("Hosting API not available in this environment.");
        alert("Hosting API not available in this environment.");
      }
    } catch (e) {
      appendLog("createHost error:", (e as Error).message || e);
      alert("Hosting failed: " + ((e as Error).message || e));
    }
  }

  async function sendChat() {
    try {
      setAiOutput("Thinking...");
      const prompt = aiInput.trim();
      if (!prompt) return;
      appendLog("Chat prompt:", prompt);
      // Prefer PuterService.ai if available via PuterAPI wrapper, fallback to websim if present
      try {
        if ((PuterAPI as any).ai && typeof (PuterAPI as any).ai.chat === "function") {
          const r = await (PuterAPI as any).ai.chat({ model: DEFAULT_MODEL, messages: [{ role: "user", content: prompt }] }).catch(() => null);
          const text = r?.choices?.[0]?.message?.content || r?.content || String(r || "");
          setAiOutput(String(text));
          appendLog("AI response:", text);
          return;
        }
      } catch (e) { appendLog("Puter.ai.chat error", e); }
      // fallback: check global websim
      if ((window as any).websim?.chat?.completions?.create) {
        const r = await (window as any).websim.chat.completions.create({ messages: [{ role: "user", content: prompt }], model: DEFAULT_MODEL }).catch(() => null);
        const text = r?.content || r?.choices?.[0]?.message?.content || String(r || "");
        setAiOutput(String(text));
        appendLog("AI response (websim):", text);
        return;
      }
      setAiOutput("No AI provider available in this environment.");
      appendLog("No AI provider available");
    } catch (e) {
      appendLog("AI chat error:", (e as Error).message || e);
      setAiOutput("Error: " + ((e as Error).message || e));
    }
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", padding: 18, maxWidth: 1100, margin: "18px auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>Puter Demo — Lovable</h1>
        <div>
          {user ? (
            <button className="btn btn-secondary" onClick={signOut}>Sign Out</button>
          ) : (
            <button className="btn btn-primary" onClick={signIn}>Sign In with Puter</button>
          )}
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ border: "1px solid var(--color-border)", padding: 12, borderRadius: 6 }}>
            <h3>User</h3>
            <div style={{ marginBottom: 8 }}>
              {user ? (
                <>
                  <div style={{ fontWeight: 700 }}>{user.name || user.username || "User"}</div>
                  <div style={{ color: "var(--color-text-medium)" }}>ID: {user.id || user.uuid || "N/A"}</div>
                </>
              ) : (
                <div style={{ color: "#666" }}>Not signed in.</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={refreshUser} className="btn btn-secondary">Refresh</button>
            </div>
          </div>

          <div style={{ border: "1px solid var(--color-border)", padding: 12, borderRadius: 6 }}>
            <h3>Cloud File Storage</h3>
            <label>New file name</label>
            <input value={newFilename} onChange={(e) => setNewFilename(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 6 }} />
            <label style={{ marginTop: 8 }}>Content</label>
            <textarea value={newFileContent} onChange={(e) => setNewFileContent(e.target.value)} rows={5} style={{ width: "100%", padding: 8 }} />
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={saveFile} className="btn btn-primary">Save file</button>
              <button onClick={listFiles} className="btn btn-secondary">List files</button>
            </div>
            <div style={{ marginTop: 12, maxHeight: 180, overflow: "auto", background: "#fbfbfb", padding: 8, borderRadius: 6 }}>
              {files.length === 0 ? <div style={{ color: "#666" }}>No files found.</div> : files.map((f) => <div key={f} style={{ padding: 6, borderBottom: "1px dashed #eee" }}>{f}</div>)}
            </div>
          </div>

          <div style={{ border: "1px solid var(--color-border)", padding: 12, borderRadius: 6 }}>
            <h3>Static Website Hosting</h3>
            <div style={{ marginTop: 8 }}>
              <button onClick={createHost} className="btn btn-primary">Create & Host</button>
            </div>
            <div style={{ marginTop: 8 }}>Hosted URL: <div style={{ wordBreak: "break-all", color: "var(--color-primary-light)" }}>{hostUrl || "—"}</div></div>
          </div>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ border: "1px solid var(--color-border)", padding: 12, borderRadius: 6 }}>
            <h3>AI Chat</h3>
            <textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)} rows={3} placeholder="Ask the assistant..." style={{ width: "100%", padding: 8 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={sendChat} className="btn btn-primary">Send Chat</button>
            </div>
            <div style={{ marginTop: 8, minHeight: 80, padding: 8, background: "#fafafa", borderRadius: 6 }}>
              {aiOutput}
            </div>
          </div>

          <div style={{ border: "1px solid var(--color-border)", padding: 12, borderRadius: 6 }}>
            <h3>Debug Log</h3>
            <div style={{ fontFamily: "monospace", background: "#0f1720", color: "#dbeafe", padding: 8, borderRadius: 6, maxHeight: 320, overflow: "auto" }}>
              {logLines.length === 0 ? <div>Logs will appear here.</div> : logLines.map((l, idx) => <div key={idx} style={{ padding: "6px 0" }}>{l}</div>)}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}