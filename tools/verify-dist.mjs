// Post-build guard for the runtime assets that no bundler graph points at.
// The worker reaches occt-import-js and comlink through importScripts() with
// hand-written URLs, so a copy plugin that silently changes its output layout
// (vite-plugin-static-copy 4 did) produces a build that looks fine and 404s in
// the browser. Fail the build instead of deploying that.
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const required = [
    'occt-import-js/occt-import-js.js',
    'occt-import-js/occt-import-js.wasm',
    'occt-import-js/license.occt-import-js.txt',
    'occt-import-js/license.occt.txt',
    'comlink/comlink.js',
    'index.html',
];

const dist = join(process.cwd(), 'dist');
const missing = required.filter((f) => {
    const path = join(dist, f);
    return !existsSync(path) || !statSync(path).isFile();
});

if (missing.length > 0) {
    console.error('dist is missing required runtime assets:');
    for (const f of missing) console.error(`  - dist/${f}`);
    process.exit(1);
}

console.log(`verify-dist: ${required.length} required assets present`);
