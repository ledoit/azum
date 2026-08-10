import * as XLSX from "xlsx";
import type { WorkbookData } from "../../engine";
import { getEngine } from "../../engine";
import {
  extensionOf,
  parseVecFile,
  readText,
  serializeVecFile,
  writeText,
} from "../platform/files";

function sheetMatrixToCells(matrix: (string | number | boolean | null)[][]): Record<string, string> {
  const cells: Record<string, string> = {};
  matrix.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value == null || value === "") return;
      let col = "";
      let n = c + 1;
      while (n > 0) {
        col = String.fromCharCode(65 + ((n - 1) % 26)) + col;
        n = Math.floor((n - 1) / 26);
      }
      cells[`${col}${r + 1}`] = String(value);
    });
  });
  return cells;
}

export function workbookFromXlsxArrayBuffer(buf: ArrayBuffer): WorkbookData {
  const wb = XLSX.read(buf, { type: "array" });
  const sheets = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    return { name, cells: sheetMatrixToCells(rows as (string | number | boolean | null)[][]) };
  });
  return {
    version: 1,
    name: "Workbook",
    activeSheet: 0,
    sheets: sheets.length ? sheets : [{ name: "Sheet1", cells: {} }],
  };
}

export function workbookToXlsxArrayBuffer(book: WorkbookData): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const sh of book.sheets) {
    const engine = getEngine();
    const csv = engine.toCsv({ ...book, sheets: [sh], activeSheet: 0 }, 0);
    const aoa = XLSX.utils.sheet_to_json(
      XLSX.read(csv, { type: "string" }).Sheets.Sheet1 ??
        XLSX.utils.aoa_to_sheet([]),
      { header: 1 },
    ) as unknown[][];
    // Rebuild from cells for correctness
    let maxR = 0;
    let maxC = 0;
    const parsed: { r: number; c: number; v: string }[] = [];
    for (const [addr, v] of Object.entries(sh.cells)) {
      const m = /^([A-Za-z]+)(\d+)$/.exec(addr);
      if (!m) continue;
      let c = 0;
      for (const ch of m[1].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
      c -= 1;
      const r = parseInt(m[2], 10) - 1;
      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, c);
      parsed.push({ r, c, v });
    }
    const grid: string[][] = Array.from({ length: maxR + 1 }, () =>
      Array.from({ length: maxC + 1 }, () => ""),
    );
    for (const p of parsed) grid[p.r][p.c] = p.v;
    const ws = XLSX.utils.aoa_to_sheet(grid.length ? grid : [[""]]);
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31) || "Sheet");
    void aoa;
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Uint8Array(out);
}

export async function loadPath(path: string): Promise<WorkbookData> {
  const ext = extensionOf(path);
  if (ext === "vec") {
    return parseVecFile(await readText(path));
  }
  if (ext === "csv") {
    return getEngine().fromCsv(await readText(path));
  }
  if (ext === "xlsx") {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const bytes = await readFile(path);
    return workbookFromXlsxArrayBuffer(bytes.buffer as ArrayBuffer);
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

export async function savePath(path: string, book: WorkbookData): Promise<void> {
  const ext = extensionOf(path);
  if (ext === "vec" || ext === "") {
    const target = ext ? path : `${path}.vec`;
    await writeText(target, serializeVecFile(book));
    return;
  }
  if (ext === "csv") {
    await writeText(path, getEngine().toCsv(book));
    return;
  }
  if (ext === "xlsx") {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(path, workbookToXlsxArrayBuffer(book));
    return;
  }
  throw new Error(`Unsupported file type: .${ext}`);
}
