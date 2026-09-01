# CAD 3D Viewer

Drag-drop a `.step` / `.iges` / `.brep` file into the browser and look at it.
No backend, no upload, no COOP/COEP headers. The file is parsed locally by a
WebAssembly build of [Open CASCADE Technology](https://dev.opencascade.org/)
and rendered with [Babylon.js](https://www.babylonjs.com/).

[![Build and deploy](https://github.com/tegos/cad-3d-viewer/actions/workflows/deploy.yml/badge.svg)](https://github.com/tegos/cad-3d-viewer/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[Live demo](https://tegos.github.io/cad-3d-viewer/)**

<a href="https://tegos.github.io/cad-3d-viewer/">
  <img src="assets/demo.webp" width="800"
       alt="A STEP assembly loaded in the viewer, with the assembly tree sidebar, the exploded-view slider and a selected face highlighted">
</a>

## Features

- Drop any `.step` / `.stp` / `.iges` / `.igs` / `.brep` file and get a mesh,
  usually in a couple of seconds for a part in the few-hundred-KB range
- Per-face picking (each B-rep face is its own pickable submesh)
- Runtime exploded view (slider controls the offset, no special export needed)
- Two-point distance measurement
- Assembly-tree sidebar (toggle visibility, click a row to frame the subtree)
- Node names recovered from STEP files that were written in windows-1251
  without the ISO-10303-21 escapes
- One-click PNG screenshot

## Quick start

```bash
npm install      # Node 20+ (CI builds on 22)
npm run dev      # http://localhost:5173
npm test         # vitest
npm run typecheck
npm run build    # type-check, bundle to dist/, verify the WASM assets landed
npm run preview  # serve the built bundle
```

## Usage

The viewer autoloads the first bundled sample so the viewport is never empty.
Drop your own file on the drop-zone or on the viewport, use **Choose file**,
or pick another sample under **"Or load a sample"**.

URL parameters:

| Parameter | Effect |
|---|---|
| `?model=none` | Skip the startup autoload and open blank. |
| `?model=<relative-url>` | Autoload that file instead. Same-origin only. |
| `?debug` | Expose `window.__scene` / `window.__engine` on the console. |
| `?inspector` | Open the Babylon Inspector. **Dev builds only**, the inspector is compiled out of the production bundle. |

## Limitations

- STEP, IGES and BREP only. No STL, OBJ, glTF, Parasolid or native CAD formats.
- 90 MB file ceiling, because the 32-bit Emscripten heap gives out somewhere
  near 100 MB. The viewer bails a little earlier with an explicit message
  instead of an OOM crash.
- Single-threaded parsing. Large assemblies take as long as they take; there
  is no worker pool and no cancel button.
- Exploded view needs a multi-part assembly. A single-part file has nothing to
  move apart, so the slider is disabled for those.
- Modern browsers only: WebAssembly, Web Workers and WebGL2 are all required.
  Tested on current Chromium, Firefox and Safari.

## How it works

```text
drop/fetch file ──▶ Web Worker (occt-import-js WASM) ──▶ JSON ──▶ Babylon.js meshes
```

1. The main thread reads the dropped file into an `ArrayBuffer` and posts it
   to a Web Worker via [Comlink](https://github.com/GoogleChromeLabs/comlink).
2. The worker calls `ReadStepFile` / `ReadIgesFile` / `ReadBrepFile` from
   [occt-import-js](https://github.com/kovacsv/occt-import-js), a synchronous
   C++/Emscripten call that returns a JSON describing the node hierarchy and
   triangulated meshes.
3. The main thread walks that JSON in `src/builder.ts` and builds a Babylon
   `TransformNode` tree, with one `Mesh` per OCCT mesh and one `SubMesh` per
   B-rep face. The per-face submeshes are what makes face picking trivial:
   `PickingInfo.subMeshId` indexes directly into a `Map<string, FaceRef>`.

The OCCT WASM binary is ~7.6 MB, loaded lazily: the worker spins up on the
first load action, so the initial page paint isn't blocked. With the default
autoload that action fires right after boot; `?model=none` defers it until the
user drops something.

## Implementation notes

Six things that cost time to work out, if you are building something similar.

- **No SharedArrayBuffer needed.** occt-import-js is a single-threaded
  Emscripten build, so you skip the COOP/COEP isolation setup entirely.
- **Use a worker.** `ReadStepFile` is synchronous C++; on a real assembly it
  blocks the calling thread for seconds and the viewport freezes.
- **Classic worker, not ESM.** The upstream UMD bundle predates the ESM-worker
  era and trips up Vite's bundler (it probes `__filename` and conditionally
  `require('fs')`). Loading it via `importScripts()` in a classic worker is
  cleaner than fighting the bundler. See `src/loader.worker.ts`.
- **`locateFile`, and no `import.meta.env` inside it.** Emscripten resolves
  `.wasm` relative to the script URL, which doesn't survive bundling, so the
  path has to be passed explicitly. A classic worker has no `import.meta`
  either, so the base path arrives as a build-time `define`:

  ```ts
  // vite.config.ts: define: { __BASE_URL__: JSON.stringify(base) }
  const base = __BASE_URL__;
  occtimportjs({ locateFile: (path) => `${base}occt-import-js/${path}` });
  ```

  `vite-plugin-static-copy` publishes the WASM and the Comlink UMD bundle at
  those paths in both dev and prod, and `tools/verify-dist.mjs` fails the
  build if they are missing from `dist/`.
- **STEP files carry colors.** OCCT honours whatever the authoring tool baked
  in. A dark gray plastic part stays dark gray in the viewer. That is the
  source data, not a rendering bug.
- **Node names are not always UTF-8.** Some exporters write windows-1251 bytes
  straight into a STEP file with no escape sequences, and the assembly tree
  fills up with mojibake. `src/utils/decode-names.ts` re-decodes the suspect
  byte sequences, but only when the result is real Cyrillic words, so that
  Nordic Latin-1 names are left alone.

## Licensing

- This repo's code is **MIT** (see `LICENSE`).
- `occt-import-js` is **LGPL-2.1**, wrapping Open CASCADE, which is
  **LGPL-2.1 with the Open CASCADE exception**. It is loaded as a separate
  WASM blob at runtime and the build ships the upstream license texts next to
  it at `/occt-import-js/license.occt.txt` (see `ATTRIBUTION.md`).
- Bundled `.step` samples are **Apache-2.0** from
  [Formlabs/foxtrot](https://github.com/Formlabs/foxtrot) and
  [TheRobotStudio/SO-ARM100](https://github.com/TheRobotStudio/SO-ARM100),
  see `public/samples/ATTRIBUTION.md`.

## Why

Viewing a STEP file usually means a desktop CAD install or a paid web service,
even though the pieces to do it client-side have been available for a while.
OCCT compiles to WebAssembly, Babylon.js renders the result. This repo wires
them together.

## Contributing

Issues and pull requests are welcome. Keep changes focused, run `npm test` and
`npm run build` before opening a PR, and describe what you verified in a
browser. Test coverage is thin and most of the app is only exercised by
actually loading a file, so browser verification still carries the weight.

## Acknowledgements

- [Viktor Kovacs](https://github.com/kovacsv) for **occt-import-js** and the
  reference [Online 3D Viewer](https://3dviewer.net/) it powers.
- The **Babylon.js** team for the renderer.
