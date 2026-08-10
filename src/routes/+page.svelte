<script lang="ts">
  import { onMount } from "svelte";
  import { listen } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { initEngine, getEngine } from "../engine";
  import {
    basename,
    extensionOf,
    pickOpenPath,
    pickSavePath,
  } from "../lib/platform/files";
  import { loadPath, savePath } from "../lib/spreadsheet/io";
  import { mountUniver, type UniverHandle } from "../lib/spreadsheet/univerHost";

  let hostEl: HTMLDivElement | undefined = $state();
  let handle: UniverHandle | null = null;
  let filePath = $state<string | null>(null);
  let dirty = $state(false);
  let status = $state("Ready");
  let selection = $state("");
  let sheetName = $state("Sheet1");
  let engineLabel = $state("ts-fallback");
  let title = $derived(
    `${dirty ? "• " : ""}${filePath ? basename(filePath) : "Untitled"} — Vec`,
  );

  async function refreshChrome() {
    if (!handle) return;
    selection = handle.selectionLabel();
    sheetName = handle.activeSheetName();
    try {
      await getCurrentWindow().setTitle(title);
    } catch {
      /* browser preview */
    }
  }

  function markDirty() {
    dirty = true;
    status = "Unsaved changes";
    void refreshChrome();
  }

  async function newWorkbook() {
    if (!handle) return;
    handle.loadWorkbookData(getEngine().createEmpty("Workbook"));
    filePath = null;
    dirty = false;
    status = "New workbook";
    await refreshChrome();
  }

  async function openWorkbook() {
    if (!handle) return;
    const path = await pickOpenPath();
    if (!path) return;
    const data = await loadPath(path);
    handle.loadWorkbookData(data);
    filePath = path;
    dirty = false;
    status = `Opened ${basename(path)}`;
    await refreshChrome();
  }

  async function saveWorkbook(saveAs = false) {
    if (!handle) return;
    let path = filePath;
    if (saveAs || !path) {
      const ext =
        path && extensionOf(path) === "csv"
          ? "csv"
          : path && extensionOf(path) === "xlsx"
            ? "xlsx"
            : "vec";
      path = await pickSavePath(path ?? undefined, ext);
      if (!path) return;
    }
    const data = handle.getWorkbookData();
    await savePath(path, data);
    filePath = path;
    dirty = false;
    status = `Saved ${basename(path)}`;
    await refreshChrome();
  }

  onMount(() => {
    let unlisten: (() => void) | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    (async () => {
      const engine = await initEngine();
      engineLabel = engine.backend();
      if (!hostEl) return;
      handle = mountUniver(hostEl);
      handle.onDirty(markDirty);
      await refreshChrome();

      unlisten = await listen<string>("vec://menu", async (event) => {
        try {
          switch (event.payload) {
            case "file_new":
              await newWorkbook();
              break;
            case "file_open":
              await openWorkbook();
              break;
            case "file_save":
              await saveWorkbook(false);
              break;
            case "file_save_as":
              await saveWorkbook(true);
              break;
          }
        } catch (err) {
          status = err instanceof Error ? err.message : String(err);
        }
      });

      timer = setInterval(() => void refreshChrome(), 800);
    })().catch((err) => {
      status = err instanceof Error ? err.message : String(err);
    });

    return () => {
      unlisten?.();
      if (timer) clearInterval(timer);
      handle?.dispose();
    };
  });
</script>

<div class="shell">
  <header class="top">
    <div class="brand">
      <span class="mark" aria-hidden="true"></span>
      <div>
        <h1>Vec</h1>
        <p>Local spreadsheet</p>
      </div>
    </div>
    <div class="actions">
      <button type="button" onclick={() => newWorkbook()}>New</button>
      <button type="button" onclick={() => openWorkbook()}>Open</button>
      <button type="button" class="primary" onclick={() => saveWorkbook(false)}>Save</button>
      <button type="button" onclick={() => saveWorkbook(true)}>Save As</button>
    </div>
  </header>

  <div class="grid" bind:this={hostEl}></div>

  <footer class="status">
    <span>{sheetName}</span>
    <span class="sep">/</span>
    <span class="mono">{selection || "—"}</span>
    <span class="grow"></span>
    <span class="muted">{status}</span>
    <span class="pill">{engineLabel}</span>
  </footer>
</div>

<style>
  .shell {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
    min-height: 100vh;
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid var(--vec-line);
    background: var(--vec-panel);
    backdrop-filter: blur(8px);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .mark {
    width: 2rem;
    height: 2rem;
    border-radius: 0.35rem;
    background:
      linear-gradient(145deg, var(--vec-accent), #1d3a24 70%),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 6px,
        rgba(255, 255, 255, 0.12) 6px,
        rgba(255, 255, 255, 0.12) 7px
      );
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
  }

  h1 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }

  .brand p {
    margin: 0.1rem 0 0;
    font-size: 0.75rem;
    color: var(--vec-muted);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  button {
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.4rem 0.75rem;
    border-radius: 0.35rem;
    border: 1px solid var(--vec-line);
    background: #fffdf8;
    color: var(--vec-ink);
    cursor: pointer;
  }

  button:hover {
    border-color: var(--vec-accent);
    background: var(--vec-accent-soft);
  }

  button.primary {
    background: var(--vec-accent);
    border-color: var(--vec-accent);
    color: #f7fff8;
  }

  button.primary:hover {
    filter: brightness(1.05);
  }

  .grid {
    min-height: 0;
    height: 100%;
    background: #fff;
    border-bottom: 1px solid var(--vec-line);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem;
    font-size: 0.78rem;
    color: var(--vec-muted);
    background: var(--vec-bg-deep);
  }

  .grow {
    flex: 1;
  }

  .sep {
    opacity: 0.5;
  }

  .mono {
    font-family: var(--vec-mono);
    color: var(--vec-ink);
  }

  .muted {
    opacity: 0.9;
  }

  .pill {
    font-family: var(--vec-mono);
    font-size: 0.7rem;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    border: 1px solid var(--vec-line);
    background: #fffdf8;
    color: var(--vec-ink);
  }
</style>
