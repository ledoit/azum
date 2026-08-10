import {
  createUniver,
  defaultTheme,
  LocaleType,
  merge,
} from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/presets/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/presets/preset-sheets-core/locales/en-US";
import "@univerjs/presets/lib/styles/preset-sheets-core.css";
import type { WorkbookData } from "../../engine";
import { getEngine } from "../../engine";

export type UniverHandle = {
  dispose: () => void;
  getWorkbookData: () => WorkbookData;
  loadWorkbookData: (data: WorkbookData) => void;
  onDirty: (cb: () => void) => void;
  selectionLabel: () => string;
  activeSheetName: () => string;
};

type FWorkbook = {
  getSnapshot: () => unknown;
  getActiveSheet: () => { getSheetName: () => string } | null;
  getActiveRange: () => { getA1Notation?: () => string; getRangeName?: () => string } | null;
};

type FUniver = {
  createWorkbook: (data?: unknown) => void;
  getActiveWorkbook: () => FWorkbook | null;
  disposeUnit?: (id: string) => void;
  addEvent: (event: unknown, cb: () => void) => { dispose: () => void };
  Event?: { CommandExecuted: unknown };
};

function cellsToSheetMatrix(cells: Record<string, string>) {
  const cellData: Record<number, Record<number, { v?: string | number; f?: string }>> = {};
  for (const [addr, raw] of Object.entries(cells)) {
    const m = /^([A-Za-z]+)(\d+)$/.exec(addr);
    if (!m) continue;
    let col = 0;
    for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
    col -= 1;
    const row = parseInt(m[2], 10) - 1;
    if (!cellData[row]) cellData[row] = {};
    if (raw.startsWith("=")) {
      cellData[row][col] = { f: raw };
    } else {
      const n = Number(raw);
      cellData[row][col] = {
        v: raw.trim() !== "" && Number.isFinite(n) ? n : raw,
      };
    }
  }
  return cellData;
}

function colName(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function snapshotToWorkbook(snapshot: any, fallbackName: string): WorkbookData {
  const sheets: WorkbookData["sheets"] = [];
  const sheetOrder: string[] = snapshot?.sheetOrder ?? Object.keys(snapshot?.sheets ?? {});
  for (const id of sheetOrder) {
    const sh = snapshot?.sheets?.[id];
    if (!sh) continue;
    const cells: Record<string, string> = {};
    const cellData = sh.cellData ?? {};
    for (const r of Object.keys(cellData)) {
      const row = cellData[r];
      for (const c of Object.keys(row)) {
        const cell = row[c];
        const addr = `${colName(Number(c))}${Number(r) + 1}`;
        if (cell?.f) cells[addr] = cell.f.startsWith("=") ? cell.f : `=${cell.f}`;
        else if (cell?.v != null && cell.v !== "") cells[addr] = String(cell.v);
      }
    }
    sheets.push({ name: sh.name ?? `Sheet${sheets.length + 1}`, cells });
  }
  if (!sheets.length) return getEngine().createEmpty(fallbackName);
  return {
    version: 1,
    name: snapshot?.name ?? fallbackName,
    activeSheet: 0,
    sheets,
  };
}

function workbookToUniverData(data: WorkbookData) {
  const sheets: Record<string, unknown> = {};
  const sheetOrder: string[] = [];
  data.sheets.forEach((sh, i) => {
    const id = `sheet-${i}`;
    sheetOrder.push(id);
    sheets[id] = {
      id,
      name: sh.name,
      cellData: cellsToSheetMatrix(sh.cells),
      rowCount: 1000,
      columnCount: 26,
    };
  });
  return {
    id: "vec-workbook",
    name: data.name,
    appVersion: "0.1.0",
    locale: LocaleType.EN_US,
    sheetOrder,
    sheets,
  };
}

export function mountUniver(container: HTMLElement): UniverHandle {
  let dirtyCb: (() => void) | null = null;
  let disposable: { dispose: () => void } | null = null;

  const { univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: merge({}, UniverPresetSheetsCoreEnUS),
    },
    theme: defaultTheme,
    presets: [
      UniverSheetsCorePreset({
        container,
      }),
    ],
  });

  const api = univerAPI as unknown as FUniver;
  api.createWorkbook(workbookToUniverData(getEngine().createEmpty("Workbook")));

  try {
    const evt = (api as any).Event?.CommandExecuted;
    if (evt != null) {
      disposable = api.addEvent(evt, () => dirtyCb?.());
    }
  } catch {
    // optional dirty hook
  }

  return {
    dispose() {
      disposable?.dispose();
      try {
        (univerAPI as any).dispose?.();
      } catch {
        /* ignore */
      }
    },
    getWorkbookData() {
      const book = api.getActiveWorkbook();
      const snap = book?.getSnapshot?.() ?? {};
      return snapshotToWorkbook(snap, "Workbook");
    },
    loadWorkbookData(data) {
      api.createWorkbook(workbookToUniverData(data));
    },
    onDirty(cb) {
      dirtyCb = cb;
    },
    selectionLabel() {
      const book = api.getActiveWorkbook();
      const range = book?.getActiveRange?.();
      return (
        range?.getA1Notation?.() ??
        (range as any)?.getRangeName?.() ??
        ""
      );
    },
    activeSheetName() {
      return api.getActiveWorkbook()?.getActiveSheet?.()?.getSheetName?.() ?? "Sheet1";
    },
  };
}
