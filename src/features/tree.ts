// Assembly tree rendering. Maps the OCCT node hierarchy into nested
// <details>/<summary> rows. Each row has a visibility toggle and a
// frame-on-click action; clicking the row label fits the camera to the
// subtree's meshes.

import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { frameCamera } from '../camera-frame';

function collectMeshes(node: TransformNode, out: Mesh[]): void {
    for (const child of node.getChildren()) {
        if (child instanceof Mesh) {
            out.push(child);
        } else if (child instanceof TransformNode) {
            collectMeshes(child, out);
        }
    }
}

function toggleVisibility(node: TransformNode, visible: boolean): void {
    const meshes: Mesh[] = [];
    collectMeshes(node, meshes);
    for (const m of meshes) m.setEnabled(visible);
}

function renderNode(
    node: TransformNode,
    camera: ArcRotateCamera,
    depth: number,
): HTMLElement {
    const children = node.getChildren().filter((c) => c instanceof TransformNode) as TransformNode[];
    const hasChildren = children.length > 0;
    const meshes: Mesh[] = [];
    collectMeshes(node, meshes);

    let container: HTMLElement;
    let summary: HTMLElement;

    if (hasChildren) {
        const details = document.createElement('details');
        details.open = depth < 2;
        const sum = document.createElement('summary');
        sum.className = 'tree-row';
        details.appendChild(sum);
        container = details;
        summary = sum;
    } else {
        const row = document.createElement('div');
        row.className = 'tree-row tree-row--leaf';
        container = row;
        summary = row;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.title = 'Show/hide';
    checkbox.addEventListener('click', (e) => e.stopPropagation());
    checkbox.addEventListener('change', () => toggleVisibility(node, checkbox.checked));
    summary.appendChild(checkbox);

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.name || '(unnamed)';
    label.title = 'Click to frame';
    label.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        frameCamera(camera, meshes);
    });
    summary.appendChild(label);

    const count = document.createElement('span');
    count.className = 'tree-count';
    count.textContent = String(meshes.length);
    count.title = `${meshes.length} mesh(es) below`;
    summary.appendChild(count);

    for (const child of children) {
        const childEl = renderNode(child, camera, depth + 1);
        container.appendChild(childEl);
    }

    return container;
}

export function renderTree(
    root: TransformNode,
    container: HTMLElement,
    camera: ArcRotateCamera,
): void {
    container.replaceChildren();
    const rootEl = renderNode(root, camera, 0);
    container.appendChild(rootEl);
}
