// Fit-to-view: derive an AABB from the supplied meshes and aim the
// ArcRotateCamera at the center with a radius proportional to the bounding
// sphere. Pattern adapted from krt-3d-catalog/public/assets/js/script.js:216-239.

import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export function frameCamera(camera: ArcRotateCamera, meshes: AbstractMesh[]): void {
    if (meshes.length === 0) return;

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);

    for (const mesh of meshes) {
        if (!mesh.getBoundingInfo) continue;
        mesh.computeWorldMatrix(true);
        const info = mesh.getBoundingInfo();
        min = Vector3.Minimize(min, info.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, info.boundingBox.maximumWorld);
    }

    if (!isFinite(min.x) || !isFinite(max.x)) return;

    const center = Vector3.Center(min, max);
    const radius = Vector3.Distance(min, max) / 2;
    const safeRadius = radius > 0 ? radius : 1;

    camera.target = center;
    camera.radius = safeRadius * 2.2;
    camera.lowerRadiusLimit = safeRadius * 0.1;
    camera.upperRadiusLimit = safeRadius * 50;
    camera.minZ = Math.max(safeRadius * 0.001, 0.0001);
    camera.maxZ = safeRadius * 200;
}
