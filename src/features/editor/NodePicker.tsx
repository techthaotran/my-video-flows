import { useEffect, useMemo, useState } from 'react';
import { listPickerNodes } from '@/nodes/registry';
import { strings } from '@/shared/strings';
import { cn } from '@/shared/utils';
import type { NodeType } from '@/shared/schema';

const CAT_LABEL: Record<string, string> = {
  input: strings.catInput,
  llm: strings.catLlm,
  generate: strings.catGenerate,
  output: strings.catOutput,
  annotation: strings.catAnnotation,
};

export function NodePicker(props: {
  open: boolean;
  onClose: () => void;
  onSelect: (type: NodeType) => void;
  style?: React.CSSProperties;
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const nodes = useMemo(() => {
    const all = listPickerNodes();
    if (!q.trim()) return all;
    const qq = q.toLowerCase();
    return all.filter(
      (n) => n.title.toLowerCase().includes(qq) || n.description.toLowerCase().includes(qq),
    );
  }, [q]);

  useEffect(() => {
    if (!props.open) {
      setQ('');
      setIdx(0);
    }
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIdx((i) => Math.min(nodes.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter' && nodes[idx]) {
        e.preventDefault();
        props.onSelect(nodes[idx]!.type);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, nodes, idx, props]);

  if (!props.open) return null;

  const grouped = nodes.reduce<Record<string, typeof nodes>>((acc, n) => {
    (acc[n.category] ??= []).push(n);
    return acc;
  }, {});

  let flatIndex = -1;

  return (
    <div
      className="absolute z-50 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
      style={props.style}
    >
      <div className="border-b border-border p-2">
        <input
          autoFocus
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder={strings.nodePickerSearch}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
        />
        <div className="mt-1 text-[10px] text-muted-foreground">{strings.nodePickerHint}</div>
      </div>
      <div className="max-h-72 overflow-auto p-1">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="mb-1">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
              {CAT_LABEL[cat] ?? cat}
            </div>
            {list.map((n) => {
              flatIndex++;
              const active = flatIndex === idx;
              const myIdx = flatIndex;
              return (
                <button
                  key={n.type}
                  className={cn(
                    'flex w-full flex-col rounded-md px-2 py-1.5 text-left',
                    active ? 'bg-primary/20' : 'hover:bg-muted',
                  )}
                  onMouseEnter={() => setIdx(myIdx)}
                  onClick={() => props.onSelect(n.type)}
                >
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="text-[11px] text-muted-foreground">{n.description}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
