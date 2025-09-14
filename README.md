# VisionStack

## Puter Integration & Lovable Compatibility

This project includes a full in-browser Puter integration intended for Lovable compatibility:
- Uses the Puter browser SDK when available (https://js.puter.com/v2/).
- Popup sign-in flow with persistent session (localStorage + sessionStorage).
- Auto-creates a per-user FS folder (devsparks/{userId}).
- Provides best-effort fallbacks to localStorage for FS/KV when Puter is unavailable.
- Exposes diagnostic helpers: window.PuterIntegration.runDiagnostics(), window.PuterService.runDiagnostics(), window.PuterShim.getStorageInfo().
- UI bindings already present for: Sign In, Storage Info, Connectivity Test, and Tutorials.

Quick pointers:
- Tutorials button in the header opens Puter tutorials: https://developer.puter.com/tutorials/
- For programmatic access, use the exported integration:
  - window.lovablePuter (global wrapper)
  - import puterIntegration from '/src/integrations/puter/puter_integration.ts'
  - import PuterService from '/puter_services.js'

Tweakable items:
- Many integration and UI behaviors are annotated with /* @tweakable */ comments in the source for quick adjustments (timeouts, folder base, UI text).

Lovable notes:
- The project uses a Vite setup; it is structured for browser-only deployment and should open/preview in Lovable.
- Ensure the Puter SDK script (https://js.puter.com/v2/) is allowed by the environment; the integration auto-falls back if blocked.

See src/integrations/puter/puter_integration.ts and puter_integration.js for implementation details and tweakable parameters.