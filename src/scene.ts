// Babylon scene bootstrap: engine, ArcRotateCamera, hemi + directional, prefiltered IBL.
// Mirrors the proven baseline from krt-3d-catalog/public/assets/js/script.js:43-86.

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Helpers/sceneHelpers';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';

export interface SceneBundle {
    engine: Engine;
    scene: Scene;
    camera: ArcRotateCamera;
}

const ENV_URL =
    'https://assets.babylonjs.com/environments/environmentSpecular.env';

export function createScene(canvas: HTMLCanvasElement): SceneBundle {
    // No preserveDrawingBuffer: screenshots render to an offscreen target
    // (features/screenshot.ts), so nothing ever reads this canvas back, and
    // keeping the buffer alive costs a no-discard on every frame.
    const engine = new Engine(canvas, true, {
        stencil: true,
        antialias: true,
    });

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.925, 0.925, 0.925, 1);
    scene.ambientColor = new Color3(0.3, 0.3, 0.3);

    const camera = new ArcRotateCamera(
        'camera',
        -Math.PI / 2,
        Math.PI / 2.4,
        4,
        Vector3.Zero(),
        scene,
    );
    camera.attachControl(canvas, true);

    // attachControl sets tabindex on the canvas and calls focus() from its own
    // pointerdown handler. Chrome counts that programmatic focus as
    // keyboard-ish, so :focus-visible matched on every orbit drag and painted a
    // blue ring around the viewport. Flag pointer-driven focus so the ring is
    // suppressed for the mouse but still shows when the canvas is tabbed to.
    canvas.addEventListener('pointerdown', () => {
        canvas.classList.add('pointer-focus');
    });
    canvas.addEventListener('blur', () => {
        canvas.classList.remove('pointer-focus');
    });
    // Babylon keeps the canvas focused across a Tab press, so blur alone would
    // never restore the ring once the mouse had suppressed it.
    document.addEventListener('keydown', () => {
        canvas.classList.remove('pointer-focus');
    });
    camera.wheelDeltaPercentage = 0.01;
    camera.pinchDeltaPercentage = 0.01;
    camera.minZ = 0.001;
    camera.maxZ = 10000;
    camera.lowerRadiusLimit = 0.01;
    camera.upperRadiusLimit = 1000;

    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.6;

    const dir = new DirectionalLight('dir', new Vector3(-0.6, -1, -0.4), scene);
    dir.intensity = 1.0;

    // Prefiltered specular IBL gives PBR materials something to reflect even
    // before the user loads a model, so the viewport never looks dead-grey.
    scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(ENV_URL, scene);
    scene.environmentIntensity = 1.0;

    engine.runRenderLoop(() => scene.render());

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvas);

    return { engine, scene, camera };
}
