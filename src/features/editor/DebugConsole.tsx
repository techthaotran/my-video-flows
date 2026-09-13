import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ChevronRight,
  Copy,
  Crosshair,
  Pause,
  Play,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEditorStore } from '@/features/editor/store';
import { clearLogs, getLogs, LOG_LEVELS, subscribeLogs, type LogEntry, type LogLevel } from '@/shared/log';
import { sendToSw } from '@/shared/messaging';
import { cn } from '@/shared/utils';

const PREFS_KEY = 'debugConsole.prefs';
const MIN_HEIGHT = 140;
const MAX_ROWS = 1000;

interface Prefs {
  height: number;
  levels: LogLevel[];
  scope: string;
  onlySelected: boolean;
  onlyActiveRun: boolean;
}

const DEFAULT_PREFS: Prefs = {
  height: 280,
  levels: ['info', 'warn', 'error'],
  scope: '',
  onlySelected: false,
  onlyActiveRun: false,
};

const LEVEL_STYLE: Record<LogLevel, { chip: string; row: string; text: string }> = {
  debug: { chip: 'text-slate-400 border-slate-500/40', row: '', text: 'text-slate-400' },
  info: { chip: 'text-sky-300 border-sky-400/40', row: '', text: 'text-sky-300' },
  warn: { chip: 'text-amber-300 border-amber-400/40', row: 'bg-amber-500/[0.06]', text: 'text-amber-300' },
  error: { chip: 'text-red-300 border-red-400/40', row: 'bg-red-500/[0.08]', text: 'text-red-300' },
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage blocked */
  }
}

/** Live view of the log buffer, batched to one render per frame. */
export function useLogEntries(): LogEntry[] {
  const [entries, setEntries] = useState<LogEntry[]>(() => getLogs());
  useEffect(() => {
    let frame = 0;
    const unsubscribe = subscribeLogs(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setEntries(getLogs());
      });
    });
    setEntries(getLogs());
    return () => {
      unsubscribe();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return entries;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
}

export function DebugConsole({ open, onClose }: { open: boolean; onClose: () => void }) {
  const entries = useLogEntries();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<LogEntry[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const stickToBottom = useRef(true);

  const nodes = useEditorStore((s) => s.nodes);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const activeRunId = useEditorStore((s) => s.activeRunId);
  const rf = useReactFlow();

  const update = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });

  const source = paused && frozen ? frozen : entries;

  const nodeNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.id, String(n.data.label ?? n.data.slug ?? n.data.nodeType));
    }
    return map;
  }, [nodes]);

  const scopes = useMemo(() => [...new Set(entries.map((e) => e.scope))].sort(), [entries]);

  const counts = useMemo(() => {
    const c: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const e of source) c[e.level]++;
    return c;
  }, [source]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source
      .filter((e) => {
        if (!prefs.levels.includes(e.level)) return false;
        if (prefs.scope && e.scope !== prefs.scope) return false;
        if (prefs.onlySelected && selectedNodeId && e.nodeId !== selectedNodeId) return false;
        if (prefs.onlyActiveRun && activeRunId && e.runId !== activeRunId) return false;
        if (!q) return true;
        return (
          e.message.toLowerCase().includes(q) ||
          e.scope.toLowerCase().includes(q) ||
          (e.nodeId && (nodeNames.get(e.nodeId) ?? e.nodeId).toLowerCase().includes(q)) ||
          (e.data !== undefined && JSON.stringify(e.data).toLowerCase().includes(q))
        );
      })
      .slice(-MAX_ROWS);
  }, [source, prefs, query, selectedNodeId, activeRunId, nodeNames]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [visible, open]);

  const togglePause = () => {
    setFrozen(paused ? null : entries);
    setPaused(!paused);
  };

  const focusNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    useEditorStore.getState().setSelectedNodeId(nodeId);
    const w = node.measured?.width ?? 540;
    const h = node.measured?.height ?? 300;
    void rf.setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1, duration: 400 });
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = prefs.height;
    let nextH = startH;
    // Apply height on the DOM during drag so React Flow's ResizeObserver
    // is not fed a setState storm (which surfaces as "loop completed…").
    const onMove = (ev: PointerEvent) => {
      const max = Math.max(MIN_HEIGHT, window.innerHeight - 160);
      nextH = Math.min(max, Math.max(MIN_HEIGHT, startH + (startY - ev.clientY)));
      if (panelRef.current) panelRef.current.style.height = `${nextH}px`;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      update({ height: nextH });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  if (!open) return null;

  return (
    <section
      ref={panelRef}
      className="relative flex shrink-0 flex-col border-t border-border bg-[hsl(222_47%_6%)]"
      style={{ height: prefs.height }}
    >
      <div
        className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize hover:bg-primary/30"
        onPointerDown={startResize}
        title="Kéo để đổi chiều cao"
      />

      <header className="flex flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5 text-[11px]">
        <span className="mr-1 font-semibold tracking-wide text-foreground">Console</span>

        {LOG_LEVELS.map((level) => {
          const on = prefs.levels.includes(level);
          return (
            <button
              key={level}
              type="button"
              className={cn(
                'rounded border px-1.5 py-0.5 font-mono tabular-nums transition-colors',
                on ? LEVEL_STYLE[level].chip : 'border-transparent text-muted-foreground/60 line-through',
              )}
              onClick={() =>
                update({ levels: on ? prefs.levels.filter((l) => l !== level) : [...prefs.levels, level] })
              }
            >
              {level} {counts[level]}
            </button>
          );
        })}

        <select
          className="h-6 rounded border border-border bg-background px-1 text-[11px]"
          value={prefs.scope}
          onChange={(e) => update({ scope: e.target.value })}
        >
          <option value="">Mọi scope</option>
          {scopes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-1.5 h-3 w-3 text-muted-foreground" />
          <input
            className="h-6 w-44 rounded border border-border bg-background pl-5 pr-1.5 text-[11px] outline-none focus:border-primary/60"
            placeholder="Tìm trong message / data…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <ToggleChip
          on={prefs.onlySelected}
          disabled={!selectedNodeId}
          onClick={() => update({ onlySelected: !prefs.onlySelected })}
          title={selectedNodeId ? 'Chỉ log của node đang chọn' : 'Chọn một node trên canvas'}
        >
          Node đang chọn
        </ToggleChip>
        <ToggleChip
          on={prefs.onlyActiveRun}
          disabled={!activeRunId}
          onClick={() => update({ onlyActiveRun: !prefs.onlyActiveRun })}
          title="Chỉ log của run đang chạy"
        >
          Run hiện tại
        </ToggleChip>

        <div className="ml-auto flex items-center gap-0.5">
          <span className="mr-1 text-muted-foreground tabular-nums">
            {visible.length}/{source.length}
          </span>
          <IconBtn title={paused ? 'Tiếp tục cập nhật' : 'Tạm dừng cập nhật'} onClick={togglePause} active={paused}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn
            title="Copy log đang lọc (JSON)"
            onClick={() => copyText(JSON.stringify(visible, null, 2))}
          >
            <Copy className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            title="Xoá log"
            onClick={() => {
              clearLogs();
              setFrozen(paused ? [] : null);
              setExpanded(new Set());
              void sendToSw({ type: 'log.clear' });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn title="Đóng (Ctrl+`)" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-auto font-mono text-[11px] leading-[18px]"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {source.length ? 'Không có log khớp bộ lọc' : 'Chưa có log — chạy một node để bắt đầu'}
          </div>
        ) : (
          visible.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              nodeName={entry.nodeId ? nodeNames.get(entry.nodeId) : undefined}
              expanded={expanded.has(entry.id)}
              onToggle={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(entry.id)) next.delete(entry.id);
                  else next.add(entry.id);
                  return next;
                })
              }
              onFocusNode={focusNode}
            />
          ))
        )}
      </div>
    </section>
  );
}

