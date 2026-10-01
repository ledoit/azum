# Azum — STATUS

**Shelved.** The spreadsheet shell stays on disk for a later workbook engine in Zig, OCaml, Lean, or Prolog. No host, no public site, not a current product.

Linear SoT: MT-184 · Project Azum

**Path:** `personal/Stonehenge/Eng/Azum`  
**Repo:** https://github.com/ledoit/azum · `main`

## Shipped

| Item | Issue |
|------|-------|
| SvelteKit + Tauri 2 shell, NSIS Windows installer | MT-167 |
| Custom light grid (Univer removed) | MT-167 |
| Native File menu + New/Open/Save | MT-167 |
| `.azum` / `.csv` / `.xlsx` IO | MT-167 / MT-184 |
| OCaml engine seam + TS fallback | MT-167 |
| Rename Vec → Azum everywhere | MT-184 (this PR) |

## Open / backlog

| Item | Notes |
|------|-------|
| Compiled OCaml `azum_core.js` in CI | backlog |
| Signed / notarized Mac build | when Phil says ship Mac |
| Virtualized large sheets | if needed |
| Uninstall leftover `%LOCALAPPDATA%\Vec` | after Azum install |
