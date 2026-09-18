# GUI Store Conventions - My X Flows

> **Project-specific reference** for the `schema-store-designer` command (GUI-store half).
> Filled for **My X Flows** (Chrome extension MV3, local-only).
> When reusing the command in another project, overwrite this file (together with `db-schema-conventions.md`).

## 1. Stack
- **Framework:** React 19 + TypeScript strict, Vite + `@crxjs/vite-plugin`, Tailwind + shadcn/ui (dark theme).
- **Client state library:** **Zustand 5** (`create`), with **zundo** (`temporal`) for undo/redo in the editor.
- **Server-state layer:** there is no HTTP API. "Server" data comes from two places:
  - **IndexedDB (Dexie)**, read directly by UI pages; live reads via `useLiveQuery` from `dexie-react-hooks`.
  - **Service worker (SW)**, reached through typed `chrome.runtime` messages.
- **Canvas:** `@xyflow/react` 12 (editor only).

## 2. Where things live
- **Pages (entry points):** `src/pages/{sidepanel,editor,offscreen}/` (`index.html` + `main.tsx`). A new window is a new page here plus an entry in the Vite/CRX inputs.
- **Feature UI + stores:** `src/features/<feature>/`; the editor store is `src/features/editor/store.ts` (`useEditorStore`).
- **"API" contract (messages):** `src/shared/messaging/index.ts`:
  - `UiToSwMessage`: UI → SW commands, sent with `sendToSw()`, answered with `MessageResponse<T>`.
  - `SwToUiEvent`: SW → UI stream over the `run-events` port, opened with `connectRunEvents()`. The channel reconnects by itself.
  - `SwToContentMessage` / `ContentToSwMessage`: SW ↔ content script (providers).
- **SW handlers:** `src/background/index.ts`; run logic in `src/engine/RunManager.ts`.
- **Shared media hooks/components:** `src/features/editor/nodes/useMediaUrl.ts`, `MediaPreview.tsx`, `MergeVideoBody.tsx`, `FlowAssetPicker.tsx`.
- **UI strings:** `src/shared/strings.ts` only (AGENTS.md rule 2).

## 3. Server-state vs. client-state split
- **Persisted data** (workflows, workspaces, assets, outputs): source of truth is IndexedDB.
  - Lists that must stay fresh use `useLiveQuery(() => repo.list())` (side panel).
  - The editor loads once (`workflowRepo.get`) into `useEditorStore`, edits in memory (`dirty`), autosaves a draft (`workflowRepo.saveDraft`, debounced 800 ms) and saves with `workflowRepo.save`.
- **Run state** (status, progress, outputs, runtime node data): pushed by the SW as `SwToUiEvent` (`node.status`, `node.progress`, `node.output`, `node.data`, `run.done`, `queue.update`). Held in the page store, not persisted by the UI.
  - On (re)connect the SW replays active statuses.
- **UI-only state** (selection, picker, dialogs, console open): the Zustand store or local `useState`. Per-viewer conveniences go to `localStorage` wrapped in try/catch; app settings go to `chrome.storage.local` via `settingsRepo`.

## 4. Store shape & naming
- **Store hook:** `useXxxStore = create<XxxState>()(...)`; state interface `XxxState` holds data fields and action functions together (see `EditorState`).
- **Entity types:** import from `@/shared/schema` (`Workflow`, `WorkflowNode`, node data types). Do not redefine them on the client.
- **View-model types:** only where the UI library needs its own shape (e.g. `FlowNode` for React Flow), with explicit mapper functions (`wfNodeToFlow`, `flowToWfNode`) and a `toWorkflow()` back-conversion.
- **Runtime-only fields** on a view model (`status`, `progress`, `error`) are marked in the type and never persisted.
- **No TS `enum`:** use unions or `as const` arrays.

## 5. Mutations & sync
- **Persisted edits:** go through repos (`workflowRepo.save`, `setEnabled`, `rename`).
  - The editor mutates its store first (optimistic), marks `dirty`, then saves. Undo/redo is store-level (zundo).
- **Run commands:** `sendToSw({ type: 'workflow.run', workflowId, mode, fromNodeId })`, `run.cancel`, `workflow.cancel`. The UI saves dirty changes before sending a run.
- **Reconciliation:** the SW writes runtime node data (`previewOutputId`) to the workflow and broadcasts `node.output` / `node.data`; the UI patches its store without marking it dirty (`setNodePreview`).
- **Invalidation:** `useLiveQuery` re-runs automatically on Dexie writes, including writes from other extension pages and the SW (same origin).
- **New messages:** declare them in the union in `src/shared/messaging/index.ts` first, then handle them in the SW (AGENTS.md rule 4). No untyped messages.

## 6. Validation & mapping
- **Typing source:** Zod schemas in `src/shared/schema/index.ts` are the single contract across IndexedDB, SW and UI. Message payload types live in `src/shared/messaging/index.ts`.
- **Naming for message payloads:** a message is a union member `{ type: 'domain.action'; ...fields }` (e.g. `'workflow.run'`, `'node.output'`). If a payload is reused elsewhere, extract it as an `interface XxxPayload`; responses are typed with `MessageResponse<T>`.
- **Node data validation:** `validateNodeData(type, data)` before save. Forms are plain controlled inputs; there is no form library.
- **Mapping:** the store holds schema types as-is, except explicit view models (section 4). Mark any derived or UI-only field.

## 7. Examples in this codebase
- **Store:** `src/features/editor/store.ts` (Zustand + zundo, view-model mappers, runtime-only fields).
- **Live list:** `src/features/sidepanel/SidePanelApp.tsx` (`useLiveQuery` over repos).
- **Messages + run events:** `src/shared/messaging/index.ts` (`sendToSw`, `connectRunEvents`); consumer in `src/features/editor/EditorApp.tsx`.
- **Media preview hooks (with known pitfalls documented in `docs/WORKFLOW.md` §2.6):** `src/features/editor/nodes/useMediaUrl.ts`.