const LogRow = memo(function LogRow({
  entry,
  nodeName,
  expanded,
  onToggle,
  onFocusNode,
}: {
  entry: LogEntry;
  nodeName?: string;
  expanded: boolean;
  onToggle: () => void;
  onFocusNode: (nodeId: string) => void;
}) {
  const style = LEVEL_STYLE[entry.level];
  const hasData = entry.data !== undefined;
  return (
    <div className={cn('group border-b border-border/40', style.row)}>
      <div
        className={cn('flex items-start gap-2 px-2 py-0.5 hover:bg-muted/40', hasData && 'cursor-pointer')}
        onClick={hasData ? onToggle : undefined}
      >
        <ChevronRight
          className={cn(
            'mt-[3px] h-3 w-3 shrink-0 text-muted-foreground transition-transform',
            !hasData && 'invisible',
            expanded && 'rotate-90',
          )}
        />
        <span className="shrink-0 text-muted-foreground/80 tabular-nums">{formatTime(entry.ts)}</span>
        <span className={cn('w-10 shrink-0 uppercase', style.text)}>{entry.level}</span>
        <span className="w-28 shrink-0 truncate text-violet-300/90" title={`${entry.scope} · ${entry.origin}`}>
          {entry.scope}
        </span>
        {entry.nodeId && (
          <button
            type="button"
            className="flex max-w-36 shrink-0 items-center gap-1 truncate rounded bg-muted px-1 text-[10px] text-amber-200 hover:bg-primary/20"
            title={`Tới node ${entry.nodeId}`}
            onClick={(e) => {
              e.stopPropagation();
              onFocusNode(entry.nodeId!);
            }}
          >
            <Crosshair className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{nodeName ?? entry.nodeId.slice(0, 8)}</span>
          </button>
        )}
        <span className={cn('min-w-0 flex-1 whitespace-pre-wrap break-words', entry.level === 'debug' ? 'text-foreground/70' : 'text-foreground')}>
          {entry.message}
        </span>
        <button
          type="button"
          className="invisible shrink-0 text-muted-foreground hover:text-foreground group-hover:visible"
          title="Copy dòng này"
          onClick={(e) => {
            e.stopPropagation();
            copyText(JSON.stringify(entry, null, 2));
          }}
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
      {expanded && hasData && (
        <pre className="mx-2 mb-1.5 ml-7 max-h-72 overflow-auto rounded border border-border/60 bg-black/30 p-2 text-[10.5px] leading-snug text-foreground/85">
          {JSON.stringify(entry.data, null, 2)}
        </pre>
      )}
    </div>
  );
});

function ToggleChip({
  on,
  disabled,
  onClick,
  title,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded border px-1.5 py-0.5 transition-colors disabled:opacity-40',
        on ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground',
        active && 'bg-amber-500/15 text-amber-300',
      )}
    >
      {children}
    </button>
  );
}
