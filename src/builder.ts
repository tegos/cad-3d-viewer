// Convert the OCCT JSON result into a Babylon mesh tree.
//
// OCCT bakes transforms into the triangulated vertex positions, so the node
// hierarchy has no transform field — we mirror it with TransformNodes purely
// for the assembly tree UI and for the exploded-view feature, which translates
// top-level children outward from their shared centroid.
//
// Per-face B-rep ranges become Babylon SubMeshes, one per face. SubMeshes give
// us face-level pick targets (PickingInfo.subMeshId) and a clean place to
// stamp per-face vertex colors for hover/select highlights.

import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';

import type { OcctColor, OcctMesh, OcctNode, OcctResult } from './types/occt';
import { decodeName, decodeOrLabel } from './utils/decode-names';

export interface FaceRef {
    mesh: Mesh;
    submeshIndex: number;
    nodeName: string;
    faceIndex: number;
    homeColor: [number, number, number, number];
}

export interface BuiltModel {
    root: TransformNode;
    meshes: Mesh[];
    /** Lookup: `${mesh.uniqueId}:${submeshIndex}` → FaceRef. */
    faces: Map<string, FaceRef>;
    /** Top-level children of the root — what exploded view operates on. */
    topLevel: TransformNode[];
}

const DEFAULT_COLOR: OcctColor = [0.78, 0.78, 0.82];

function faceKey(mesh: Mesh, submeshIndex: number): string {
    return `${mesh.uniqueId}:${submeshIndex}`;
}

function pickFaceColor(meshColor: OcctColor | undefined, faceColor: OcctColor | null): OcctColor {
    if (faceColor) return faceColor;
    if (meshColor) return meshColor;
    return DEFAULT_COLOR;
}

function ensureNormals(positions: number[], indices: number[], normals?: number[]): number[] {
    if (normals && normals.length === positions.length) return normals;
    const computed: number[] = new Array(positions.length).fill(0);
    VertexData.ComputeNormals(positions, indices, computed);
    return computed;
}

function buildVertexColors(mesh: OcctMesh): { colors: number[]; faceMap: { color: OcctColor }[] } {
    const vertexCount = mesh.attributes.position.array.length / 3;
    // Prefill with the mesh's default color so any vertex not referenced by a
    // brep_face still renders correctly (some STEP exports leave gaps in
    // face coverage; the upstream JSON ships those triangles unannotated).
    const baseColor = mesh.color ?? DEFAULT_COLOR;
    const colors = new Array<number>(vertexCount * 4);
    for (let i = 0; i < vertexCount; i++) {
        colors[i * 4] = baseColor[0];
        colors[i * 4 + 1] = baseColor[1];
        colors[i * 4 + 2] = baseColor[2];
        colors[i * 4 + 3] = 1;
    }
    const indices = mesh.index.array;
    const faceMap: { color: OcctColor }[] = [];

    for (const face of mesh.brep_faces) {
        const color = pickFaceColor(mesh.color, face.color);
        faceMap.push({ color });

        // first/last reference triangle indices (per the docs). Each triangle
        // owns 3 entries in `indices`, and each indexed vertex gets the same
        // RGBA stamp so the face renders flat-shaded with its OCCT color.
        for (let tri = face.first; tri <= face.last; tri++) {
            const base = tri * 3;
            for (let k = 0; k < 3; k++) {
                const vertexIdx = indices[base + k];
                if (vertexIdx === undefined) continue;
                const c = vertexIdx * 4;
                colors[c] = color[0];
                colors[c + 1] = color[1];
                colors[c + 2] = color[2];
                colors[c + 3] = 1;
            }
        }
    }

    return { colors, faceMap };
}

