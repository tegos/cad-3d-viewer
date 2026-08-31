// Sidebar wiring: drop zone, file picker, sample list, toolbar buttons,
// selection panel, transient toasts.

import type { FaceRef } from '../builder';

export interface SampleEntry {
    label: string;
    url: string;
    note?: string;
}

export interface SidebarRefs {
    dropzone: HTMLElement;
    viewport: HTMLElement;
    fileInput: HTMLInputElement;
    sampleList: HTMLElement;
    treeRoot: HTMLElement;
    selectionInfo: HTMLElement;
    btnScreenshot: HTMLButtonElement;
    btnMeasure: HTMLButtonElement;
    explodeSlider: HTMLInputElement;
    progress: HTMLElement;
    progressLabel: HTMLElement;
    toastContainer: HTMLElement;
}

export function getRefs(): SidebarRefs {
    const $ = <T extends HTMLElement>(id: string): T => {
        const el = document.getElementById(id);
        if (!el) throw new Error(`Missing DOM element #${id}`);
        return el as T;
    };
    return {
        dropzone: $('dropzone'),
        viewport: $('viewport'),
        fileInput: $<HTMLInputElement>('file-input'),
        sampleList: $('sample-list'),
        treeRoot: $('tree-root'),
        selectionInfo: $('selection-info'),
        btnScreenshot: $<HTMLButtonElement>('btn-screenshot'),
        btnMeasure: $<HTMLButtonElement>('btn-measure'),
        explodeSlider: $<HTMLInputElement>('explode-slider'),
        progress: $('progress'),
        progressLabel: $('progress-label'),
        toastContainer: $('toast-container'),
    };
}

export function wireDropZone(
    refs: SidebarRefs,
    onFile: (file: File, name: string) => void,
    onReject: (message: string) => void,
): void {
    // A drop anywhere the app does not handle makes the browser navigate to
    // the file and throw the session away, so the window swallows the default
    // everywhere and the two real targets opt back in.
    const swallow = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', swallow);
    window.addEventListener('drop', swallow);

    const dz = refs.dropzone;
    // dragenter/dragleave fire per element, so crossing into a child of the
    // drop zone reads as a leave. Counting depth is what keeps the highlight
    // from sticking on after the pointer is gone.
    let depth = 0;
    const setOver = (over: boolean) => dz.classList.toggle('is-over', over);

    dz.addEventListener('dragenter', (e) => {
        e.preventDefault();
        depth += 1;
        setOver(true);
    });
    dz.addEventListener('dragleave', () => {
        depth = Math.max(0, depth - 1);
        if (depth === 0) setOver(false);
    });

    const accept = (e: DragEvent) => {
        e.preventDefault();
        depth = 0;
        setOver(false);
        const dt = e.dataTransfer;
        if (!dt) return;

        // A dropped folder arrives as a zero-byte File with no extension, so
        // without this check the user gets "Unsupported file extension" and no
        // idea what actually went wrong.
        const entry = dt.items?.[0]?.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
            onReject('Folders are not supported. Drop a single CAD file.');
            return;
        }

        const files = dt.files;
        const file = files?.[0];
        if (!file) return;
        if (files && files.length > 1) {
            onReject(`Dropped ${files.length} files. Loading the first one, ${file.name}.`);
        }
        onFile(file, file.name);
    };

    // Both the sidebar target and the viewport accept a drop: the viewport is
    // the larger, more obvious target, and aiming at the 340px panel is a
    // needless precision test.
    dz.addEventListener('dragover', (e) => e.preventDefault());
    dz.addEventListener('drop', accept);
    refs.viewport.addEventListener('dragover', (e) => e.preventDefault());
    refs.viewport.addEventListener('drop', accept);

    refs.fileInput.addEventListener('change', () => {
        const file = refs.fileInput.files?.[0];
        if (file) onFile(file, file.name);
        refs.fileInput.value = '';
    });
}

export function renderSampleList(
    refs: SidebarRefs,
    samples: SampleEntry[],
    onPick: (sample: SampleEntry) => void,
): void {
    refs.sampleList.replaceChildren();
    for (const s of samples) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sample-link';
        button.textContent = s.label;
        if (s.note) button.title = s.note;
        button.addEventListener('click', () => onPick(s));
        li.appendChild(button);
        refs.sampleList.appendChild(li);
    }
}

export function showProgress(refs: SidebarRefs, label: string): void {
    refs.progressLabel.textContent = label;
    refs.progress.hidden = false;
}

export function hideProgress(refs: SidebarRefs): void {
    refs.progress.hidden = true;
}

const MAX_TOASTS = 4;
const TOAST_MS = { info: 3500, warn: 3500, error: 6000 } as const;
const FADE_MS = 300;

// Trimming the stack removes a toast while its own timers are still pending,
// so the handles are tracked per element and cleared on the way out.
const toastTimers = new WeakMap<Element, number[]>();

function killToast(el: Element): void {
    for (const t of toastTimers.get(el) ?? []) window.clearTimeout(t);
    toastTimers.delete(el);
    el.remove();
}

export function toast(refs: SidebarRefs, message: string, kind: 'info' | 'warn' | 'error' = 'info'): void {
    // A burst of errors used to stack without limit and cover the viewport.
    while (refs.toastContainer.childElementCount >= MAX_TOASTS) {
        const oldest = refs.toastContainer.firstElementChild;
        if (!oldest) break;
        killToast(oldest);
    }

    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.textContent = message;
    refs.toastContainer.appendChild(el);

    const fade = window.setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = `opacity ${FADE_MS}ms`;
        toastTimers.get(el)?.push(window.setTimeout(() => killToast(el), FADE_MS));
    }, TOAST_MS[kind]);
    toastTimers.set(el, [fade]);
}

export function renderSelectionInfo(
    refs: SidebarRefs,
    face: FaceRef | null,
): void {
    if (!face) {
        refs.selectionInfo.textContent = 'Nothing selected.';
        return;
    }
    refs.selectionInfo.replaceChildren();
    const dl = document.createElement('dl');
    const rows: [string, string][] = [
        ['Part', face.nodeName || '(unnamed)'],
        ['Mesh', face.mesh.name],
        ['Face index', String(face.faceIndex)],
        ['Submesh', String(face.submeshIndex)],
    ];
    for (const [k, v] of rows) {
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = v;
        dl.appendChild(dt);
        dl.appendChild(dd);
    }
    refs.selectionInfo.appendChild(dl);
}
