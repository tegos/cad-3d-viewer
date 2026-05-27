// Pointer-driven face picking. Babylon's PickingInfo reports the subMeshId
// that was hit; we look that up in BuiltModel.faces and stamp a hover/select
// color into the affected vertex color range.

import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { BuiltModel, FaceRef } from '../builder';

const HOVER_COLOR: [number, number, number, number] = [0.2, 0.7, 1.0, 1.0];
const SELECT_COLOR: [number, number, number, number] = [1.0, 0.55, 0.1, 1.0];

export interface PickingState {
    hovered: FaceRef | null;
    selected: FaceRef | null;
}

export interface PickingHandlers {
    onSelect?: (face: FaceRef | null) => void;
}

function stampFaceColor(face: FaceRef, color: [number, number, number, number]): void {
    const mesh = face.mesh;
    const submesh = mesh.subMeshes[face.submeshIndex];
    if (!submesh) return;
    const indices = mesh.getIndices();
    const colors = mesh.getVerticesData(VertexBuffer.ColorKind);
    if (!indices || !colors) return;

    const start = submesh.indexStart;
    const end = start + submesh.indexCount;
    for (let i = start; i < end; i++) {
        const v = indices[i];
        if (v === undefined) continue;
        const c = v * 4;
        colors[c] = color[0];
        colors[c + 1] = color[1];
        colors[c + 2] = color[2];
        colors[c + 3] = color[3];
    }
    mesh.updateVerticesData(VertexBuffer.ColorKind, colors);
}

function restoreFaceColor(face: FaceRef): void {
    stampFaceColor(face, face.homeColor);
}

function pickedMeshIsPart(model: BuiltModel, mesh: Mesh | null | undefined): mesh is Mesh {
    if (!mesh) return false;
    return model.meshes.includes(mesh);
}

export function attachPicking(
    scene: Scene,
    getModel: () => BuiltModel | null,
    handlers: PickingHandlers = {},
    isDisabled?: () => boolean,
): () => void {
    const state: PickingState = { hovered: null, selected: null };

    const observer = scene.onPointerObservable.add((info) => {
        if (isDisabled?.()) return;
        const model = getModel();
        if (!model) return;

        if (info.type === PointerEventTypes.POINTERMOVE) {
            const pick = info.pickInfo;
            if (!pick || !pick.hit || !pickedMeshIsPart(model, pick.pickedMesh as Mesh)) {
                if (state.hovered && state.hovered !== state.selected) {
                    restoreFaceColor(state.hovered);
                }
                state.hovered = null;
                scene.getEngine().getRenderingCanvas()!.style.cursor = '';
                return;
            }
            const face = model.faces.get(`${(pick.pickedMesh as Mesh).uniqueId}:${pick.subMeshId}`);
            if (face && face !== state.hovered) {
                if (state.hovered && state.hovered !== state.selected) {
                    restoreFaceColor(state.hovered);
                }
                state.hovered = face;
                if (face !== state.selected) stampFaceColor(face, HOVER_COLOR);
                scene.getEngine().getRenderingCanvas()!.style.cursor = 'pointer';
            }
            return;
        }

        if (info.type === PointerEventTypes.POINTERPICK) {
            const pick = info.pickInfo;
            if (state.selected) restoreFaceColor(state.selected);
            if (!pick || !pick.hit || !pickedMeshIsPart(model, pick.pickedMesh as Mesh)) {
                state.selected = null;
                handlers.onSelect?.(null);
                return;
            }
            const face = model.faces.get(`${(pick.pickedMesh as Mesh).uniqueId}:${pick.subMeshId}`);
            if (face) {
                stampFaceColor(face, SELECT_COLOR);
                state.selected = face;
                handlers.onSelect?.(face);
            } else {
                state.selected = null;
                handlers.onSelect?.(null);
            }
        }
    });

    return () => {
        scene.onPointerObservable.remove(observer);
    };
}
