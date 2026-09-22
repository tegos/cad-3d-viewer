import { describe, expect, it } from 'vitest';
import { hasGeometry } from './geometry-check';
import type { OcctMesh, OcctResult } from '../types/occt';

function mesh(triangleCount: number, faceCount = 1): OcctMesh {
    return {
        name: '',
        brep_faces: Array.from({ length: faceCount }, (_, i) => ({
            first: i,
            last: i,
            color: null,
        })),
        attributes: {
            position: { array: new Array(triangleCount * 9).fill(0) },
            normal: { array: new Array(triangleCount * 9).fill(0) },
        },
        index: { array: new Array(triangleCount * 3).fill(0) },
    };
}

function result(meshes: OcctMesh[]): OcctResult {
    return {
        success: true,
        root: { name: 'root', meshes: meshes.map((_, i) => i), children: [] },
        meshes,
    };
}

describe('hasGeometry', () => {
    it('accepts a result with triangles', () => {
        expect(hasGeometry(result([mesh(12)]))).toBe(true);
    });

    // The Cruise_Assembly.stp case from issue #24: OCCT exhausts the 2 GB
    // WebAssembly heap while reading, then reports success with a full node
    // tree whose every mesh carries zero triangles.
    it('rejects a result whose meshes are all empty', () => {
        const meshes = Array.from({ length: 2873 }, () => mesh(0, 10));
        expect(hasGeometry(result(meshes))).toBe(false);
    });

    it('accepts a result where only some meshes are empty', () => {
        expect(hasGeometry(result([mesh(0), mesh(4), mesh(0)]))).toBe(true);
    });

    // A file that legitimately contains no shapes is not the failure this
    // guard is for — main.ts already reports that case on its own.
    it('accepts a result with no meshes at all', () => {
        expect(hasGeometry(result([]))).toBe(true);
    });
});
