// Classic Web Worker that hosts occt-import-js. We load both occt-import-js
// and Comlink as UMD scripts via importScripts(), then expose a small RPC
// surface back to the main thread.
//
// occt-import-js is an Emscripten/UMD bundle that misbehaves inside an ESM
// worker (Vite's bundler chokes on the conditional `require('fs'|'path')`
// branches and on `_scriptName`/`__filename` probes). importScripts() loads
// it the way the upstream author tested it and avoids the whole class of
// problems.
//
// This file must stay free of `import`/`export` statements. One of them turns
// it into an ES module, and Vite's dev server then emits a trailing
// `export {}` marker that a classic worker rejects with "Unexpected token
// 'export'" — the worker dies before its first message and every load hangs on
// the progress bar. Types therefore come from inline `import(...)` type
// positions and from the ambient declarations in types/worker-globals.d.ts.

/// <reference lib="webworker" />

type OcctFormat = import('./types/occt').OcctFormat;
type OcctReadParams = import('./types/occt').OcctReadParams;
type OcctResult = import('./types/occt').OcctResult;
type LoaderWorkerApi = import('./types/loader-worker').LoaderWorkerApi;
type OcctModule = Awaited<ReturnType<typeof occtimportjs>>;

const base = __BASE_URL__;
importScripts(`${base}occt-import-js/occt-import-js.js`, `${base}comlink/comlink.js`);

let modulePromise: Promise<OcctModule> | null = null;

function getModule(): Promise<OcctModule> {
    if (!modulePromise) {
        modulePromise = occtimportjs({
            locateFile: (path) => `${base}occt-import-js/${path}`,
        });
    }
    return modulePromise;
}

async function readFile(
    format: OcctFormat,
    buffer: ArrayBuffer,
    params: OcctReadParams | null = null,
): Promise<OcctResult> {
    const occt = await getModule();
    const bytes = new Uint8Array(buffer);
    switch (format) {
        case 'step':
            return occt.ReadStepFile(bytes, params);
        case 'iges':
            return occt.ReadIgesFile(bytes, params);
        case 'brep':
            return occt.ReadBrepFile(bytes, params);
    }
}

const api: LoaderWorkerApi = { readFile };

Comlink.expose(api);
