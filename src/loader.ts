// Main-thread API for STEP/IGES/BREP loading. Spawns the worker lazily so the
// WASM download only happens after the first user action.

import * as Comlink from 'comlink';
import type { LoaderWorkerApi } from './loader.worker';
import type { OcctFormat, OcctReadParams, OcctResult } from './types/occt';

// 90 MB practical ceiling. Upstream's 32-bit Emscripten heap caps STEP parsing
// somewhere around 100 MB — we bail a bit before that for a friendlier error
// instead of an obscure OOM.
export const MAX_FILE_BYTES = 90 * 1024 * 1024;

let workerProxy: Comlink.Remote<LoaderWorkerApi> | null = null;

function getWorker(): Comlink.Remote<LoaderWorkerApi> {
    if (!workerProxy) {
        // Classic worker — see loader.worker.ts for why ESM workers don't
        // play well with the upstream Emscripten UMD bundle.
        const worker = new Worker(new URL('./loader.worker.ts', import.meta.url), {
            type: 'classic',
        });
        workerProxy = Comlink.wrap<LoaderWorkerApi>(worker);
    }
    return workerProxy;
}

export class FileTooLargeError extends Error {
    constructor(public sizeBytes: number) {
        super(`File is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB. Limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
        this.name = 'FileTooLargeError';
    }
}

export class UnsupportedFormatError extends Error {
    constructor(public ext: string) {
        super(`Unsupported file extension ".${ext}". Use .step/.stp, .iges/.igs, or .brep.`);
        this.name = 'UnsupportedFormatError';
    }
}

export class OcctReadError extends Error {
    constructor() {
        super('occt-import-js returned success=false. The file may be corrupt or contain unsupported entities.');
        this.name = 'OcctReadError';
    }
}

export function detectFormat(filename: string): OcctFormat {
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    if (ext === 'step' || ext === 'stp') return 'step';
    if (ext === 'iges' || ext === 'igs') return 'iges';
    if (ext === 'brep') return 'brep';
    throw new UnsupportedFormatError(ext);
}

export async function loadCadFile(
    file: File | Blob,
    filename: string,
    params: OcctReadParams | null = null,
): Promise<OcctResult> {
    if (file.size > MAX_FILE_BYTES) {
        throw new FileTooLargeError(file.size);
    }
    const format = detectFormat(filename);
    const buffer = await file.arrayBuffer();
    const worker = getWorker();
    // Comlink transfers the ArrayBuffer (ownership moves to the worker), which
    // avoids cloning multi-MB payloads.
    const result = await worker.readFile(format, Comlink.transfer(buffer, [buffer]), params);
    if (!result.success) {
        throw new OcctReadError();
    }
    return result;
}
