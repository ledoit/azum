<script lang="ts">
  import type { WorkbookData } from "../../engine";
  import { getEngine } from "../../engine";
  import { addr, indexToCol, parseAddr } from "./address";

  interface Props {
    book: WorkbookData;
    onchange: (book: WorkbookData) => void;
    onselection?: (label: string) => void;
  }

  let { book = $bindable(), onchange, onselection }: Props = $props();

  const ROW_COUNT = 50;
  const COL_COUNT = 26;

  let activeSheet = $state(0);
  let selCol = $state(0);
  let selRow = $state(0);
  let editing = $state(false);
  let draft = $state("");
  let formulaEl: HTMLInputElement | undefined = $state();
  let cellEl: HTMLInputElement | undefined = $state();

  let sheet = $derived(book.sheets[activeSheet] ?? book.sheets[0]);
  let selAddr = $derived(addr(selCol, selRow));

  $effect(() => {
    activeSheet = Math.min(book.activeSheet ?? 0, Math.max(0, book.sheets.length - 1));
  });

  $effect(() => {
    onselection?.(selAddr);
    if (!editing) {
      formulaBar = sheet?.cells[selAddr] ?? "";
    }
  });

  function emit(next: WorkbookData) {
    book = next;
    onchange(next);
  }

  function rawAt(c: number, r: number): string {
    return sheet?.cells[addr(c, r)] ?? "";
  }

  function displayAt(c: number, r: number): string {
    const raw = rawAt(c, r);
    if (!raw) return "";
    if (!raw.startsWith("=")) return raw;
    const v = getEngine().evaluate(raw, sheet.cells);
    return v == null ? "" : String(v);
  }

  function select(c: number, r: number) {
    commitEdit();
    selCol = Math.max(0, Math.min(COL_COUNT - 1, c));
    selRow = Math.max(0, Math.min(ROW_COUNT - 1, r));
    editing = false;
  }

  function beginEdit(seed?: string) {
    editing = true;
    draft = seed !== undefined ? seed : (sheet?.cells[selAddr] ?? "");
    formulaBar = draft;
    queueMicrotask(() => cellEl?.focus() ?? formulaEl?.focus());
  }

  function commitEdit() {
    if (!editing) return;
    editing = false;
    const value = draft;
    const cells = { ...sheet.cells };
    if (value === "") delete cells[selAddr];
    else cells[selAddr] = value;
    const sheets = book.sheets.map((s, i) =>
      i === activeSheet ? { ...s, cells } : s,
    );
    emit({ ...book, sheets, activeSheet });
    formulaBar = value;
  }

  function cancelEdit() {
    editing = false;
    draft = sheet?.cells[selAddr] ?? "";
    formulaBar = draft;
  }

  function onFormulaInput(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    draft = v;
    formulaBar = v;
    if (!editing) editing = true;
  }

  function onFormulaKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  function onCellKey(e: KeyboardEvent) {
    if (editing) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
        select(selCol, selRow + 1);
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitEdit();
        select(selCol + (e.shiftKey ? -1 : 1), selRow);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
      return;
    }

    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      beginEdit();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      select(selCol + (e.shiftKey ? -1 : 1), selRow);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      select(selCol, selRow - 1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      select(selCol, selRow + 1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      select(selCol - 1, selRow);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      select(selCol + 1, selRow);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const cells = { ...sheet.cells };
      delete cells[selAddr];
      const sheets = book.sheets.map((s, i) =>
        i === activeSheet ? { ...s, cells } : s,
      );
      emit({ ...book, sheets, activeSheet });
      formulaBar = "";
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      beginEdit(e.key);
    }
  }

  function switchSheet(i: number) {
    commitEdit();
    activeSheet = i;
    emit({ ...book, activeSheet: i });
    select(0, 0);
  }

  function addSheet() {
    commitEdit();
    const n = book.sheets.length + 1;
    const sheets = [...book.sheets, { name: `Sheet${n}`, cells: {} }];
    const i = sheets.length - 1;
    activeSheet = i;
    emit({ ...book, sheets, activeSheet: i });
    select(0, 0);
  }

  export function getBook(): WorkbookData {
    commitEdit();
    return { ...book, activeSheet };
  }

  export function loadBook(next: WorkbookData) {
    editing = false;
    book = next;
    activeSheet = next.activeSheet ?? 0;
    const p = parseAddr(Object.keys(next.sheets[activeSheet]?.cells ?? {})[0] ?? "A1");
    select(p?.col ?? 0, p?.row ?? 0);
  }