function createBabylonMesh(
    scene: Scene,
    occtMesh: OcctMesh,
    parent: TransformNode,
    nodeName: string,
    faces: Map<string, FaceRef>,
    meshCounter: { n: number },
): Mesh {
    const meshName = decodeOrLabel(occtMesh.name, meshCounter, 'Mesh');
    const mesh = new Mesh(meshName, scene, parent);

    const positions = occtMesh.attributes.position.array;
    const indices = occtMesh.index.array;
    const normals = ensureNormals(positions, indices, occtMesh.attributes.normal?.array);

    const { colors, faceMap } = buildVertexColors(occtMesh);

    const data = new VertexData();
    data.positions = positions;
    data.normals = normals;
    data.indices = indices;
    data.colors = colors;
    data.applyToMesh(mesh, true);

    // We update vertex colors on hover/select, so keep the buffer updatable.
    mesh.markVerticesDataAsUpdatable(VertexBuffer.ColorKind, true);

    // StandardMaterial picks up vertex colors automatically, which lets the
    // per-face hover/select tint flow through without a custom shader.
    const material = new StandardMaterial(`${mesh.name}-mat`, scene);
    material.diffuseColor = new Color3(1, 1, 1);
    material.specularColor = new Color3(0.2, 0.2, 0.2);
    material.backFaceCulling = false;
    mesh.material = material;
    mesh.hasVertexAlpha = false;

    // One SubMesh per OCCT face — gives us PickingInfo.subMeshId per face.
    // The SubMesh constructor pushes itself onto mesh.subMeshes, so we clear
    // the auto-created cover-all submesh first.
    mesh.subMeshes = [];
    const vertexCount = positions.length / 3;
    faceMap.forEach((info, i) => {
        const face = occtMesh.brep_faces[i];
        if (!face) return;
        const indexStart = face.first * 3;
        const indexCount = (face.last - face.first + 1) * 3;
        new SubMesh(0, 0, vertexCount, indexStart, indexCount, mesh);
        const submeshIndex = mesh.subMeshes.length - 1;
        faces.set(faceKey(mesh, submeshIndex), {
            mesh,
            submeshIndex,
            nodeName,
            faceIndex: i,
            homeColor: [info.color[0], info.color[1], info.color[2], 1],
        });
    });

    return mesh;
}

interface BuildCounters {
    part: { n: number };
    mesh: { n: number };
}

function walkNode(
    scene: Scene,
    occtResult: OcctResult,
    occtNode: OcctNode,
    parent: TransformNode,
    out: BuiltModel,
    counters: BuildCounters,
): TransformNode {
    const nodeName = decodeOrLabel(occtNode.name, counters.part, 'Part');
    const node = new TransformNode(nodeName, scene);
    node.parent = parent;

    for (const meshIdx of occtNode.meshes) {
        const occtMesh = occtResult.meshes[meshIdx];
        if (!occtMesh) continue;
        const m = createBabylonMesh(scene, occtMesh, node, nodeName, out.faces, counters.mesh);
        out.meshes.push(m);
    }

    for (const child of occtNode.children) {
        walkNode(scene, occtResult, child, node, out, counters);
    }

    return node;
}

export function buildModel(scene: Scene, result: OcctResult): BuiltModel {
    const rootName = decodeName(result.root.name) || 'model-root';
    const root = new TransformNode(rootName, scene);

    const out: BuiltModel = {
        root,
        meshes: [],
        faces: new Map(),
        topLevel: [],
    };

    const counters: BuildCounters = {
        part: { n: 0 },
        mesh: { n: 0 },
    };

    // Root meshes (rare but valid) attach directly to root.
    for (const meshIdx of result.root.meshes) {
        const occtMesh = result.meshes[meshIdx];
        if (!occtMesh) continue;
        const m = createBabylonMesh(scene, occtMesh, root, rootName, out.faces, counters.mesh);
        out.meshes.push(m);
    }

    for (const child of result.root.children) {
        const childNode = walkNode(scene, result, child, root, out, counters);
        out.topLevel.push(childNode);
    }

    return out;
}
