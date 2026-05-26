// Two-point distance measurement. Tap "Measure", click two surface points,
// see the line and distance label. Distance is reported in the OCCT linear
// unit passed at load time (millimetre by default).

import { PointerEventTypes, type PointerInfo } from '@babylonjs/core/Events/pointerEvents';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Scene } from '@babylonjs/core/scene';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Control } from '@babylonjs/gui/2D/controls/control';

import '@babylonjs/core/Rendering/edgesRenderer';

interface ActiveMeasure {
    line: LinesMesh;
    anchor: Mesh;
    label: Rectangle;
    textBlock: TextBlock;
}

export class MeasureController {
    private gui: AdvancedDynamicTexture;
    private active: ActiveMeasure | null = null;
    private pendingStart: Vector3 | null = null;
    private observer: ReturnType<Scene['onPointerObservable']['add']> | null = null;
    private enabled = false;

    constructor(private scene: Scene, private unit: string = 'mm') {
        this.gui = AdvancedDynamicTexture.CreateFullscreenUI('measure-ui', true, scene);
    }

    setUnit(unit: string): void {
        this.unit = unit;
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.clear();
            this.pendingStart = null;
            if (this.observer) {
                this.scene.onPointerObservable.remove(this.observer);
                this.observer = null;
            }
            const canvas = this.scene.getEngine().getRenderingCanvas();
            if (canvas) canvas.style.cursor = '';
            return;
        }
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) canvas.style.cursor = 'crosshair';
        this.observer = this.scene.onPointerObservable.add((info) => this.handlePointer(info));
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    clear(): void {
        if (this.active) {
            this.active.line.dispose();
            this.active.anchor.dispose();
            this.gui.removeControl(this.active.label);
            this.active = null;
        }
    }

    private handlePointer(info: PointerInfo): void {
        if (info.type !== PointerEventTypes.POINTERPICK) return;
        const pick = info.pickInfo;
        if (!pick?.hit || !pick.pickedPoint) return;

        if (!this.pendingStart) {
            this.clear();
            this.pendingStart = pick.pickedPoint.clone();
            return;
        }

        const start = this.pendingStart;
        const end = pick.pickedPoint.clone();
        this.pendingStart = null;
        this.draw(start, end);
    }

    private draw(start: Vector3, end: Vector3): void {
        const line = MeshBuilder.CreateLines(
            'measure-line',
            { points: [start, end], updatable: false },
            this.scene,
        );
        line.color = new Color3(1, 0.3, 0);
        line.isPickable = false;
        line.renderingGroupId = 2;

        const midpoint = Vector3.Center(start, end);
        const anchor = MeshBuilder.CreateSphere(
            'measure-anchor',
            { diameter: 0.0001, segments: 4 },
            this.scene,
        );
        anchor.position.copyFrom(midpoint);
        anchor.isPickable = false;
        const mat = new StandardMaterial('measure-anchor-mat', this.scene);
        mat.alpha = 0;
        anchor.material = mat;

        const label = new Rectangle('measure-label');
        label.width = '120px';
        label.height = '28px';
        label.cornerRadius = 6;
        label.color = 'transparent';
        label.background = 'rgba(20, 20, 30, 0.85)';
        label.thickness = 0;
        label.linkOffsetY = -24;
        const text = new TextBlock();
        text.color = '#ffffff';
        text.fontSize = 13;
        text.fontFamily = 'system-ui, sans-serif';
        const distance = Vector3.Distance(start, end);
        text.text = `${distance.toFixed(2)} ${this.unit}`;
        text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        label.addControl(text);

        this.gui.addControl(label);
        label.linkWithMesh(anchor);

        this.active = { line, anchor, label, textBlock: text };
    }

    dispose(): void {
        this.clear();
        if (this.observer) {
            this.scene.onPointerObservable.remove(this.observer);
            this.observer = null;
        }
        this.gui.dispose();
    }
}
