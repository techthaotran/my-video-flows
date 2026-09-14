import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** Assets per picker page; each unsigned one costs an `as29s` call when its page opens. */
const PAGE_SIZE = 20;

interface SignedFlowMedia {
  mediaId: string;
  kind: 'image' | 'video' | null;
  url: string | null;
}

type PickerItem = FlowMediaItem & { signFailed?: boolean };

interface FlowAssetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filter theo kind của asset node; audio → any (Flow ít có audio) */
  kind?: 'image' | 'video' | 'audio' | 'any';
  onPicked: (result: FlowAssetPickResult) => void;
}

export function FlowAssetPicker({ open, onOpenChange, kind = 'any', onPicked }: FlowAssetPickerProps) {
  const listKind = kind === 'audio' ? 'any' : kind;
  const [items, setItems] = useState<PickerItem[]>([]);
  const [page, setPage] = useState(0);
  const [signing, setSigning] = useState(false);
  /** Ids already sent for signing — never re-requested, so a failing id can't loop. */
  const signRequested = useRef(new Set<string>());
  const signInFlight = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openingLogin, setOpeningLogin] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setPage(0);
    signRequested.current = new Set();
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

  // Items whose kind turned out (on signing) not to match the node are dropped.
  const visible = useMemo(
    () => items.filter((i) => listKind === 'any' || i.kindKnown === false || i.kind === listKind),
    [items, listKind],
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // Sign the urls of the page on screen (listing records carry ids only).
  useEffect(() => {
    if (!open || loading) return;
    const ids = pageItems
      .filter((i) => i.mediaId && !i.url && !signRequested.current.has(i.mediaId))
      .map((i) => i.mediaId!);
    if (!ids.length) return;
    for (const id of ids) signRequested.current.add(id);
    signInFlight.current++;
    setSigning(true);
    void sendToSw<{ items: SignedFlowMedia[] }>({ type: 'provider.signFlowMedia', mediaIds: ids })
      .then((res) => {
        const signed = new Map((res.ok ? res.data?.items ?? [] : []).map((m) => [m.mediaId, m]));
        setItems((prev) =>
          prev.map((item) => {
            if (!item.mediaId || !ids.includes(item.mediaId)) return item;
            const m = signed.get(item.mediaId);
            if (!m?.url) return { ...item, signFailed: true };
            return { ...item, url: m.url, thumbUrl: m.url, kind: m.kind ?? item.kind, kindKnown: true, signFailed: false };
          }),
        );
      })
      .finally(() => {
        signInFlight.current--;
        setSigning(signInFlight.current > 0);
      });
  }, [open, loading, pageItems]);

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
      <DialogContent className="w-[min(94vw,880px)] max-w-none">
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
          {!loading && visible.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {visible.length} asset{signing ? ` · ${strings.flowPickerSigning}` : ''}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="max-h-[min(60vh,560px)] overflow-y-auto rounded border border-border">
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
          ) : visible.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">{strings.flowPickerEmpty}</div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-2 sm:grid-cols-4 md:grid-cols-5">
              {pageItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  // Kind unsettled (preview not signed) — can't tell image from video yet.
                  disabled={!item.mediaId || item.kindKnown === false}
                  title={item.mediaId ? item.mediaId : strings.flowPickerNoMediaId}
                  className={cn(
                    'overflow-hidden rounded border bg-muted text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    selected === item.id
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border hover:border-primary/60',
                  )}
                  onClick={() => setSelected(item.id)}
                >
                  <FlowThumb key={item.url || 'pending'} item={item} />
                  <div className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                    {item.kind === 'video' ? 'Video' : 'Ảnh'}
                    {item.mediaId ? ` · ${item.mediaId.slice(0, 8)}` : ` · ${strings.flowPickerNoMediaId}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!loading && visible.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, visible.length)} / {visible.length}
            </span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(0)}>
                «
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {strings.flowPickerPrev}
              </Button>
              <span className="px-2">
                {strings.flowPickerPage} {currentPage + 1}/{pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                {strings.flowPickerNext}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(pageCount - 1)}
              >
                »
              </Button>
            </div>
          </div>
        )}

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

/** Square thumbnail; a url the CDN refuses shows a neutral tile instead of a broken image. */
function FlowThumb({ item }: { item: PickerItem }) {
  const [failed, setFailed] = useState(false);
  const src = item.thumbUrl || item.url;
  return (
    <div className="flex aspect-square w-full items-center justify-center bg-muted">
      {!src && !item.signFailed ? (
        <span className="animate-pulse text-[10px] text-muted-foreground">{strings.flowPickerSigning}</span>
      ) : failed || !src ? (
        <span className="text-[10px] text-muted-foreground">{strings.flowPickerNoPreview}</span>
      ) : item.kind === 'video' ? (
        <video
          src={src}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          src={src}
          alt={item.label ?? ''}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
