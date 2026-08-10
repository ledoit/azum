/** Shared address helpers for the light grid. */

const COLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function indexToCol(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    s = COLS[(n - 1) % 26] + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

export function addr(col: number, row: number): string {
  return `${indexToCol(col)}${row + 1}`;
}

export function parseAddr(a: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(a.trim());
  if (!m) return null;
  return { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1 };
}
