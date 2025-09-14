import buildManager from './buildManager.js';

// prepare sources
const sources = {
  'index.tsx': 'import React from "react"; console.log("hi");',
};
// detect entry
const entry = buildManager.detectEntry(sources);
// bundle and get a lockfile
const { code, warnings, errors, lockfile } = await buildManager.bundleWithLock(sources, entry, {
  packageJson: { name: 'preview', dependencies: { react: '^18.2.0' } },
  sourcemap: true
});
// inject code into a sandboxed iframe or save lockfile via JSON.stringify(lockfile)