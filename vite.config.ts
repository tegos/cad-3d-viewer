import process from 'node:process';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Copy the occt-import-js WASM artifact into /occt-import-js/ at the web root
// so the worker's locateFile() can resolve it with a stable URL in both dev
// and production builds.
// GitHub Pages serves a project site from /<repo>/, so the base has to match
// the repository name. Deriving it from GITHUB_REPOSITORY rather than
// hardcoding means a fork deploys to its own path instead of silently 404ing
// on every asset. Any other CI keys off the same variable being absent.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = repo ? `/${repo}/` : '/';

export default defineConfig(() => ({
    base,
    define: {
        __BASE_URL__: JSON.stringify(base),
    },
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: 'node_modules/occt-import-js/dist/occt-import-js.wasm',
                    dest: 'occt-import-js',
                },
                {
                    src: 'node_modules/occt-import-js/dist/occt-import-js.js',
                    dest: 'occt-import-js',
                },
                {
                    src: 'node_modules/comlink/dist/umd/comlink.js',
                    dest: 'comlink',
                },
                // occt-import-js is LGPL-2.1 and OCCT itself is LGPL-2.1 with
                // the Open CASCADE exception; both require the license to
                // travel with the binary we ship, so the texts go out next to
                // the .wasm rather than living only in node_modules.
                {
                    src: 'node_modules/occt-import-js/dist/license.occt-import-js.txt',
                    dest: 'occt-import-js',
                },
                {
                    src: 'node_modules/occt-import-js/dist/license.occt.txt',
                    dest: 'occt-import-js',
                },
            ],
        }),
    ],
    // The occt-import-js bundle is an Emscripten UMD that doesn't survive ESM
    // bundling cleanly (TLA-from-Node-require detection in Vite, plus the
    // worker-format conversion clobbers `_scriptName`). We sidestep the
    // problem by loading it the way it was designed — via importScripts() in
    // a classic worker.
    worker: {
        format: 'iife' as const,
    },
    build: {
        target: 'es2022',
        // Source maps stay off: they add ~8 MB to a Pages artifact that
        // already carries a 7.3 MB WASM binary.
        sourcemap: false,
        // No manualChunks: splitting @babylonjs into its own chunk was tried
        // and cost 640 kB (1.91 MB -> 2.55 MB), because the chunk boundary
        // forces Rollup to keep exports that it otherwise shakes out.
    },
    // The occt-import-js bundle contains node-only require() paths that Vite
    // tries (and fails) to resolve. The library detects the browser at runtime
    // and never hits them, so we exclude it from optimizeDeps to keep Vite
    // from rewriting its module imports.
    optimizeDeps: {
        exclude: ['occt-import-js'],
    },
    server: {
        port: 5173,
    },
}));
