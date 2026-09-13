import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { strings } from '@/shared/strings';
import { sendToSw, type FlowMediaItem } from '@/shared/messaging';
import { cn } from '@/shared/utils';

/** A Flow asset is kept by reference only — nothing is downloaded or re-uploaded. */
export interface FlowAssetPickResult {
  mediaId: string;
  kind: 'image' | 'video';
  /** Signed url at pick time, for the node preview only. */
  previewUrl: string;
  originalName: string;
}

interface FlowAssetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filter theo kind của asset node; audio → any (Flow ít có audio) */
  kind?: 'image' | 'video' | 'audio' | 'any';
  onPicked: (result: FlowAssetPickResult) => void;
}

export function FlowAssetPicker({ open, onOpenChange, kind = 'any', onPicked }: FlowAssetPickerProps) {
  const listKind = kind === 'audio' ? 'any' : kind;
  const [items, setItems] = useState<FlowMediaItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openingLogin, setOpeningLogin] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const auth = await sendToSw<{ authenticated: boolean; error?: string }>({
        type: 'provider.checkAuth',
        provider: 'flow',
      });
      if (!auth.ok) {
        setAuthenticated(false);
        setItems([]);
        setError(auth.error || strings.flowPickerConnError);
        return;
      }
      const okAuth = !!auth.data?.authenticated;
      setAuthenticated(okAuth);
      if (!okAuth) {
        setItems([]);
        setError(auth.data?.error || strings.flowPickerAuth);
        return;
      }
      const res = await sendToSw<{ items: FlowMediaItem[] }>({
        type: 'provider.listFlowMedia',
        kind: listKind === 'any' ? 'any' : listKind,
      });
      if (!res.ok) {
        setItems([]);
        // Phân biệt lỗi auth vs không có media / connection
        const msg = res.error || strings.error;
        if (/đăng nhập|AUTH_REQUIRED|auth/i.test(msg)) {
          setAuthenticated(false);
          setError(msg);
        } else if (/content script|TAB_LOST|kết nối|Receiving end/i.test(msg)) {
          setError(strings.flowPickerConnError);
        } else {
          setError(msg);
        }
        return;
      }
      setItems(res.data?.items ?? []);
      if (!(res.data?.items?.length)) {
        setError(null);
      }
    } catch (e) {
      setItems([]);
      setAuthenticated(false);
      setError(e instanceof Error ? e.message : strings.error);
    } finally {
      setLoading(false);
    }
  }, [listKind]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const openLogin = async () => {
    setOpeningLogin(true);
    setError(null);
    try {
      const res = await sendToSw({ type: 'provider.openLogin', provider: 'flow' });
      if (!res.ok) {
        setError(res.error || strings.error);
        return;
      }
      setError(strings.flowPickerLoginHint);
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.error);
    } finally {
      setOpeningLogin(false);
    }
  };

  const confirm = () => {
    const item = items.find((i) => i.id === selected);
    if (!item?.mediaId) return;
    onPicked({
      mediaId: item.mediaId,
      kind: item.kind,
      previewUrl: item.thumbUrl || item.url,
      originalName: item.label || `flow-${item.kind}-${item.mediaId.slice(0, 8)}`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,520px)]">
        <DialogHeader>
          <DialogTitle>{strings.flowPickerTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{strings.flowPickerHint}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading || openingLogin}
          >
            {loading ? strings.flowPickerLoading : strings.flowPickerRefresh}
          </Button>
          {authenticated === false && (
            <Button
              type="button"
              size="sm"
              onClick={() => void openLogin()}
              disabled={openingLogin || loading}
            >
              {openingLogin ? strings.flowPickerOpeningLogin : strings.flowPickerLogin}
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="max-h-[360px] overflow-y-auto rounded border border-border">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">{strings.flowPickerLoading}</div>
          ) : authenticated === false ? (
            <div className="space-y-3 p-6 text-center">
              <p className="text-xs text-muted-foreground">{strings.flowPickerAuth}</p>
              <Button
                type="button"
                size="sm"
                onClick={() => void openLogin()}
                disabled={openingLogin}
              >
                {openingLogin ? strings.flowPickerOpeningLogin : strings.flowPickerLogin}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">{strings.flowPickerEmpty}</div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.mediaId}
                  title={item.mediaId ? item.mediaId : strings.flowPickerNoMediaId}
                  className={cn(
                    'overflow-hidden rounded border bg-muted text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    selected === item.id
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border hover:border-primary/60',
                  )}
                  onClick={() => setSelected(item.id)}
                >
                  {item.kind === 'video' ? (
                    <video
                      src={item.thumbUrl || item.url}
                      className="aspect-square w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={item.thumbUrl || item.url}
                      alt={item.label ?? ''}
                      className="aspect-square w-full object-cover"
                    />
                  )}
                  <div className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                    {item.kind === 'video' ? 'Video' : 'Ảnh'}
                    {item.mediaId ? ` · ${item.mediaId.slice(0, 8)}` : ` · ${strings.flowPickerNoMediaId}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {strings.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selected || loading || authenticated === false}
            onClick={confirm}
          >
            {strings.flowPickerSelect}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
