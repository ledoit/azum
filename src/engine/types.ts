/** Stable workbook model shared by the OCaml core and TS adapter. */

export type CellAddress = string; // A1 notation

export type CellValue = string | number | boolean | null;

export interface SheetData {
  name: string;
  /** Raw cell inputs (formulas keep leading '='). */
  cells: Record<CellAddress, string>;
}

export interface WorkbookData {
  version: 1;
  name: string;
  activeSheet: number;
  sheets: SheetData[];
}

export interface EngineApi {
  /** Create an empty workbook. */
  createEmpty(name?: string): WorkbookData;
  /** Parse CSV text into a single-sheet workbook. */
  fromCsv(text: string, sheetName?: string): WorkbookData;
  /** Serialize the active (or given) sheet to CSV. */
  toCsv(book: WorkbookData, sheetIndex?: number): string;
  /** Evaluate a formula against a sheet's cells (A1 refs + SUM + arithmetic). */
  evaluate(formula: string, cells: Record<CellAddress, string>): CellValue;
  /** Which backend is active. */
  backend(): "ocaml" | "ts-fallback";
}
