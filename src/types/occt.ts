// Type definitions for the JSON result returned by occt-import-js.
// Mirrors the structure documented at:
// https://github.com/kovacsv/occt-import-js#processing-the-result

export type OcctColor = [number, number, number];

export interface OcctBrepFace {
    first: number;
    last: number;
    color: OcctColor | null;
}

export interface OcctMesh {
    name: string;
    color?: OcctColor;
    brep_faces: OcctBrepFace[];
    attributes: {
        position: { array: number[] };
        normal?: { array: number[] };
    };
    index: { array: number[] };
}

export interface OcctNode {
    name: string;
    meshes: number[];
    children: OcctNode[];
}

export interface OcctResult {
    success: boolean;
    root: OcctNode;
    meshes: OcctMesh[];
}

export type OcctFormat = 'step' | 'iges' | 'brep';

export interface OcctReadParams {
    linearUnit?: 'millimeter' | 'centimeter' | 'meter' | 'inch' | 'foot';
    linearDeflectionType?: 'bounding_box_ratio' | 'absolute_value';
    linearDeflection?: number;
    angularDeflection?: number;
}
