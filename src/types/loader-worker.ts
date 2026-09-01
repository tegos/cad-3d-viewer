// RPC surface the loader worker exposes over Comlink.
//
// It lives here rather than in loader.worker.ts because that file has to stay
// a plain script: a single `import`/`export` makes it an ES module, and Vite's
// dev server then serves it with a trailing `export {}` that a classic worker
// cannot parse. See loader.worker.ts for the whole story.

import type { OcctFormat, OcctReadParams, OcctResult } from './occt';

export interface LoaderWorkerApi {
    readFile(
        format: OcctFormat,
        buffer: ArrayBuffer,
        params?: OcctReadParams | null,
    ): Promise<OcctResult>;
}
