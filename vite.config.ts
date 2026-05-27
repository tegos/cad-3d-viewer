import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Copy the occt-import-js WASM artifact into /occt-import-js/ at the web root
// so the worker's locateFile() can resolve it with a stable URL in both dev
// and production builds.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const base = (globalThis as any).process?.env?.CI ? '/cad-3d-viewer/' : '/';

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
        sourcemap: false,
        rollupOptions: {
            external: ['@babylonjs/inspector'],
        },
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
