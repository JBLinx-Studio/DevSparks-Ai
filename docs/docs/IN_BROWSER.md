
```
# In-Browser Compilation & Sandbox Preview

Purpose
- Provide instant previews of arbitrary user code (TS/JSX/Svelte/Vue/Solid) in a sandboxed iframe using a lightweight in-browser compiler.

Recommended approach
1. Worker-based transpilation
   - Create a web worker that loads esbuild-wasm (or swc-wasm).
   - The main UI sends source files to the worker for transpilation into ESM JavaScript.

2. Dependency resolution
   - For third-party modules, prefer on-demand ESM CDN resolution:
     - esm.sh (https://esm.sh)
     - jspm.io
   - Example import rewrite:
     - import React from 'react'  --> import React from 'https://esm.sh/react'

3. Sandbox & execution
   - Create a sandboxed iframe with attributes: sandbox="allow-scripts allow-same-origin"
   - Inject a small runtime that mounts the compiled code and captures console output and errors.
   - Use postMessage to communicate between host and iframe.

4. Assets & uploads
   - For user images/files, upload to your blob store (websim.upload or equivalent) and reference returned URLs in the compiled output.

Security considerations
- Never eval user code in the main thread.
- Use strict iframe sandboxing and Content Security Policy.
- Limit network access for previews if possible (CSP / iframe policies).

Performance tips
- Cache transpilation results for unchanged inputs.
- Use esbuild-wasm for speed; warm the worker early.
- Offload heavy tasks to a separate worker pool when previewing large projects.