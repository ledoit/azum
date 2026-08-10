import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { WorkbookData } from "../../engine";

export const FILTERS = [
  { name: "Vec Workbook", extensions: ["vec"] },
  { name: "Excel", extensions: ["xlsx"] },
  { name: "CSV", extensions: ["csv"] },
] as const;

export async function pickOpenPath(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [...FILTERS],
  });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected;
}

export async function pickSavePath(
  defaultPath?: string,
  extension: "vec" | "xlsx" | "csv" = "vec",
): Promise<string | null> {
  return save({
    defaultPath,
    filters: FILTERS.filter((f) => f.extensions.includes(extension)),
  });
}

export async function readText(path: string): Promise<string> {
  return readTextFile(path);
}

export async function writeText(path: string, contents: string): Promise<void> {
  await writeTextFile(path, contents);
}

export function extensionOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i + 1).toLowerCase() : "";
}

export function parseVecFile(text: string): WorkbookData {
  const data = JSON.parse(text) as WorkbookData;
  if (data.version !== 1 || !Array.isArray(data.sheets)) {
    throw new Error("Unsupported .vec file");
  }
  return data;
}

export function serializeVecFile(book: WorkbookData): string {
  return JSON.stringify(book, null, 2);
}

export function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}
