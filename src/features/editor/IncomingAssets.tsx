import { useEffect, useState } from 'react';
import { ImagePlus, Clapperboard, Volume2, Type, AlertCircle } from 'lucide-react';
import { assetRepo } from '@/storage/repos/assetRepo';
import { cn } from '@/shared/utils';
import type { IncomingItem } from '@/features/editor/incomingInputs';
import { PORT_COLORS } from '@/nodes/ports';

function useAssetUrl(assetId?: string, missing?: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    void (async () => {
      if (!assetId || missing) {
        setUrl(null);
        return;
      }
      const asset = await assetRepo.get(assetId);
      if (!asset) {
        setUrl(null);
        return;
      }
      const next = URL.createObjectURL(asset.blob);
      revoked = next;
      setUrl(next);
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [assetId, missing]);
  return url;
}

export function AssetThumb({
  item,
  size = 'sm',
}: {
  item: IncomingItem;
  size?: 'sm' | 'md';
}) {
  const localUrl = useAssetUrl(item.flowMediaId ? undefined : item.assetId, item.missing);
  const [broken, setBroken] = useState(false);
  const url = item.flowMediaId ? (broken ? null : (item.flowPreviewUrl ?? null)) : localUrl;
  const box = size === 'md' ? 'h-16 w-16' : 'h-10 w-10';

  if (item.kind === 'text') {
    return (
      <div
        className={cn(
          box,
          'flex shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground',
        )}
        title={item.title}
      >
        <Type className="h-3.5 w-3.5" />
      </div>
    );
  }

  if (item.kind === 'genImage' || item.kind === 'genVideo') {
    const Icon = item.kind === 'genImage' ? ImagePlus : Clapperboard;
    return (
      <div
        className={cn(
          box,
          'flex shrink-0 flex-col items-center justify-center gap-0.5 rounded border border-dashed border-primary/40 bg-primary/5 text-primary',
        )}
        title={item.title}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[8px] leading-none">{item.kind === 'genImage' ? 'IMG' : 'VID'}</span>
      </div>
    );
  }

  if (item.kind === 'audio') {
    return (
      <div
        className={cn(
          box,
          'flex shrink-0 items-center justify-center rounded border border-border bg-muted',
        )}
        style={{ borderColor: PORT_COLORS.audio }}
        title={item.title}
      >
        <Volume2 className="h-3.5 w-3.5 text-pink-300" />
      </div>
    );
  }

  if (item.flowMediaId && !url) {
    return (
      <div
        className={cn(
          box,
          'flex shrink-0 flex-col items-center justify-center rounded border border-sky-400/40 bg-sky-400/10 text-[8px] text-sky-300',
        )}
        title={`${item.title} · ${item.flowMediaId}`}
      >
        FLOW
      </div>
    );
  }

  if (item.missing || !url) {
    return (
      <div
        className={cn(
          box,
          'flex shrink-0 flex-col items-center justify-center rounded border border-destructive/40 bg-destructive/10 text-destructive',
        )}
        title={item.title}
      >
        <AlertCircle className="h-3.5 w-3.5" />
      </div>
    );
  }

  if (item.assetKind === 'video') {
    return (
      <video
        src={url}
        onError={() => setBroken(true)}
        muted
        className={cn(box, 'shrink-0 rounded border border-border object-cover bg-muted')}
        title={item.flowMediaId ? `${item.title} · ${item.flowMediaId}` : item.title}
      />
    );
  }

  return (
    <img
      src={url}
      onError={() => setBroken(true)}
      alt={item.title}
      className={cn(box, 'shrink-0 rounded border border-border object-cover bg-muted')}
      title={item.flowMediaId ? `${item.title} · ${item.flowMediaId}` : item.title}
    />
  );
}

/** Compact strip of referenced / connected media for node cards */
export function ReferencedAssetsStrip({
  items,
  max = 6,
  removable,
  onRemove,
}: {
  items: IncomingItem[];
  max?: number;
  removable?: boolean;
  onRemove?: (item: IncomingItem) => void;
}) {
  const media = items.filter(
    (i) =>
      i.kind === 'image' ||
      i.kind === 'video' ||
      i.kind === 'audio' ||
      i.kind === 'genImage' ||
      i.kind === 'genVideo' ||
      (i.origin !== 'edge' && i.missing),
  );
  if (!media.length) return null;
  const shown = media.slice(0, max);
  const rest = media.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((item) => (
        <div key={item.id} className="group relative">
          <AssetThumb item={item} size="sm" />
          {removable && item.origin === 'edge' && onRemove && (
            <button
              type="button"
              title="Gỡ attachment"
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-90 shadow hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item);
              }}
            >
              <span className="text-[9px] leading-none">×</span>
            </button>
          )}
          <div
            className="pointer-events-none absolute -bottom-4 left-0 hidden max-w-[120px] truncate text-[9px] text-muted-foreground group-hover:block"
            title={item.flowMediaId ? `${item.title} · ${item.flowMediaId}` : item.title}
          >
            {item.flowMediaId ? `${item.title} · ${item.flowMediaId.slice(0, 8)}` : item.title}
          </div>
        </div>
      ))}
      {rest > 0 && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  );
}

/** Full detail list for inspector */
export function IncomingInputsDetail({ items }: { items: IncomingItem[] }) {
  if (!items.length) {
    return <div className="text-[11px] text-muted-foreground">Chưa có input / reference</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex gap-2 rounded border border-border/70 bg-muted/30 p-1.5',
            item.missing && item.origin !== 'label' && 'border-destructive/40',
            item.missing && item.origin === 'label' && 'border-amber-500/30',
          )}
        >
          <AssetThumb item={item} size="md" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[11px] font-medium">{item.title}</span>
              <span className="rounded bg-background px-1 text-[9px] uppercase text-muted-foreground">
                {item.origin === 'edge' ? item.portType : item.origin === 'prompt' ? 'qua prompt' : 'label'}
              </span>
            </div>
            {item.subtitle && (
              <div
                className="truncate font-mono text-[10px] text-amber-300/90"
                title={item.flowMediaId ?? item.subtitle}
              >
                {item.subtitle}
              </div>
            )}
            {item.flowMediaId && (
              <div className="truncate font-mono text-[9px] text-muted-foreground" title={item.flowMediaId}>
                mediaId · {item.flowMediaId}
              </div>
            )}
            {item.text && (
              <div className="line-clamp-4 whitespace-pre-wrap text-[10px] leading-snug text-foreground/85">
                {item.text}
              </div>
            )}
            {item.missing && (
              <div className="text-[10px] text-muted-foreground">
                {item.origin === 'label' ? 'Label chưa có asset nối vào' : 'Chưa chọn asset'}
              </div>
            )}
            {item.targetHandle && (
              <div className="text-[9px] text-muted-foreground">→ {item.targetHandle}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
