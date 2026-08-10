import type { CellAddress, CellValue, EngineApi, WorkbookData } from "./types";

const COLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function indexToCol(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = COLS[rem] + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseAddress(addr: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(addr.trim());
  if (!m) return null;
  return { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1 };
}

function expandRange(range: string): CellAddress[] {
  const parts = range.split(":");
  if (parts.length === 1) {
    return parseAddress(parts[0]) ? [parts[0].toUpperCase()] : [];
  }
  const a = parseAddress(parts[0]);
  const b = parseAddress(parts[1]);
  if (!a || !b) return [];
  const out: CellAddress[] = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) {
      out.push(`${indexToCol(c)}${r + 1}`);
    }
  }
  return out;
}

function literalValue(raw: string | undefined): CellValue {
  if (raw == null || raw === "") return null;
  if (raw.startsWith("=")) return null;
  const n = Number(raw);
  if (raw.trim() !== "" && Number.isFinite(n)) return n;
  if (raw.toLowerCase() === "true") return true;
  if (raw.toLowerCase() === "false") return false;
  return raw;
}

function cellNumber(
  addr: CellAddress,
  cells: Record<CellAddress, string>,
  visiting: Set<string>,
): number {
  const key = addr.toUpperCase();
  const raw = cells[key] ?? cells[addr];
  if (raw == null || raw === "") return 0;
  if (raw.startsWith("=")) {
    const v = evaluateFormula(raw, cells, visiting);
    return typeof v === "number" ? v : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  const re =
    /\s*([A-Za-z]+\d+(?::[A-Za-z]+\d+)?|[A-Za-z]+\(|[0-9]+(?:\.[0-9]+)?|[,+\-*/()])\s*/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(expr))) {
    if (m.index > last && expr.slice(last, m.index).trim()) {
      throw new Error(`Unexpected: ${expr.slice(last, m.index)}`);
    }
    tokens.push(m[1]);
    last = m.index + m[0].length;
  }
  if (last < expr.length && expr.slice(last).trim()) {
    throw new Error(`Unexpected trailing: ${expr.slice(last)}`);
  }
  return tokens;
}

function evaluateFormula(
  formula: string,
  cells: Record<CellAddress, string>,
  visiting: Set<string> = new Set(),
): CellValue {
  const body = formula.startsWith("=") ? formula.slice(1).trim() : formula.trim();
  if (!body) return null;

  const tokens = tokenize(body);
  let i = 0;

  function peek() {
    return tokens[i];
  }
  function eat(expected?: string) {
    const t = tokens[i++];
    if (expected && t !== expected) throw new Error(`Expected ${expected}`);
    return t;
  }

  function parseExpression(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = eat();
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = eat();
      const r = parseFactor();
      v = op === "*" ? v * r : r === 0 ? NaN : v / r;
    }
    return v;
  }

  function parseFactor(): number {
    const t = peek();
    if (t === "+") {
      eat();
      return parseFactor();
    }
    if (t === "-") {
      eat();
      return -parseFactor();
    }
    if (t === "(") {
      eat();
      const v = parseExpression();
      eat(")");
      return v;
    }
    if (t && /^[A-Za-z]+\($/.test(t)) {
      const name = eat()!.slice(0, -1).toUpperCase();
      const args: string[] = [];
      if (peek() !== ")") {
        args.push(eat()!);
        while (peek() === ",") {
          eat(",");
          args.push(eat()!);
        }
      }
      eat(")");
      if (name === "SUM") {
        let sum = 0;
        for (const a of args) {
          for (const addr of expandRange(a)) {
            if (visiting.has(addr)) throw new Error("Circular reference");
            visiting.add(addr);
            sum += cellNumber(addr, cells, visiting);
            visiting.delete(addr);
          }
        }
        return sum;
      }
      throw new Error(`Unknown function ${name}`);
    }
    if (t && /^[A-Za-z]+\d+(?::[A-Za-z]+\d+)?$/.test(t)) {
      const ref = eat()!;
      if (ref.includes(":")) {
        throw new Error("Bare range not allowed; use SUM()");
      }
      const addr = ref.toUpperCase();
      if (visiting.has(addr)) throw new Error("Circular reference");
      visiting.add(addr);
      const n = cellNumber(addr, cells, visiting);
      visiting.delete(addr);
      return n;
    }
    if (t && /^[0-9]+(?:\.[0-9]+)?$/.test(t)) {
      return Number(eat());
    }
    throw new Error(`Unexpected token ${t}`);
  }

  try {
    const v = parseExpression();
    if (i !== tokens.length) throw new Error("Trailing tokens");
    return Number.isFinite(v) ? v : "#VALUE!";
  } catch (e) {
    return e instanceof Error && e.message.includes("Circular")
      ? "#CYCLE!"
      : "#ERROR!";
  }
}

function createEmpty(name = "Workbook"): WorkbookData {
  return {
    version: 1,
    name,
    activeSheet: 0,
    sheets: [{ name: "Sheet1", cells: {} }],
  };
}

function fromCsv(text: string, sheetName = "Sheet1"): WorkbookData {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const cells: Record<string, string> = {};
  rows.forEach((line, r) => {
    if (line === "" && r === rows.length - 1) return;
    const cols = parseCsvLine(line);
    cols.forEach((value, c) => {
      if (value !== "") cells[`${indexToCol(c)}${r + 1}`] = value;
    });
  });
  return {
    version: 1,
    name: "Workbook",
    activeSheet: 0,
    sheets: [{ name: sheetName, cells }],
  };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function toCsv(book: WorkbookData, sheetIndex = book.activeSheet): string {
  const sheet = book.sheets[sheetIndex] ?? book.sheets[0];
  let maxR = 0;
  let maxC = 0;
  for (const addr of Object.keys(sheet.cells)) {
    const p = parseAddress(addr);
    if (!p) continue;
    maxR = Math.max(maxR, p.row);
    maxC = Math.max(maxC, p.col);
  }
  const lines: string[] = [];
  for (let r = 0; r <= maxR; r++) {
    const cols: string[] = [];
    for (let c = 0; c <= maxC; c++) {
      const addr = `${indexToCol(c)}${r + 1}`;
      const v = sheet.cells[addr] ?? "";
      cols.push(escapeCsv(v));
    }
    lines.push(cols.join(","));
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}

function escapeCsv(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export const tsEngine: EngineApi = {
  createEmpty,
  fromCsv,
  toCsv,
  evaluate(formula, cells) {
    if (!formula.startsWith("=")) return literalValue(formula);
    return evaluateFormula(formula, cells);
  },
  backend: () => "ts-fallback",
};

/** Exported for tests / OCaml parity checks. */
export const __test = { evaluateFormula, expandRange, indexToCol, colToIndex };
