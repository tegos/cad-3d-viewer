// Globals the classic loader worker picks up from importScripts(). They are
// ambient rather than imported so loader.worker.ts stays a script and not an
// ES module.

declare const occtimportjs: (opts?: {
    locateFile?: (p: string, prefix: string) => string;
}) => Promise<{
    ReadStepFile: (
        b: Uint8Array,
        p: import('./occt').OcctReadParams | null,
    ) => import('./occt').OcctResult;
    ReadIgesFile: (
        b: Uint8Array,
        p: import('./occt').OcctReadParams | null,
    ) => import('./occt').OcctResult;
    ReadBrepFile: (
        b: Uint8Array,
        p: import('./occt').OcctReadParams | null,
    ) => import('./occt').OcctResult;
}>;

declare const Comlink: typeof import('comlink');
