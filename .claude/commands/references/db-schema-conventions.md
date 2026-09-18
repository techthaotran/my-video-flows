# DB Schema Conventions - My X Flows

> **Project-specific reference** for the `schema-store-designer` command (DB-schema half).
> Filled for **My X Flows** (Chrome extension MV3, local-only).
> When reusing the command in another project, overwrite this file with that project's stack.

## 1. Stack
- **Database engine:** IndexedDB in the browser, via **Dexie 4** (database name `my-x-flows`). No server, no cloud, no backend (AGENTS.md rule 1).
- **Schema / validation layer:** **Zod 3**. Every persisted shape is a Zod schema in `src/shared/schema/index.ts`; TS types come from `z.infer<typeof XSchema>`.
- **Migration tooling:** two separate mechanisms:
  - **Dexie table/index version:** `this.version(n).stores({...})` in `src/storage/db.ts`. Bump only when adding a table or changing an index.
  - **Document shape version:** `SCHEMA_VERSION` (currently `5`) + `migrateWorkflow` / `upgradeStoredWorkflow` in `src/shared/schema/index.ts`. Any change to the shape of stored workflow/node data must bump `SCHEMA_VERSION` and add a migrate branch (AGENTS.md rule 3). Old workflows in IndexedDB and `.xflow.zip/.xflow.json` files must still load.
- **Small key-value settings:** `chrome.storage.local` (`src/storage/repos/settingsRepo.ts`, Flow project id), not IndexedDB.

## 2. Where things live
- **Dexie database + record types:** `src/storage/db.ts` (`MyXFlowsDB`, `AssetRecord`, `OutputRecord`, `DraftRecord`, `RevisionRecord`, `NotificationRecord`).
- **Entity schemas, enums, migrate:** `src/shared/schema/index.ts`.
- **Repositories:** `src/storage/repos/*Repo.ts` (`workflowRepo`, `workspaceRepo`, `assetRepo`, `runRepo`, `templateRepo`, `settingsRepo`).
- **Import/export format:** `src/storage/transfer/` (`FORMAT_VERSION`, separate from `SCHEMA_VERSION`).
- **Node data per type:** `XxxNodeDataSchema` in `src/shared/schema/index.ts`, registered in `src/nodes/registry.ts`.

## 3. Naming conventions
- **Tables:** camelCase plural (`workflows`, `nodeRuns`, `outputs`).
- **Entity types:** PascalCase singular from Zod (`Workflow`, `WorkflowNode`, `NodeRun`, `OutputMeta`); record types that add a `blob` end in `Record` (`AssetRecord`, `OutputRecord`).
- **Schemas:** `XxxSchema` (`WorkflowSchema`, `GenerateVideoNodeDataSchema`).
- **Fields:** camelCase (`workspaceId`, `previewOutputId`, `flowMediaId`).
- **Primary key:** string `id` generated with `nanoid()` (`@/shared/utils`); `drafts` is keyed by `workflowId`.
- **Enums:** no TS `enum`. Use `z.enum([...])` or `const X = [...] as const` + `(typeof X)[number]` (e.g. `ASSET_LABELS`, `VIDEO_MODELS`).
- **Timestamps:** epoch milliseconds (`number`, `Date.now()`), never `Date`.

## 4. Standard / shared fields
- Top-level entities carry `id`, `createdAt`, `updatedAt` (epoch ms). Repos set `updatedAt` on every write.
- `Workflow` also carries `schemaVersion`, `workspaceId`, `enabled`, `locked`, `deletedAt?`.
- **Soft delete exists for workflows only** (`deletedAt`, `workflowRepo.softDelete/restore`); `hardDelete` also removes drafts and revisions. Do not assume soft delete elsewhere.
- **Node data** is stored as an untyped record on `WorkflowNode.data` and validated per type with `validateNodeData(type, data)` on save.
- **Runtime fields on node data** (`previewOutputId`, `formattedOutput`, `continueFrameAssetId`) are written by the service worker after a run.

## 5. Typing & integrity rules
- Parse with Zod before writing (`WorkflowSchema.parse`); use `.default()` for defaults, `.optional()` for optional fields.
- **Blobs** live only in `assets` and `outputs`; other entities reference them by id (`assetId`, `previewOutputId`, `outputIds`). Blobs never travel through `chrome.runtime` messages.
- **Referential integrity is application-level** (no FK in IndexedDB). A missing asset is flagged (`missing: true`), not cascaded.
- **Flow assets** keep `flowMediaId` only and are never re-uploaded (AGENTS.md rule 6).
- **Secrets:** never persist or log token/captcha/cookie (AGENTS.md rule 8).
- Multi-table writes use `db.transaction('rw', ...)`.

## 6. Indexing conventions
- Indexes are declared in the `stores({...})` string (`'id, workspaceId, updatedAt'`, compound `[runId+nodeId]`).
- Only index fields used by `where()` / sort in a repo. Adding or changing an index requires a new `this.version(n)`.

## 7. Store / persistence layer pattern
- One repo per aggregate, exported as a plain object literal (`export const workflowRepo = { async list() {...}, ... }`), not a class.
- Method naming: `list`, `get`, `create`, `save`, `setX`, `rename`, `softDelete`, `restore`, `hardDelete`, `duplicate`.
- Reads return upgraded entities (`upgradeStoredWorkflow`) and filter soft-deleted rows.
- `workflowRepo.save` writes the **whole** workflow document, keeps up to 20 revisions and clears the draft.
- UI pages (side panel, editor) and the service worker (`src/background`, `src/engine`) all call repos directly, since they share the same extension origin and IndexedDB.

## 8. Examples in this codebase
- **Database + tables:** `src/storage/db.ts`.
- **Entity + migrate:** `WorkflowSchema`, `MergeVideoNodeDataSchema`, `migrateWorkflow` in `src/shared/schema/index.ts` (v5 added `mergeVideo`).
- **Repository:** `src/storage/repos/workflowRepo.ts`.
- **SW writing runtime node data:** `src/engine/RunManager.ts` (sets `previewOutputId` after a node succeeds).
