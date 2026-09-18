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

interface SignedFlowMedia {
  mediaId: string;
  kind: 'image' | 'video' | null;
  url: string | null;
  thumbUrl?: string | null;
}

type PickerItem = FlowMediaItem & { signFailed?: boolean };

interface FlowAssetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filter theo kind của asset node; audio → any (Flow ít có audio) */
  kind?: 'image' | 'video' | 'audio' | 'any';
  onPicked: (result: FlowAssetPickResult) => void;
}

type PageCache = Record<number, PickerItem[]>;
/** `nextTokens[i]` = token to fetch page `i + 1` after page `i` loaded. */
type NextTokens = Record<number, string | null>;
type PickerTab = 'favorites' | 'all';
type TabView = { page: number; selected: string | null };

const DEFAULT_TAB: PickerTab = 'favorites';
const EMPTY_TAB_VIEWS: Record<PickerTab, TabView> = {
  favorites: { page: 0, selected: null },
  all: { page: 0, selected: null },
};

/** How many media ids to sign per SW round-trip (only viewport tiles enqueue). */
const SIGN_BATCH = 6;

export function FlowAssetPicker({ open, onOpenChange, kind = 'any', onPicked }: FlowAssetPickerProps) {
  const listKind = kind === 'audio' ? 'any' : kind;
  const [pages, setPages] = useState<PageCache>({});
  const [nextTokens, setNextTokens] = useState<NextTokens>({});
  const pagesRef = useRef<PageCache>({});
  const nextTokensRef = useRef<NextTokens>({});
  const [tab, setTab] = useState<PickerTab>(DEFAULT_TAB);
  const tabViewsRef = useRef<Record<PickerTab, TabView>>({ ...EMPTY_TAB_VIEWS });
  const [page, setPage] = useState(0);
  const [signing, setSigning] = useState(false);
  /** Ids already sent for signing — never re-requested, so a failing id can't loop. */
  const signRequested = useRef(new Set<string>());
  const signQueue = useRef<string[]>([]);
  const signBusy = useRef(false);
  /** Media ids waiting for / in a sign round-trip — drives per-tile spinner. */
  const [signingIds, setSigningIds] = useState<Set<string>>(() => new Set());
  const prefetching = useRef(false);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [openingLogin, setOpeningLogin] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetCache = useCallback(() => {
    pagesRef.current = {};
    nextTokensRef.current = {};
    tabViewsRef.current = { ...EMPTY_TAB_VIEWS };
    setPages({});
    setNextTokens({});
    setTab(DEFAULT_TAB);
    setPage(0);
    setSelected(null);
    signRequested.current = new Set();
    signQueue.current = [];
    signBusy.current = false;
    prefetching.current = false;
    setSigning(false);
    setSigningIds(new Set());
  }, []);

  const switchTab = useCallback(
    (next: PickerTab) => {
      if (next === tab) return;
      tabViewsRef.current[tab] = { page, selected };
      const cached = tabViewsRef.current[next];
      setTab(next);
      setPage(cached.page);
      setSelected(cached.selected);
    },
    [tab, page, selected],
  );
  const fetchPage = useCallback(
    async (pageIndex: number, pageToken: string | null): Promise<{ ok: boolean; error?: string }> => {
      const res = await sendToSw<{ items: FlowMediaItem[]; nextPageToken: string | null }>({
        type: 'provider.listFlowMedia',
        kind: listKind === 'any' ? 'any' : listKind,
        pageToken,
      });
      if (!res.ok) {
        return { ok: false, error: res.error || strings.error };
      }
      const items = res.data?.items ?? [];
      const nextPageToken = res.data?.nextPageToken ?? null;
      pagesRef.current = { ...pagesRef.current, [pageIndex]: items };
      nextTokensRef.current = { ...nextTokensRef.current, [pageIndex]: nextPageToken };
      setPages(pagesRef.current);
      setNextTokens(nextTokensRef.current);
      return { ok: true };
    },
    [listKind],
  );

  /**
   * Lỗi kết nối tab luôn hiện hướng dẫn tiếng Việt — không để lọt chuỗi gốc của
   * Chrome ("Could not establish connection…") ra dialog.
   */
  const interpretError = (msg: string) => {
    if (/content script|TAB_LOST|kết nối|Receiving end|establish connection/i.test(msg)) {
      setError(strings.flowPickerConnError);
    } else if (/đăng nhập|AUTH_REQUIRED|auth/i.test(msg)) {
      setAuthenticated(false);
      setError(msg);
    } else {
      setError(msg);
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    resetCache();
    try {
      const auth = await sendToSw<{ authenticated: boolean; error?: string }>({
        type: 'provider.checkAuth',
        provider: 'flow',
      });
      if (!auth.ok) {
        setAuthenticated(false);
        interpretError(auth.error || strings.flowPickerConnError);
        return;
      }
      const okAuth = !!auth.data?.authenticated;
      setAuthenticated(okAuth);
      if (!okAuth) {
        interpretError(auth.data?.error || strings.flowPickerAuth);
        return;
      }
      const listed = await fetchPage(0, null);
      if (!listed.ok) {
        interpretError(listed.error || strings.error);
      }
    } catch (e) {
      // sendToSw reject = service worker chưa sẵn sàng (hay gặp sau khi cập
      // nhật extension), cùng loại lỗi kết nối với tab mất content script.
      setAuthenticated(false);
      interpretError(e instanceof Error ? e.message : strings.error);
    } finally {
      setLoading(false);
    }
  }, [fetchPage, resetCache]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const loadedPageCount = useMemo(() => {
    let n = 0;
    while (pages[n]) n++;
    return n;
  }, [pages]);

  const lastLoaded = loadedPageCount - 1;
  const hasMore = lastLoaded >= 0 && nextTokens[lastLoaded] != null && nextTokens[lastLoaded] !== '';
  /** Pages we can show as number buttons: loaded + one more if Flow still has a token. */
  const pageButtonCount = Math.max(loadedPageCount > 0 ? loadedPageCount : 1, loadedPageCount + (hasMore ? 1 : 0));
  const currentPage = Math.min(page, Math.max(0, pageButtonCount - 1));

  const matchesKind = useCallback(
    (i: PickerItem) => listKind === 'any' || i.kindKnown === false || i.kind === listKind,
    [listKind],
  );

  /** Favourites from every loaded listing page (Flow stars via `Zzl0ze` flag). */
  const favouriteItems = useMemo(() => {
    const out: PickerItem[] = [];
    for (let p = 0; p < loadedPageCount; p++) {
      for (const item of pages[p] ?? []) {
        if (item.isFavourite && matchesKind(item)) out.push(item);
      }
    }
    return out;
  }, [pages, loadedPageCount, matchesKind]);

  const pageItems = useMemo(() => {
    if (tab === 'favorites') return favouriteItems;
    return (pages[currentPage] ?? []).filter(matchesKind);
  }, [tab, favouriteItems, pages, currentPage, matchesKind]);
  const patchSignedItems = useCallback((ids: string[], signed: Map<string, SignedFlowMedia>) => {
    const next: PageCache = { ...pagesRef.current };
    for (const [idx, list] of Object.entries(next)) {
      next[Number(idx)] = list.map((item) => {
        if (!item.mediaId || !ids.includes(item.mediaId)) return item;
        const m = signed.get(item.mediaId);
        if (!m?.url) return { ...item, signFailed: true };
        return {
          ...item,
          url: m.url,
          thumbUrl: m.thumbUrl || m.url,
          kind: m.kind ?? item.kind,
          kindKnown: true,
          signFailed: false,
        };
      });
    }
    pagesRef.current = next;
    setPages(next);
  }, []);

  const drainSignQueue = useCallback(async () => {
    if (signBusy.current) return;
    signBusy.current = true;
    setSigning(true);
    try {
      while (signQueue.current.length) {
        const batch = signQueue.current.splice(0, SIGN_BATCH);
        const ids = batch.filter((id) => {
          if (signRequested.current.has(id)) return false;
          const item = Object.values(pagesRef.current)
            .flat()
            .find((i) => i.mediaId === id);
          return !!item && !item.url && !item.signFailed;
        });
        for (const id of ids) signRequested.current.add(id);
        if (!ids.length) {
          setSigningIds((prev) => {
            const next = new Set(prev);
            for (const id of batch) next.delete(id);
            return next;
          });
          continue;
        }
        const res = await sendToSw<{ items: SignedFlowMedia[] }>({
          type: 'provider.signFlowMedia',
          mediaIds: ids,
        });
        const signed = new Map((res.ok ? res.data?.items ?? [] : []).map((m) => [m.mediaId, m]));
        patchSignedItems(ids, signed);
        setSigningIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
      }
    } finally {
      signBusy.current = false;
      setSigning(signQueue.current.length > 0);
      if (signQueue.current.length) void drainSignQueue();
    }
  }, [patchSignedItems]);

  /** Enqueue sign only when a tile enters the scroll viewport. */
  const enqueueVisibleSign = useCallback(
    (mediaId: string) => {
      if (!mediaId || signRequested.current.has(mediaId)) return;
      if (signQueue.current.includes(mediaId)) return;
      const item = Object.values(pagesRef.current)
        .flat()
        .find((i) => i.mediaId === mediaId);
      if (!item || item.url || item.signFailed) return;
      signQueue.current.push(mediaId);
      setSigningIds((prev) => {
        if (prev.has(mediaId)) return prev;
        const next = new Set(prev);
        next.add(mediaId);
        return next;
      });
      void drainSignQueue();
    },
    [drainSignQueue],
  );

  // Prefetch the next RPC page (ids only — previews still wait for viewport).
  // Favourites tab keeps prefetching so starred items on later pages accumulate.
  useEffect(() => {
    if (!open || loading || loadingPage || prefetching.current) return;
    const prefetchFrom = tab === 'favorites' ? lastLoaded : currentPage;
    const token = nextTokens[prefetchFrom];
    if (!token || pages[prefetchFrom + 1]) return;
    prefetching.current = true;
    void fetchPage(prefetchFrom + 1, token)
      .catch(() => undefined)
      .finally(() => {
        prefetching.current = false;
      });
  }, [open, loading, loadingPage, tab, currentPage, lastLoaded, nextTokens, pages, fetchPage]);

  // Drop queued signs when flipping pages / tabs — only the new viewport should load.
  useEffect(() => {
    signQueue.current = [];
    setSigningIds(new Set());
    setSigning(false);
  }, [currentPage, tab]);

  // Bind IntersectionObserver root to the grid scroller once mounted.
  useEffect(() => {
    setScrollRoot(gridScrollRef.current);
  }, [open, loading, loadingPage, pageItems.length, currentPage, tab]);
  const ensurePage = useCallback(
    async (target: number) => {
      if (pagesRef.current[target]) {
        setPage(target);
        return;
      }
      setLoadingPage(true);
      setError(null);
      try {
        if (!pagesRef.current[0]) {
          const first = await fetchPage(0, null);
          if (!first.ok) {
            interpretError(first.error || strings.error);
            return;
          }
        }
        while (!pagesRef.current[target]) {
          const before = Object.keys(pagesRef.current)
            .map(Number)
            .filter((p) => p < target)
            .sort((a, b) => b - a)[0];
          if (before == null) {
            setError(strings.flowPickerConnError);
            return;
          }
          const token = nextTokensRef.current[before];
          if (!token) {
            setError(strings.flowPickerEmpty);
            return;
          }
          if (pagesRef.current[before + 1]) continue;
          const listed = await fetchPage(before + 1, token);
          if (!listed.ok) {
            interpretError(listed.error || strings.error);
            return;
          }
        }
        setPage(target);
      } catch (e) {
        setError(e instanceof Error ? e.message : strings.error);
      } finally {
        setLoadingPage(false);
      }
    },
    [fetchPage],
  );

  const goToPage = useCallback(
    (target: number) => {
      if (target < 0 || target >= pageButtonCount) return;
      void ensurePage(target);
    },
    [ensurePage, pageButtonCount],
  );

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
    const item =
      pageItems.find((i) => i.id === selected) ??
      Object.values(pagesRef.current)
        .flat()
        .find((i) => i.id === selected);
    if (!item?.mediaId) return;
    onPicked({
      mediaId: item.mediaId,
      kind: item.kind,
      previewUrl: item.thumbUrl || item.url,
      originalName: item.label || `flow-${item.kind}-${item.mediaId.slice(0, 8)}`,
    });
    onOpenChange(false);
  };

  const busy = loading || loadingPage;
  const showPager =
    tab === 'all' && !loading && authenticated !== false && (loadedPageCount > 1 || hasMore);
  const pageNumbers = useMemo(() => buildPageNumbers(currentPage, pageButtonCount), [currentPage, pageButtonCount]);
  const emptyLabel = tab === 'favorites' ? strings.flowPickerEmptyFavorites : strings.flowPickerEmpty;
  const statusCount =
    tab === 'favorites'
      ? strings.flowPickerPageCount(pageItems.length)
      : `${strings.flowPickerPageOf(currentPage + 1, Math.max(pageButtonCount, currentPage + 1))} · ${strings.flowPickerPageCount(pageItems.length)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,880px)] max-w-none">
        <DialogHeader>
          <DialogTitle>{strings.flowPickerTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{strings.flowPickerHint}</p>

        <div className="flex flex-wrap items-center gap-1 rounded-md border border-border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={tab === 'favorites' ? 'default' : 'ghost'}
            className="flex-1 sm:flex-none"
            onClick={() => switchTab('favorites')}
            disabled={openingLogin}
          >
            {strings.flowPickerTabFavorites}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === 'all' ? 'default' : 'ghost'}
            className="flex-1 sm:flex-none"
            onClick={() => switchTab('all')}
            disabled={openingLogin}
          >
            {strings.flowPickerTabAll}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={busy || openingLogin}
          >
            {loading ? strings.flowPickerLoading : strings.flowPickerRefresh}
          </Button>
          {authenticated === false && (
            <Button type="button" size="sm" onClick={() => void openLogin()} disabled={openingLogin || busy}>
              {openingLogin ? strings.flowPickerOpeningLogin : strings.flowPickerLogin}
            </Button>
          )}
          {!busy && pageItems.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {statusCount}
              {signing ? ` · ${strings.flowPickerSigning}` : ''}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div
          ref={gridScrollRef}
          className="max-h-[min(60vh,560px)] overflow-y-auto rounded border border-border"
        >
          {loading ||
          (tab === 'all' && loadingPage && !pages[currentPage]) ||
          (tab === 'favorites' && loadingPage && loadedPageCount === 0) ||
          (tab === 'favorites' && pageItems.length === 0 && hasMore && !error) ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {loadingPage || (tab === 'favorites' && hasMore)
                ? strings.flowPickerLoadingPage
                : strings.flowPickerLoading}
            </div>
          ) : authenticated === false ? (
            <div className="space-y-3 p-6 text-center">
              <p className="text-xs text-muted-foreground">{strings.flowPickerAuth}</p>
              <Button type="button" size="sm" onClick={() => void openLogin()} disabled={openingLogin}>
                {openingLogin ? strings.flowPickerOpeningLogin : strings.flowPickerLogin}
              </Button>
            </div>
          ) : pageItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">{emptyLabel}</div>
          ) : (
            <PickerGrid
              key={tab}
              items={pageItems}
              listKind={listKind}
              selected={selected}
              signingIds={signingIds}
              scrollRoot={scrollRoot}
              onVisible={enqueueVisibleSign}
              onSelect={setSelected}
            />
          )}
        </div>

        {showPager && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {strings.flowPickerPageOf(currentPage + 1, pageButtonCount)}
              {loadingPage ? ` · ${strings.flowPickerLoadingPage}` : ''}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage === 0 || busy}
                onClick={() => goToPage(0)}
              >
                «
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage === 0 || busy}
                onClick={() => goToPage(currentPage - 1)}
              >
                {strings.flowPickerPrev}
              </Button>
              {pageNumbers.map((n, idx) =>
                n === '…' ? (
                  <span key={`e-${idx}`} className="px-1">
                    …
                  </span>
                ) : (
                  <Button
                    key={n}
                    type="button"
                    variant={n - 1 === currentPage ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-8 px-2"
                    disabled={busy}
                    onClick={() => goToPage(n - 1)}
                  >
                    {n}
                  </Button>
                ),
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= pageButtonCount - 1 || busy}
                onClick={() => goToPage(currentPage + 1)}
              >
                {strings.flowPickerNext}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= pageButtonCount - 1 || busy}
                onClick={() => goToPage(pageButtonCount - 1)}
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
            disabled={!selected || busy || authenticated === false}
            onClick={confirm}
          >
            {strings.flowPickerSelect}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Page numbers with ellipsis when many pages (1-based labels). */
function buildPageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>(
    [1, total, current, current + 1, current + 2].filter((n) => n >= 1 && n <= total),
  );
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push('…');
    out.push(n);
  }
  return out;
}

function PickerGrid({
  items,
  listKind,
  selected,
  signingIds,
  scrollRoot,
  onVisible,
  onSelect,
}: {
  items: PickerItem[];
  listKind: 'image' | 'video' | 'any';
  selected: string | null;
  signingIds: Set<string>;
  scrollRoot: HTMLElement | null;
  onVisible: (mediaId: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 p-2 sm:grid-cols-4 md:grid-cols-5">
      {items.map((item) => {
        const kindPending = listKind !== 'any' && item.kindKnown === false;
        const kindLabel =
          item.kindKnown === false
            ? strings.flowPickerKindPending
            : item.kind === 'video'
              ? strings.kindVideo
              : strings.kindImage;
        const awaitingSign = !!item.mediaId && signingIds.has(item.mediaId);
        return (
          <PickerTile
            key={item.id}
            item={item}
            selected={selected === item.id}
            disabled={!item.mediaId || kindPending}
            kindLabel={kindLabel}
            awaitingSign={awaitingSign}
            scrollRoot={scrollRoot}
            onVisible={onVisible}
            onSelect={() => onSelect(item.id)}
          />
        );
      })}
    </div>
  );
}

function PickerTile({
  item,
  selected,
  disabled,
  kindLabel,
  awaitingSign,
  scrollRoot,
  onVisible,
  onSelect,
}: {
  item: PickerItem;
  selected: boolean;
  disabled: boolean;
  kindLabel: string;
  awaitingSign: boolean;
  scrollRoot: HTMLElement | null;
  onVisible: (mediaId: string) => void;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !item.mediaId || item.url || item.signFailed) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onVisible(item.mediaId!);
      },
      { root: scrollRoot, rootMargin: '120px 0px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot, item.mediaId, item.url, item.signFailed, onVisible]);

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      title={item.mediaId ? item.mediaId : strings.flowPickerNoMediaId}
      className={cn(
        'overflow-hidden rounded border bg-muted text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/60',
      )}
      onClick={onSelect}
    >
      <FlowThumb item={item} awaitingSign={awaitingSign} />
      <div className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">
        {kindLabel}
        {item.mediaId ? ` · ${item.mediaId.slice(0, 8)}` : ` · ${strings.flowPickerNoMediaId}`}
      </div>
    </button>
  );
}

/** Square thumbnail; prefer poster/image thumb for video tiles. */
function FlowThumb({ item, awaitingSign }: { item: PickerItem; awaitingSign: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = item.thumbUrl || item.url;
  const posterThumb = !!item.thumbUrl && /\/image\//i.test(item.thumbUrl);
  const showAsImage = item.kind !== 'video' || posterThumb;
  return (
    <div className="flex aspect-square w-full items-center justify-center bg-muted">
      {!src && awaitingSign ? (
        <span className="animate-pulse text-[10px] text-muted-foreground">{strings.flowPickerSigning}</span>
      ) : !src && item.signFailed ? (
        <span className="text-[10px] text-muted-foreground">{strings.flowPickerNoPreview}</span>
      ) : !src ? (
        <span className="text-[10px] text-muted-foreground/50">{strings.flowPickerKindPending}</span>
      ) : failed ? (
        <span className="text-[10px] text-muted-foreground">{strings.flowPickerNoPreview}</span>
      ) : showAsImage ? (
        <img
          src={src}
          alt={item.label ?? ''}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <video
          src={src}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
