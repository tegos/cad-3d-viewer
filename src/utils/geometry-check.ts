// Guard against occt-import-js reporting success while handing back nothing
// to draw.
//
// The upstream WASM module is a 32-bit emscripten build whose heap is capped
// at 2 GB (`getHeapMax()` returns 2147483648). A large STEP assembly can hit
// that ceiling while OCCT is still reading the file. OCCT swallows the failed
// allocations rather than aborting, so `ReadStepFile` returns success=true
// with a complete, correctly named node tree — and every mesh in it carrying
// zero triangles. Upstream tracks this as kovacsv/occt-import-js#19 (same
// symptom, confirmed specific to the emscripten build) and #59 (the 2 GB cap).
//
// Without this check the viewer builds thousands of empty Babylon meshes and
// toasts "Loaded 2873 mesh(es)" over an empty viewport, which reads as a
// viewer bug rather than a parser limit.

import type { OcctResult } from '../types/occt';

/**
 * True when the result carries at least one triangle, or no meshes at all.
 *
 * A result with zero meshes is left alone deliberately: that means the file
 * genuinely held no shapes, which callers already report separately.
 */
export function hasGeometry(result: OcctResult): boolean {
    if (result.meshes.length === 0) return true;
    return result.meshes.some((mesh) => mesh.index.array.length > 0);
}
