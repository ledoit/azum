# Vec OCaml workbook core

Domain engine for workbook/CSV/formula evaluation. The TypeScript adapter in
`src/engine/` loads `static/engine/vec_core.js` when present; otherwise it uses
the TS fallback that mirrors this API.

## Build (when opam + js_of_ocaml are installed)

```bash
opam install dune js_of_ocaml js_of_ocaml-ppx yojson
dune build
cp _build/default/js/vec_core.bc.js ../static/engine/vec_core.js
```

Or from the app root: `npm run engine:ocaml`.
