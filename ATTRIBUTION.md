# Attribution

## Runtime dependencies

### occt-import-js (LGPL-2.1) and OCCT (LGPL-2.1 with the Open CASCADE exception)

This project loads CAD files through [occt-import-js](https://github.com/kovacsv/occt-import-js)
by Viktor Kovacs, an Emscripten wrapper around [Open CASCADE Technology](https://dev.opencascade.org/).
occt-import-js itself is LGPL-2.1; OCCT is LGPL-2.1 **with the additional Open
CASCADE exception**, which is not the same thing as plain LGPL-2.1.

The WASM artifact is loaded dynamically at runtime — we do not modify or
statically link OCCT. Application code in this repository is MIT-licensed; the
OCCT/LGPL terms apply to the WASM blob as distributed by the upstream package.

Both upstream license texts are copied into the build output and published
alongside the binary at `/occt-import-js/license.occt.txt` and
`/occt-import-js/license.occt-import-js.txt`, so the license travels with the
library wherever the site is deployed.

If you fork and redistribute, keep this notice and the upstream copyright
intact.

### Babylon.js (Apache-2.0)

3D rendering uses [Babylon.js](https://www.babylonjs.com/) under Apache-2.0.

## Sample assets

Bundled STEP files in `public/samples/` are redistributed under Apache-2.0
from upstream open-hardware projects. See
[`public/samples/ATTRIBUTION.md`](./public/samples/ATTRIBUTION.md) for per-file
sources and `LICENSE-APACHE-2.0` at the repo root for the license text.
