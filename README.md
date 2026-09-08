# Azum

Local-first desktop spreadsheet from Menhir Holdings.

**Path:** `Menhir Holdings/Eng/Azum`  
**Linear:** [Azum](https://linear.app/menhir-holdings/project/vec-9ff447b5bd6f) · [MT-184](https://linear.app/menhir-holdings/issue/MT-184/rename-vec-azum-everywhere)

## Stack

| Layer | Tech |
|-------|------|
| UI | SvelteKit (static) + **custom light grid** (no Univer) |
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

Prefer the **CI artifact** (`azum-windows-nsis` on the PR). Local MinGW (`windows-gnu`) builds can produce an installer that fails at runtime with missing DLLs; GitHub `windows-latest` uses MSVC.

If you build locally under a path with spaces (`Menhir Holdings`), also set a space-free Cargo target dir:

```bash
export CARGO_TARGET_DIR="$HOME/Philippe/work/_build/azum-target"
npm run tauri:build
```

(That `_build` folder is only a compile cache — safe to delete after you’re done.)

## Ship Mac (later)

Same codebase. On a macOS machine (or macOS CI runner):

1. Ensure Xcode CLT + Rust targets are installed.
2. `npm run tauri:build` — DMG is already listed in `tauri.conf.json` bundle targets.
3. Optional: set signing identity / notarization in the `macOS` block.

No app rewrite required.

## OCaml engine

See [`ocaml/README.md`](ocaml/README.md). Until `npm run engine:ocaml` produces `static/engine/azum_core.js`, the app uses the TS fallback that implements the same API (`src/engine/`).

## File formats

- `.azum` — native JSON workbook
- `.csv` / `.xlsx` — import/export via the engine + SheetJS
