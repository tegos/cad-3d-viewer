// Classic Web Worker that hosts occt-import-js. We load both occt-import-js
// and Comlink as UMD scripts via importScripts(), then expose a small RPC
// surface back to the main thread.
//
// occt-import-js is an Emscripten/UMD bundle that misbehaves inside an ESM
// worker (Vite's bundler chokes on the conditional `require('fs'|'path')`
// branches and on `_scriptName`/`__filename` probes). importScripts() loads
// it the way the upstream author tested it and avoids the whole class of
// problems.

/// <reference lib="webworker" />
import type { OcctFormat, OcctReadParams, OcctResult } from './types/occt';

declare const importScripts: (...urls: string[]) => void;
declare const __BASE_URL__: string;
declare const Comlink: typeof import('comlink');
declare const occtimportjs: (opts?: { locateFile?: (p: string, prefix: string) => string }) => Promise<{
    ReadStepFile: (b: Uint8Array, p: OcctReadParams | null) => OcctResult;
    ReadIgesFile: (b: Uint8Array, p: OcctReadParams | null) => OcctResult;
    ReadBrepFile: (b: Uint8Array, p: OcctReadParams | null) => OcctResult;
}>;

const base = __BASE_URL__;
importScripts(`${base}occt-import-js/occt-import-js.js`, `${base}comlink/comlink.js`);

type OcctModule = Awaited<ReturnType<typeof occtimportjs>>;

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

const api = { readFile };
export type LoaderWorkerApi = typeof api;

Comlink.expose(api);
