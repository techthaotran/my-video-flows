import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  Filter,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Bell,
  Upload,
  Play,
  Trash2,
} from 'lucide-react';
import { db } from '@/storage/db';
import { workspaceRepo } from '@/storage/repos/workspaceRepo';
import { workflowRepo, createEmptyWorkflow } from '@/storage/repos/workflowRepo';
import { templateRepo } from '@/storage/repos/templateRepo';
import { getSettings, setSettings, getUiState, setUiState } from '@/storage/repos/settingsRepo';
import { exportWorkflows, exportBackup, parseImportFile, commitImport } from '@/storage/transfer';
import { chromeDownload, formatRelativeTime, cn } from '@/shared/utils';
import { strings } from '@/shared/strings';
import { sendToSw, connectRunEvents } from '@/shared/messaging';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Workflow, AppSettings } from '@/shared/schema';
import type { ImportPreview } from '@/storage/transfer';

function openEditor(workflowId: string) {
  chrome.runtime.sendMessage({ type: 'editor.open', workflowId });
}

export function SidePanelApp() {
  const workspaces = useLiveQuery(() => workspaceRepo.list(), []) ?? [];
  const workflows = useLiveQuery(() => workflowRepo.list(), []) ?? [];
  const templates = useLiveQuery(() => templateRepo.list(), []) ?? [];
  const current = workspaces.find((w) => w.isCurrent) ?? workspaces[0];

  const [subTab, setSubTab] = useState<'workflows' | 'templates'>('workflows');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [queue, setQueue] = useState({ running: 0, waiting: 0 });
  const [providerStatus, setProviderStatus] = useState<{ flow?: boolean; gemini?: boolean }>({});
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    void getUiState().then((s) => {
      setSubTab(s.subTab);
      setFilter(s.filter);
      setSearch(s.search);
    });
    void getSettings().then(setSettingsState);
    const port = connectRunEvents((ev) => {
      if (ev.type === 'queue.update') setQueue({ running: ev.running, waiting: ev.waiting });
    });
    void sendToSw<{ authenticated: boolean }>({ type: 'provider.checkAuth', provider: 'flow' }).then(
      (r) => {
        if (r.ok) setProviderStatus((p) => ({ ...p, flow: r.data.authenticated }));
      },
    );
    void sendToSw<{ authenticated: boolean }>({ type: 'provider.checkAuth', provider: 'gemini' }).then(
      (r) => {
        if (r.ok) setProviderStatus((p) => ({ ...p, gemini: r.data.authenticated }));
      },
    );
    return () => port.disconnect();
  }, []);

  useEffect(() => {
    void setUiState({ subTab, filter, search });
  }, [subTab, filter, search]);

  const filtered = useMemo(() => {
    let list = workflows;
    if (current) list = list.filter((w) => w.workspaceId === current.id);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((w) => w.name.toLowerCase().includes(q));
    }
    if (filter === 'enabled') list = list.filter((w) => w.enabled);
    if (filter === 'disabled') list = list.filter((w) => !w.enabled);
    return list;
  }, [workflows, current, search, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Workflow[]>();
    for (const w of filtered) {
      const list = map.get(w.workspaceId) ?? [];
      list.push(w);
      map.set(w.workspaceId, list);
    }
    return map;
  }, [filtered]);

  const onCreateBlank = async () => {
    if (!current) return;
    const wf = await workflowRepo.create(createEmptyWorkflow(current.id));
    openEditor(wf.id);
  };

  const onUseTemplate = async (templateId: string) => {
    if (!current) return;
    const t = await templateRepo.get(templateId);
    if (!t) return;
    const wf = await workflowRepo.cloneFromTemplate(t.workflow as never, current.id);
    openEditor(wf.id);
  };

  const onImportFiles = async (files: FileList | File[]) => {
    const file = [...files][0];
    if (!file) return;
    const s = settings ?? (await getSettings());
    const preview = await parseImportFile(file, {
      maxZipMb: s.importMaxZipMb,
      maxJsonMb: s.importMaxJsonMb,
    });
    setImportPreview(preview);
  };

  const onCommitImport = async () => {
    if (!importPreview || !current) return;
    const created = await commitImport({
      preview: importPreview,
      targetWorkspaceId: current.id,
      dupStrategy: 'copy',
    });
    setImportPreview(null);
    if (created.length === 1) openEditor(created[0]!.id);
  };

  const onExport = async (ids: string[]) => {
    const result = await exportWorkflows({ workflowIds: ids, includeAssets: true, format: 'zip' });
    await chromeDownload(result.blob, result.filename, true);
  };

  const onRunAll = async () => {
    if (!current) return;
    const n = filtered.filter((w) => w.enabled).length;
    if (!n || !confirm(strings.runAllConfirm(n))) return;
    await sendToSw({ type: 'runAll', workspaceId: current.id });
  };

  const toggleMaxSpeed = async (v: boolean) => {
    const next = await setSettings({ maxSpeed: v });
    setSettingsState(next);
  };

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) void onImportFiles(e.dataTransfer.files);
      }}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary m-2 rounded-lg">
          <span className="text-sm font-medium">{strings.importDropZone}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
            X
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{strings.appName}</div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span>Flow: {providerStatus.flow ? strings.providerOk : strings.providerUnauth}</span>
              <span>Gemini: {providerStatus.gemini ? strings.providerOk : strings.providerUnauth}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title={strings.notifications}>
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title={strings.settings} onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <select
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          value={current?.id ?? ''}
          onChange={(e) => void workspaceRepo.setCurrent(e.target.value)}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
              {w.isCurrent ? ` · ${strings.workspaceCurrent}` : ''}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="icon"
          title={strings.workspaceCreate}
          onClick={async () => {
            const name = prompt(strings.workspaceNew, 'Workspace');
            if (!name) return;
            const ws = await workspaceRepo.create(name);
            await workspaceRepo.setCurrent(ws.id);
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title={strings.workspaceDelete}
          disabled={!current || workspaces.length <= 1}
          onClick={async () => {
            if (!current) return;
            if (workspaces.length <= 1) {
              alert(strings.workspaceDeleteLast);
              return;
            }
            if (!confirm(strings.workspaceDeleteConfirm(current.name))) return;
            const wfCount = workflows.filter(
              (w) => w.workspaceId === current.id && !w.deletedAt,
            ).length;
            try {
              if (wfCount > 0) {
                if (!confirm(strings.workspaceDeleteWithWorkflows(wfCount))) return;
                await workspaceRepo.remove(current.id, { force: true });
              } else {
                await workspaceRepo.remove(current.id);
              }
            } catch (e) {
              alert(e instanceof Error ? e.message : strings.error);
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 px-3 pt-2">
        {(['workflows', 'templates'] as const).map((t) => (
          <button
            key={t}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium',
              subTab === t ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setSubTab(t)}
          >
            {t === 'workflows' ? strings.subWorkflows : strings.subTemplates}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      {subTab === 'workflows' && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
          <div className="relative flex-1 min-w-[120px]">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7"
              placeholder={strings.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" title={strings.refresh} onClick={() => void db.workflows.toArray()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <label>
            <Button variant="ghost" size="icon" title={strings.import} asChild>
              <span>
                <Upload className="h-4 w-4" />
              </span>
            </Button>
            <input
              type="file"
              accept=".json,.zip,.xflow.json,.xflow.zip"
              className="hidden"
              onChange={(e) => e.target.files && void onImportFiles(e.target.files)}
            />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title={strings.filterAll}>
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[
                ['all', strings.filterAll],
                ['enabled', strings.filterEnabled],
                ['disabled', strings.filterDisabled],
              ].map(([k, label]) => (
                <DropdownMenuItem key={k} onClick={() => setFilter(k)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" onClick={() => void onRunAll()}>
            <Play className="h-3.5 w-3.5" />
            {strings.runAll}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" />
                {strings.addNew}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => void onCreateBlank()}>{strings.addBlank}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSubTab('templates')}>{strings.addFromTemplate}</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json,.zip';
                  input.onchange = () => input.files && void onImportFiles(input.files);
                  input.click();
                }}
              >
                {strings.addImport}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        {subTab === 'templates' ? (
          templates.length === 0 ? (
            <Empty text={strings.emptyTemplates} />
          ) : (
            <div className="grid gap-2 p-1">
              {templates.map((t) => (
                <div key={t.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {strings.nodesCount(t.workflow.nodes?.length ?? 0)}
                    </span>
                    <Button size="sm" onClick={() => void onUseTemplate(t.id)}>
                      {strings.useTemplate}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <Empty text={strings.emptyWorkflows} />
        ) : (
          [...grouped.entries()].map(([wsId, list]) => {
            const ws = workspaces.find((w) => w.id === wsId);
            return (
              <div key={wsId} className="mb-3">
                <div className="sticky top-0 z-10 bg-background/95 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {ws?.name ?? wsId} ({list.length})
                  {ws?.isCurrent ? (
                    <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] normal-case text-primary">
                      {strings.workspaceCurrent}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  {list.map((w) => (
                    <WorkflowRow
                      key={w.id}
                      workflow={w}
                      selected={selected.has(w.id)}
                      onSelect={(v) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(w.id);
                          else next.delete(w.id);
                          return next;
                        });
                      }}
                      onOpen={() => openEditor(w.id)}
                      onToggle={(en) => void workflowRepo.setEnabled(w.id, en)}
                      onExport={() => void onExport([w.id])}
                      onDuplicate={() => void workflowRepo.duplicate(w.id)}
                      onDelete={() => void workflowRepo.softDelete(w.id)}
                      onRename={async () => {
                        const name = prompt(strings.rename, w.name);
                        if (name) await workflowRepo.rename(w.id, name);
                      }}
                      onRun={() => void sendToSw({ type: 'workflow.run', workflowId: w.id })}
                      onSaveTemplate={async () => {
                        await templateRepo.saveFromWorkflow(w, { name: w.name });
                        alert(strings.success);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Batch bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-3 py-2 text-xs">
          <span>Đã chọn {selected.size}</span>
          <Button size="sm" variant="secondary" onClick={() => void onExport([...selected])}>
            <Download className="h-3.5 w-3.5" />
            {strings.export}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {strings.cancel}
          </Button>
        </div>
      )}

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
        <label className="flex items-center gap-2">
          <Switch checked={!!settings?.maxSpeed} onCheckedChange={(v) => void toggleMaxSpeed(v)} />
          {strings.maxSpeed}
        </label>
        <span className="text-muted-foreground">
          {queue.running + queue.waiting === 0
            ? strings.queueIdle
            : `${strings.queueRunning(queue.running)} · ${strings.queueWaiting(queue.waiting)}`}
        </span>
      </footer>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{strings.settingsTitle}</DialogTitle>
          </DialogHeader>
          {settings && (
            <div className="space-y-3 text-sm">
              <Field label={strings.settingsDownloadFolder}>
                <Input
                  value={settings.downloadFolder}
                  onChange={(e) => setSettingsState({ ...settings, downloadFolder: e.target.value })}
                />
              </Field>
              <Field label={strings.settingsDefaultConcurrency}>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={settings.defaultConcurrency}
                  onChange={(e) =>
                    setSettingsState({ ...settings, defaultConcurrency: Number(e.target.value) || 1 })
                  }
                />
              </Field>
              <Field label={strings.settingsImportMaxZip}>
                <Input
                  type="number"
                  value={settings.importMaxZipMb}
                  onChange={(e) =>
                    setSettingsState({ ...settings, importMaxZipMb: Number(e.target.value) || 2048 })
                  }
                />
              </Field>
              <div className="text-xs text-muted-foreground">
                {strings.settingsVersion}: {chrome.runtime.getManifest().version}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    await setSettings(settings);
                    setSettingsOpen(false);
                  }}
                >
                  {strings.save}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const result = await exportBackup();
                    await chromeDownload(result.blob, result.filename, true);
                  }}
                >
                  {strings.backup}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.zip,.xflow-backup.zip';
                    input.onchange = () => input.files && void onImportFiles(input.files);
                    input.click();
                  }}
                >
                  {strings.restore}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import preview */}
      <Dialog open={!!importPreview} onOpenChange={(o) => !o && setImportPreview(null)}>
        <DialogContent className="w-[min(92vw,480px)]">
          <DialogHeader>
            <DialogTitle>{strings.importPreview}</DialogTitle>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-2 text-sm">
              {importPreview.items.map((item) => (
                <div key={item.id} className="rounded border border-border p-2">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {strings.nodesCount(item.nodeCount)} · {item.assetCount} asset
                  </div>
                  {item.warnings.map((w) => (
                    <div key={w} className="text-xs text-amber-400">
                      {w}
                    </div>
                  ))}
                </div>
              ))}
              <Button onClick={() => void onCommitImport()}>{strings.importCommit}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function WorkflowRow(props: {
  workflow: Workflow;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onOpen: () => void;
  onToggle: (v: boolean) => void;
  onExport: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: () => void;
  onRun: () => void;
  onSaveTemplate: () => void;
}) {
  const { workflow: w } = props;
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2 hover:border-primary/40">
      <input
        type="checkbox"
        checked={props.selected}
        onChange={(e) => props.onSelect(e.target.checked)}
        className="accent-primary"
      />
      <button className="min-w-0 flex-1 text-left" onClick={props.onOpen}>
        <div className="truncate text-sm font-medium">{w.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {strings.nodesCount(w.nodes.length)} · {formatRelativeTime(w.updatedAt)}
        </div>
      </button>
      <Switch checked={w.enabled} onCheckedChange={props.onToggle} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpen}>{strings.openEditor}</DropdownMenuItem>
          <DropdownMenuItem onClick={props.onRun}>{strings.run}</DropdownMenuItem>
          <DropdownMenuItem onClick={props.onRename}>{strings.rename}</DropdownMenuItem>
          <DropdownMenuItem onClick={props.onDuplicate}>{strings.duplicate}</DropdownMenuItem>
          <DropdownMenuItem onClick={props.onExport}>{strings.export}</DropdownMenuItem>
          <DropdownMenuItem onClick={props.onSaveTemplate}>{strings.saveAsTemplate}</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={props.onDelete}>
            {strings.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
