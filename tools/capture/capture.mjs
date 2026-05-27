/**
 * Hero clip recorder for cad-3d-viewer README.
 *
 * Starts Vite dev server, drives the viewer with Playwright, records a webm
 * via Chromium's built-in video, then transcodes to mp4 via ffmpeg-static.
 * Output lands in <repo>/docs/hero.mp4.
 *
 * Usage:  node tools/capture/capture.mjs
 * Env:    CAPTURE_HEADED=1  to watch the recording live
 */

import { chromium } from 'playwright';
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdir, rm, readdir, rename, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT  = resolve(__dirname, 'out');
const DOCS = resolve(ROOT, 'docs');

const PORT = '5174';
const BASE = `http://127.0.0.1:${PORT}`;

const VIEWPORT = { width: 1280, height: 720 };

function sh(cmd, args) {
    return new Promise((res, rej) => {
        const p = spawn(cmd, args, { stdio: 'inherit' });
        p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exit ${code}`))));
    });
}

async function ensureCleanDir(p) {
    await rm(p, { recursive: true, force: true });
    await mkdir(p, { recursive: true });
}

async function startDevServer() {
    const proc = spawn('npx', ['vite', '--port', PORT, '--strictPort'], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stderr.on('data', (d) => process.stderr.write(d));

    const start = Date.now();
    while (Date.now() - start < 30000) {
        try {
            const r = await fetch(BASE);
            if (r.ok) return proc;
        } catch {}
        await new Promise((r) => setTimeout(r, 500));
    }
    proc.kill('SIGTERM');
    throw new Error(`Vite did not start on ${BASE} within 30s`);
}

async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function smoothDrag(page, from, to, steps, durationMs) {
    const stepDelay = durationMs / steps;
    const dx = (to.x - from.x) / steps;
    const dy = (to.y - from.y) / steps;

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(from.x + dx * i, from.y + dy * i);
        await sleep(stepDelay);
    }
    await page.mouse.up();
}

async function capture() {
    await ensureCleanDir(OUT);
    await mkdir(DOCS, { recursive: true });

    const browser = await chromium.launch({
        headless: !process.env.CAPTURE_HEADED,
    });
    const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        recordVideo: { dir: OUT, size: VIEWPORT },
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
        if (msg.type() === 'error') console.log('  [page error]', msg.text());
    });

    console.log('Loading page...');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(500);

    // Open samples and load servo-body (most visually interesting)
    console.log('Opening samples...');
    await page.locator('details.samples summary').click();
    await sleep(400);

    // Capture page errors early
    page.on('pageerror', (e) => console.log('  [PAGE ERROR]', e.message));
    page.on('console', (msg) => {
        if (msg.type() === 'error') console.log('  [CONSOLE ERROR]', msg.text());
    });

    console.log('Loading motor-holder...');
    await page.locator('#sample-list a', { hasText: 'Motor holder' }).click();
    await sleep(2000);
    await page.screenshot({ path: resolve(OUT, 'debug-after-click.png') });
    const pState = await page.evaluate(() => {
        const el = document.getElementById('progress');
        return { hidden: el?.hidden, text: el?.textContent };
    });
    console.log('  progress state:', JSON.stringify(pState));
    const consoleErrors = await page.evaluate(() => {
        const el = document.getElementById('toast-container');
        return el?.textContent || '';
    });
    console.log('  toasts:', consoleErrors);

    await page.waitForFunction(
        () => {
            const el = document.getElementById('progress');
            return el && el.hidden;
        },
        null,
        { timeout: 120000 },
    );
    await sleep(1500);
    console.log('Model loaded. Starting hero sequence.');

    const cx = VIEWPORT.width / 2 + 160;
    const cy = VIEWPORT.height / 2;

    // Beat 1: pause to admire
    await sleep(1500);

    // Beat 2: orbit right
    console.log('  orbit right...');
    await smoothDrag(page, { x: cx, y: cy }, { x: cx - 250, y: cy - 60 }, 30, 1500);
    await sleep(800);

    // Beat 3: orbit left + up
    console.log('  orbit left...');
    await smoothDrag(page, { x: cx, y: cy }, { x: cx + 200, y: cy + 40 }, 25, 1200);
    await sleep(800);

    // Beat 4: explode
    console.log('  explode...');
    const slider = page.locator('#explode-slider');
    const sliderBox = await slider.boundingBox();
    if (sliderBox) {
        const sy = sliderBox.y + sliderBox.height / 2;
        const sxStart = sliderBox.x + 2;
        const sxEnd = sliderBox.x + sliderBox.width * 0.55;
        await smoothDrag(page, { x: sxStart, y: sy }, { x: sxEnd, y: sy }, 25, 1500);
        await sleep(1200);

        // Beat 5: un-explode
        console.log('  collapse...');
        await smoothDrag(page, { x: sxEnd, y: sy }, { x: sxStart, y: sy }, 25, 1200);
        await sleep(800);
    }

    // Beat 6: pick a face
    console.log('  pick face...');
    await page.mouse.click(cx + 30, cy - 20);
    await sleep(1500);

    // Beat 7: final orbit
    console.log('  final orbit...');
    await smoothDrag(page, { x: cx, y: cy }, { x: cx - 150, y: cy - 30 }, 20, 1000);
    await sleep(1500);

    console.log('Done recording. Closing browser...');
    await context.close();
    await browser.close();

    // Find and rename the webm
    const files = (await readdir(OUT)).filter((f) => f.endsWith('.webm'));
    if (files.length !== 1) throw new Error(`Expected 1 webm in ${OUT}, found ${files.length}`);
    const webm = resolve(OUT, 'hero.webm');
    await rename(resolve(OUT, files[0]), webm);
    console.log('Recorded:', webm);

    // Transcode to mp4 — trim first 1.5s (Vite HMR overlay / initial paint)
    const mp4 = resolve(DOCS, 'hero.mp4');
    const trim = process.env.CAPTURE_TRIM_START || '1.5';
    console.log('Transcoding to mp4...');
    await sh(ffmpeg, [
        '-y', '-ss', trim, '-i', webm,
        '-c:v', 'libx264', '-crf', '22', '-preset', 'slow',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        '-vf', 'scale=1280:-2:flags=lanczos,fps=30',
        mp4,
    ]);

    const s = await stat(mp4);
    console.log(`\nDone: ${mp4}  (${(s.size / 1024 / 1024).toFixed(2)} MB)`);
}

let serverProc;
async function main() {
    console.log('Starting Vite dev server...');
    serverProc = await startDevServer();
    console.log('Dev server up.');
    try {
        await capture();
    } finally {
        serverProc?.kill('SIGTERM');
    }
}

main().catch((err) => {
    console.error(err);
    serverProc?.kill('SIGTERM');
    process.exit(1);
});
