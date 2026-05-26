// PNG screenshot via Babylon's offscreen render helper. Triggered from the
// sidebar button; downloads as <model>-<timestamp>.png.

import { Tools } from '@babylonjs/core/Misc/tools';
import '@babylonjs/core/Misc/screenshotTools';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Engine } from '@babylonjs/core/Engines/engine';

export async function downloadScreenshot(
    engine: Engine,
    camera: ArcRotateCamera,
    nameHint: string,
    width = 1920,
    height = 1080,
): Promise<void> {
    const dataUrl = await Tools.CreateScreenshotUsingRenderTargetAsync(
        engine,
        camera,
        { width, height },
        'image/png',
        4,
        true,
    );
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = nameHint.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40) || 'model';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${safeName}-${ts}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}
