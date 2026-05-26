declare module 'occt-import-js' {
    import type { OcctResult, OcctReadParams } from './occt';

    interface OcctModuleOptions {
        locateFile?: (path: string, prefix: string) => string;
    }

    interface OcctModule {
        ReadStepFile(buffer: Uint8Array, params: OcctReadParams | null): OcctResult;
        ReadIgesFile(buffer: Uint8Array, params: OcctReadParams | null): OcctResult;
        ReadBrepFile(buffer: Uint8Array, params: OcctReadParams | null): OcctResult;
    }

    function occtimportjs(opts?: OcctModuleOptions): Promise<OcctModule>;
    export default occtimportjs;
}
