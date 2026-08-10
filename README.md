# Vec

Local-first desktop spreadsheet from Menhir Holdings.

**Path:** `Menhir Holdings/Employment/Vec`  
**Linear:** [Vec](https://linear.app/menhir-holdings/project/vec-9ff447b5bd6f) · [MT-167](https://linear.app/menhir-holdings/issue/MT-167/vec-v1-windows-desktop-spreadsheet-installer)

## Stack

| Layer | Tech |
|-------|------|
| UI | SvelteKit (static) + Univer Sheets |
| Shell | Tauri 2 (thin Rust: window, menus, dialog, fs) |
| Domain seam | OCaml workbook/formula core (`ocaml/`) with TS fallback adapter |
| Ship | Windows NSIS now; macOS DMG configured for later |

## Develop

```bash
npm install
npm run tauri:dev
```

Requires Rust + platform WebView2 (Windows).

## Windows installer

Because this repo lives under a path with spaces (`Menhir Holdings`), set a space-free Cargo target dir locally:

```bash
export CARGO_TARGET_DIR="$HOME/Philippe/work/_build/vec-target"
npm run tauri:build
```

Installer: `_build/vec-target/release/bundle/nsis/Vec_*_x64-setup.exe`

CI builds the NSIS artifact on PRs (see `.github/workflows/build-windows.yml`) without that workaround.

## Ship Mac (later)

Same codebase. On a macOS machine (or macOS CI runner):

1. Ensure Xcode CLT + Rust targets are installed.
2. `npm run tauri:build` — DMG is already listed in `tauri.conf.json` bundle targets.
3. Optional: set signing identity / notarization in the `macOS` block.

No app rewrite required.

## OCaml engine

See [`ocaml/README.md`](ocaml/README.md). Until `npm run engine:ocaml` produces `static/engine/vec_core.js`, the app uses the TS fallback that implements the same API (`src/engine/`).

## File formats

- `.vec` — native JSON workbook
- `.csv` / `.xlsx` — import/export via the engine + SheetJS
