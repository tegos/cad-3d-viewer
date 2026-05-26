// Runtime exploded view: translate each top-level child of the assembly
// outward along the vector from the assembly centroid to the child centroid.
// The catalog (krt-3d-catalog) ships pre-exploded GLB variants instead — this
// is the runtime alternative that works on any STEP without re-export.

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { BuiltModel } from '../builder';

interface ExplodeEntry {
    node: TransformNode;
    home: Vector3;
    offset: Vector3;
}

function collectMeshes(node: TransformNode, out: Mesh[]): void {
    for (const child of node.getChildren()) {
        if (child instanceof Mesh) {
            out.push(child);
        } else {
            collectMeshes(child as TransformNode, out);
        }
    }
}

function nodeCentroid(node: TransformNode): Vector3 | null {
    const meshes: Mesh[] = [];
    collectMeshes(node, meshes);
    if (meshes.length === 0) return null;
    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const m of meshes) {
        m.computeWorldMatrix(true);
        const info = m.getBoundingInfo();
        min = Vector3.Minimize(min, info.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, info.boundingBox.maximumWorld);
    }
    return Vector3.Center(min, max);
}

function modelCentroid(model: BuiltModel): Vector3 {
    if (model.meshes.length === 0) return Vector3.Zero();
    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const m of model.meshes) {
        m.computeWorldMatrix(true);
        const info = m.getBoundingInfo();
        min = Vector3.Minimize(min, info.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, info.boundingBox.maximumWorld);
    }
    return Vector3.Center(min, max);
}

function modelRadius(model: BuiltModel, center: Vector3): number {
    let max = 0;
    for (const m of model.meshes) {
        const info = m.getBoundingInfo();
        const d = Vector3.Distance(center, info.boundingBox.centerWorld);
        if (d > max) max = d;
    }
    return max || 1;
}

export class ExplodeController {
    private entries: ExplodeEntry[] = [];
    private factor = 0;

    constructor(model: BuiltModel) {
        const center = modelCentroid(model);
        const radius = modelRadius(model, center);
        // Scale the explode distance to the model's overall size so the
        // slider behaves consistently across a 10 mm bolt and a 1 m
        // assembly.
        const explodeScale = radius * 1.25;

        for (const child of model.topLevel) {
            const childCenter = nodeCentroid(child);
            if (!childCenter) continue;
            const dir = childCenter.subtract(center);
            if (dir.lengthSquared() < 1e-9) continue;
            const offset = dir.normalize().scale(explodeScale);
            this.entries.push({
                node: child,
                home: child.position.clone(),
                offset,
            });
        }
    }

    /** factor in [0, 1] */
    setFactor(factor: number): void {
        this.factor = Math.max(0, Math.min(1, factor));
        for (const e of this.entries) {
            const target = e.home.add(e.offset.scale(this.factor));
            e.node.position.copyFrom(target);
        }
    }

    getFactor(): number {
        return this.factor;
    }

    /** Number of top-level parts the slider can move. <2 means explode is a no-op. */
    get partCount(): number {
        return this.entries.length;
    }
}
