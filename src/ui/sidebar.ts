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
): void {
    const dz = refs.dropzone;

    const setOver = (over: boolean) => dz.classList.toggle('is-over', over);

    dz.addEventListener('dragenter', (e) => {
        e.preventDefault();
        setOver(true);
    });
    dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        setOver(true);
    });
    dz.addEventListener('dragleave', (e) => {
        if (e.target === dz) setOver(false);
    });
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) onFile(file, file.name);
    });

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
        const a = document.createElement('a');
        a.textContent = s.label;
        if (s.note) a.title = s.note;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            onPick(s);
        });
        li.appendChild(a);
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

export function toast(refs: SidebarRefs, message: string, kind: 'info' | 'warn' | 'error' = 'info'): void {
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.textContent = message;
    refs.toastContainer.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s';
        setTimeout(() => el.remove(), 300);
    }, kind === 'error' ? 6000 : 3500);
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