</script>

<div class="sheet" tabindex="0" onkeydown={onCellKey}>
  <div class="formula">
    <span class="name mono">{selAddr}</span>
    <input
      class="bar mono"
      bind:this={formulaEl}
      value={formulaBar}
      oninput={onFormulaInput}
      onkeydown={onFormulaKey}
      onfocus={() => {
        if (!editing) beginEdit();
      }}
      aria-label="Formula bar"
    />
  </div>

  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th class="corner"></th>
          {#each Array(COL_COUNT) as _, c}
            <th class:active={c === selCol}>{indexToCol(c)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each Array(ROW_COUNT) as _, r}
          <tr>
            <th class:active={r === selRow}>{r + 1}</th>
            {#each Array(COL_COUNT) as _, c}
              {@const selected = c === selCol && r === selRow}
              <td
                class:selected
                class:formula={rawAt(c, r).startsWith("=")}
                onclick={() => select(c, r)}
                ondblclick={() => beginEdit()}
              >
                {#if selected && editing}
                  <input
                    class="cell-edit mono"
                    bind:this={cellEl}
                    bind:value={draft}
                    oninput={() => (formulaBar = draft)}
                    onblur={commitEdit}
                  />
                {:else}
                  <span class="mono">{displayAt(c, r)}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="tabs">
    {#each book.sheets as s, i}
      <button
        type="button"
        class:active={i === activeSheet}
        onclick={() => switchSheet(i)}
      >
        {s.name}
      </button>
    {/each}
    <button type="button" class="add" onclick={addSheet} title="Add sheet">+</button>
  </div>
</div>

<style>
  .sheet {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
    min-height: 0;
    outline: none;
    background: #fff;
  }

  .formula {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid var(--vec-line);
    background: #faf8f3;
  }

  .name {
    min-width: 2.5rem;
    font-weight: 600;
    color: var(--vec-muted);
  }

  .bar {
    flex: 1;
    font: inherit;
    font-size: 0.9rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--vec-line);
    border-radius: 0.25rem;
    background: #fff;
    color: var(--vec-ink);
  }

  .bar:focus {
    outline: 2px solid var(--vec-accent-soft);
    border-color: var(--vec-accent);
  }

  .scroll {
    overflow: auto;
    min-height: 0;
  }

  table {
    border-collapse: collapse;
    table-layout: fixed;
    min-width: 100%;
  }

  th,
  td {
    border: 1px solid #ddd6c8;
    height: 1.65rem;
    padding: 0 0.35rem;
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  thead th,
  tbody th {
    background: #f0ebe1;
    color: var(--vec-muted);
    font-weight: 600;
    text-align: center;
    position: sticky;
    z-index: 1;
  }

  thead th {
    top: 0;
    min-width: 5.5rem;
  }

  thead th.corner {
    left: 0;
    z-index: 2;
    min-width: 2.4rem;
    width: 2.4rem;
  }

  tbody th {
    left: 0;
    min-width: 2.4rem;
    width: 2.4rem;
  }

  th.active {
    background: var(--vec-accent-soft);
    color: var(--vec-ink);
  }

  td {
    cursor: cell;
    background: #fff;
  }

  td.selected {
    outline: 2px solid var(--vec-accent);
    outline-offset: -2px;
    background: #f3faf4;
  }

  td.formula span {
    color: #1d4d2a;
  }

  .cell-edit {
    width: 100%;
    height: 100%;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    font-size: 0.8rem;
    background: transparent;
    color: var(--vec-ink);
    outline: none;
  }

  .mono {
    font-family: var(--vec-mono);
  }

  .tabs {
    display: flex;
    gap: 0.15rem;
    padding: 0.25rem 0.4rem;
    border-top: 1px solid var(--vec-line);
    background: #f0ebe1;
    overflow-x: auto;
  }

  .tabs button {
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.65rem;
    border: 1px solid transparent;
    border-radius: 0.25rem 0.25rem 0 0;
    background: transparent;
    color: var(--vec-muted);
    cursor: pointer;
  }

  .tabs button.active {
    background: #fff;
    border-color: var(--vec-line);
    color: var(--vec-ink);
  }

  .tabs .add {
    color: var(--vec-accent);
  }
</style>
