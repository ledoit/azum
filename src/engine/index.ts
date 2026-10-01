import { tsEngine } from "./ts_core";
import type { EngineApi } from "./types";

export type { CellAddress, CellValue, EngineApi, SheetData, WorkbookData } from "./types";
export { tsEngine } from "./ts_core";

/**
 * Prefer a compiled OCaml core when present at runtime (`/engine/azum_core.js`).
 * Until `npm run engine:ocaml` succeeds, the TS fallback (same API) is used.
 */
let engine: EngineApi = tsEngine;

export function getEngine(): EngineApi {
  return engine;
}

export async function initEngine(): Promise<EngineApi> {
  try {
    // Runtime-only load so Vite does not bundle a missing artifact.
    const url = new URL("/engine/azum_core.js", globalThis.location?.href ?? "http://localhost/");
    const mod = await import(/* @vite-ignore */ url.href);
    if (mod && typeof mod.createEmpty === "function") {
      engine = {
        createEmpty: mod.createEmpty,
        fromCsv: mod.fromCsv,
        toCsv: mod.toCsv,
        evaluate: mod.evaluate,
        backend: () => "ocaml",
      };
      return engine;
    }
  } catch {
    // OCaml artifact not built — expected for v1 until opam/js_of_ocaml is set up.
  }
  engine = tsEngine;
  return engine;
}
