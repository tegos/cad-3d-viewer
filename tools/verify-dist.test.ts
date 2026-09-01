import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// The guard only earns its keep if it actually fails, so run the real script
// against a fake dist tree instead of importing its internals.
const script = join(process.cwd(), 'tools', 'verify-dist.mjs');

const REQUIRED = [
    'occt-import-js/occt-import-js.js',
    'occt-import-js/occt-import-js.wasm',
    'occt-import-js/license.occt-import-js.txt',
    'occt-import-js/license.occt.txt',
    'comlink/comlink.js',
    'index.html',
];

let workdir: string | null = null;

function makeDist(files: string[]): string {
    workdir = mkdtempSync(join(tmpdir(), 'verify-dist-'));
    for (const file of files) {
        const path = join(workdir, 'dist', file);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, '');
    }
    return workdir;
}

function run(cwd: string): { status: number; output: string } {
    try {
        const output = execFileSync(process.execPath, [script], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return { status: 0, output };
    } catch (error) {
        const e = error as { status?: number; stdout?: string; stderr?: string };
        return { status: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
}

afterEach(() => {
    if (workdir) rmSync(workdir, { recursive: true, force: true });
    workdir = null;
});

describe('verify-dist', () => {
    it('passes when every required asset is present', () => {
        const { status, output } = run(makeDist(REQUIRED));
        expect(status).toBe(0);
        expect(output).toContain('6 required assets present');
    });

    // The exact shape of the regression that shipped: the copy plugin kept the
    // source path, so the files existed but not at the URL the worker fetches.
    it('fails when static-copy nests the assets instead of flattening them', () => {
        const nested = [
            'index.html',
            'occt-import-js/node_modules/occt-import-js/dist/occt-import-js.js',
            'occt-import-js/node_modules/occt-import-js/dist/occt-import-js.wasm',
            'comlink/node_modules/comlink/dist/umd/comlink.js',
        ];
        const { status, output } = run(makeDist(nested));
        expect(status).toBe(1);
        expect(output).toContain('dist/occt-import-js/occt-import-js.js');
        expect(output).toContain('dist/comlink/comlink.js');
    });

    it.each(REQUIRED)('fails when %s is missing', (missing) => {
        const { status, output } = run(makeDist(REQUIRED.filter((f) => f !== missing)));
        expect(status).toBe(1);
        expect(output).toContain(`dist/${missing}`);
    });

    it('rejects a directory standing in for a required file', () => {
        const dir = makeDist(REQUIRED.filter((f) => f !== 'comlink/comlink.js'));
        mkdirSync(join(dir, 'dist', 'comlink', 'comlink.js'), { recursive: true });
        const { status } = run(dir);
        expect(status).toBe(1);
    });
});
