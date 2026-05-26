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
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';

import '@babylonjs/core/Helpers/sceneHelpers';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Layers/effectLayerSceneComponent';

export interface SceneBundle {
    engine: Engine;
    scene: Scene;
    camera: ArcRotateCamera;
    highlight: HighlightLayer;
}

const ENV_URL =
    'https://assets.babylonjs.com/environments/environmentSpecular.env';

export function createScene(canvas: HTMLCanvasElement): SceneBundle {
    const engine = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
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

    const highlight = new HighlightLayer('highlight', scene, {
        blurHorizontalSize: 0.6,
        blurVerticalSize: 0.6,
    });

    engine.runRenderLoop(() => scene.render());

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvas);

    return { engine, scene, camera, highlight };
}
