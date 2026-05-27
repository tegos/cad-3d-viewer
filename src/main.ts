// Entry point: bootstrap the Babylon scene, wire all features to the sidebar,
// expose drag-drop loading. The dev-only Babylon Inspector loads on demand
// behind ?inspector=1.

import './ui/style.css';

import { createScene } from './scene';
import { loadCadFile, FileTooLargeError, UnsupportedFormatError, OcctReadError } from './loader';
import { buildModel, type BuiltModel } from './builder';
import { frameCamera } from './camera-frame';
import { attachPicking } from './features/picking';
import { renderTree } from './features/tree';
import { ExplodeController } from './features/explode';
import { MeasureController } from './features/measure';
import { downloadScreenshot } from './features/screenshot';
import {
    getRefs,
    wireDropZone,
    renderSampleList,
    showProgress,
    hideProgress,
    toast,
    renderSelectionInfo,
    type SampleEntry,
} from './ui/sidebar';

const base = import.meta.env.BASE_URL;

const SAMPLES: SampleEntry[] = [
    {
        label: 'Cube with hole (9 KB)',
        url: `${base}samples/cube-hole.step`,
        note: 'Formlabs/foxtrot, Apache-2.0',
    },
    {
        label: 'Motor holder (234 KB)',
        url: `${base}samples/motor-holder.step`,
        note: 'TheRobotStudio/SO-ARM100, Apache-2.0',
    },
    {
        label: 'Servo body (241 KB)',
        url: `${base}samples/servo-body.step`,
        note: 'TheRobotStudio/SO-ARM100, Apache-2.0',
    },
];

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const refs = getRefs();
const { engine, scene, camera } = createScene(canvas);
const measure = new MeasureController(scene, 'mm');

let currentModel: BuiltModel | null = null;
let currentName = 'model';
let explode: ExplodeController | null = null;
let isLoading = false;

const disposePicking = attachPicking(
    scene,
    () => currentModel,
    { onSelect: (face) => renderSelectionInfo(refs, face) },
    () => measure.isEnabled(),
);

function clearScene(): void {
    if (currentModel) {
        for (const m of currentModel.meshes) m.dispose(false, true);
        currentModel.root.dispose();
        currentModel = null;
    }
    measure.clear();
    explode = null;
    refs.explodeSlider.value = '0';
    renderSelectionInfo(refs, null);
    refs.treeRoot.replaceChildren();
}

async function loadFromFile(file: File | Blob, name: string): Promise<void> {
    if (isLoading) {
        toast(refs, 'Still loading, please wait.', 'warn');
        return;
    }
    isLoading = true;
    showProgress(refs, `Loading ${name}…`);
    try {
        const result = await loadCadFile(file, name);
        clearScene();
        const model = buildModel(scene, result);
        currentModel = model;
        currentName = name.replace(/\.[^.]+$/, '');
        renderTree(model.root, refs.treeRoot, camera);
        frameCamera(camera, model.meshes);
        explode = new ExplodeController(model);
        if (model.meshes.length === 0) {
            toast(refs, 'File loaded but no geometry was returned.', 'warn');
        } else {
            toast(refs, `Loaded ${model.meshes.length} mesh(es), ${model.faces.size} face(s).`);
        }
    } catch (err) {
        if (err instanceof FileTooLargeError) {
            toast(refs, err.message, 'error');
        } else if (err instanceof UnsupportedFormatError) {
            toast(refs, err.message, 'error');
        } else if (err instanceof OcctReadError) {
            toast(refs, err.message, 'error');
        } else {
            console.error(err);
            toast(refs, `Loading failed: ${(err as Error).message}`, 'error');
        }
    } finally {
        isLoading = false;
        hideProgress(refs);
    }
}

async function loadFromUrl(sample: SampleEntry): Promise<void> {
    showProgress(refs, `Fetching ${sample.label}…`);
    try {
        const response = await fetch(sample.url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${sample.url}`);
        }
        const blob = await response.blob();
        // loadFromFile manages its own progress show/hide, so we don't need
        // a finally here — it always restores the hidden state.
        await loadFromFile(blob, sample.url.split('/').pop() ?? 'sample.step');
    } catch (err) {
        console.error(err);
        toast(refs, `Could not fetch ${sample.label}: ${(err as Error).message}`, 'error');
        hideProgress(refs);
    }
}

wireDropZone(refs, (file, name) => loadFromFile(file, name));
renderSampleList(refs, SAMPLES, (sample) => loadFromUrl(sample));

refs.btnScreenshot.addEventListener('click', async () => {
    try {
        await downloadScreenshot(engine, camera, currentName);
    } catch (err) {
        toast(refs, `Screenshot failed: ${(err as Error).message}`, 'error');
    }
});

refs.btnMeasure.addEventListener('click', () => {
    const next = !measure.isEnabled();
    measure.setEnabled(next);
    refs.btnMeasure.classList.toggle('is-active', next);
    if (next) {
        toast(refs, 'Click two surface points to measure.');
    }
});

refs.explodeSlider.addEventListener('input', () => {
    if (!explode) return;
    const factor = Number(refs.explodeSlider.value) / 100;
    explode.setFactor(factor);
});

// Dev-only debug hook. `?debug=1` exposes the scene + engine on `window`.
if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as { __scene: typeof scene; __engine: typeof engine }).__scene = scene;
    (window as unknown as { __scene: typeof scene; __engine: typeof engine }).__engine = engine;
}

if (new URLSearchParams(location.search).has('inspector')) {
    import('@babylonjs/inspector').then(({ Inspector }) => {
        Inspector.Show(scene, { embedMode: true });
    });
}

window.addEventListener('beforeunload', () => {
    disposePicking();
    measure.dispose();
    engine.dispose();
});
