// Main-thread API for STEP/IGES/BREP loading. Spawns the worker lazily so the
// WASM download only happens after the first user action.

import * as Comlink from 'comlink';
import type { LoaderWorkerApi } from './loader.worker';
import type { OcctFormat, OcctReadParams, OcctResult } from './types/occt';

// 90 MB practical ceiling. Upstream's 32-bit Emscripten heap caps STEP parsing
// somewhere around 100 MB — we bail a bit before that for a friendlier error
// instead of an obscure OOM.
export const MAX_FILE_BYTES = 90 * 1024 * 1024;

interface WorkerHandle {
    worker: Worker;
    proxy: Comlink.Remote<LoaderWorkerApi>;
}

let handle: WorkerHandle | null = null;

// Comlink installs no error listener of its own, so if the worker dies before
// it can post a reply — a 404 on the Emscripten bundle under a wrong base URL,
// a syntax error, an abort() from the WASM heap — the pending readFile()
// promise never settles and the caller's `finally` never runs. Anything
// waiting on the current call is parked here so the worker's own error event
// can reject it.
let pendingRejects: ((err: Error) => void)[] = [];

function killWorker(err: Error): void {
    handle?.worker.terminate();
    handle = null;
    const waiting = pendingRejects;
    pendingRejects = [];
    for (const reject of waiting) reject(err);
}

function getWorker(): Comlink.Remote<LoaderWorkerApi> {
    if (!handle) {
        // Classic worker — see loader.worker.ts for why ESM workers don't
        // play well with the upstream Emscripten UMD bundle.
        const worker = new Worker(new URL('./loader.worker.ts', import.meta.url), {
            type: 'classic',
        });
        worker.addEventListener('error', (e) => {
            killWorker(new WorkerFailedError(e.message || 'worker script failed to load'));
        });
        worker.addEventListener('messageerror', () => {
            killWorker(new WorkerFailedError('worker sent a message that could not be deserialized'));
        });
        handle = { worker, proxy: Comlink.wrap<LoaderWorkerApi>(worker) };
    }
    return handle.proxy;
}

/** Reject `call` as soon as the worker dies, instead of hanging forever. */
function untilWorkerDies<T>(call: Promise<T>): Promise<T> {
    const death = new Promise<never>((_, reject) => {
        pendingRejects.push(reject);
    });
    return Promise.race([call, death]).finally(() => {
        pendingRejects = [];
    });
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

export class WorkerFailedError extends Error {
    constructor(detail: string) {
        super(`The CAD parser worker stopped: ${detail}. Try loading the file again.`);
        this.name = 'WorkerFailedError';
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
    const result = await untilWorkerDies(
        worker.readFile(format, Comlink.transfer(buffer, [buffer]), params),
    );
    // A success=false result means OCCT rejected the file, not that the worker
    // is broken — it stays up for the next load. Only killWorker() retires it.
    if (!result.success) {
        throw new OcctReadError();
    }
    return result;
}
