import { TabPool, ProviderRouter } from '@/providers/TabPool';
import { RunManager } from '@/engine/RunManager';
import { bootstrapStorage, getSettings, setSettings } from '@/storage/repos/settingsRepo';
import type { UiToSwMessage, SwToUiEvent, MessageResponse } from '@/shared/messaging';
import { isUiToSwMessage } from '@/shared/messaging';
import { clearLogs, createLogger, getLogs, subscribeLogs } from '@/shared/log';

const ports = new Set<chrome.runtime.Port>();

function broadcast(ev: SwToUiEvent) {
  for (const p of ports) {
    try {
      p.postMessage(ev);
    } catch {
      ports.delete(p);
    }
  }
}

const log = createLogger('sw');
subscribeLogs((entry) => broadcast({ type: 'log', entry }));

self.addEventListener('error', (e) => {
  log.error(`Uncaught: ${(e as ErrorEvent).message}`, (e as ErrorEvent).error);
});
self.addEventListener('unhandledrejection', (e) => {
  const reason = (e as PromiseRejectionEvent).reason;
  log.error(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`, reason);
});

const pool = new TabPool();
const router = new ProviderRouter(pool);
const runManager = new RunManager(router, broadcast);

/** Mở side panel khi bấm icon — không phụ thuộc setPanelBehavior (hay mất sau reload) */
async function openSidePanel(tab?: chrome.tabs.Tab) {
  try {
    if (tab?.id != null) {
      await chrome.sidePanel.open({ tabId: tab.id });
      return;
    }
    if (tab?.windowId != null) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      return;
    }
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.windowId != null) {
      await chrome.sidePanel.open({ windowId: active.windowId });
    }
  } catch (err) {
    console.warn('[My X Flows] sidePanel.open failed', err);
  }
}

void chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.warn('[My X Flows] setPanelBehavior failed', err));

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void bootstrapStorage();
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void bootstrapStorage();
  void runManager.recover();
});

void bootstrapStorage();
void runManager.recover();

/** Fallback khi openPanelOnActionClick = false hoặc chưa kịp set */
chrome.action.onClicked.addListener((tab) => {
  void openSidePanel(tab);
});

chrome.alarms.create('heartbeat', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'heartbeat') {
    // keep SW alive lightly while queue non-empty
    const q = runManager.getQueueCounts();
    if (q.running + q.waiting > 0) broadcast({ type: 'queue.update', ...q });
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'run-events') {
    ports.add(port);
    port.onDisconnect.addListener(() => ports.delete(port));
    const q = runManager.getQueueCounts();
    port.postMessage({ type: 'queue.update', ...q } satisfies SwToUiEvent);
    port.postMessage({ type: 'log.snapshot', entries: getLogs() } satisfies SwToUiEvent);
  }
  if (port.name === 'driver-keepalive') {
    // holding the port keeps SW alive during long generates
    port.onMessage.addListener(() => undefined);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void pool.onTabRemoved(tabId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (!isUiToSwMessage(message)) {
        // may be content→sw driver messages — ignore here for UI handler
        sendResponse({ ok: true });
        return;
      }
      const res = await handleUiMessage(message);
      sendResponse(res);
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) } satisfies MessageResponse);
    }
  })();
  return true;
});

async function handleUiMessage(message: UiToSwMessage): Promise<MessageResponse> {
  switch (message.type) {
    case 'ping':
      return { ok: true, data: { pong: true } };
    case 'workflow.run': {
      const runId = await runManager.runWorkflow(message.workflowId, {
        mode: message.mode ?? (message.fromNodeId ? 'from' : 'full'),
        fromNodeId: message.fromNodeId,
      });
      return { ok: true, data: { runId } };
    }
    case 'node.runFrom': {
      const runId = await runManager.runWorkflow(message.workflowId, {
        mode: 'from',
        fromNodeId: message.nodeId,
      });
      return { ok: true, data: { runId } };
    }
    case 'run.cancel':
      runManager.cancel(message.runId);
      return { ok: true, data: {} };
    case 'workflow.cancel':
      runManager.cancelByWorkflow(message.workflowId);
      return { ok: true, data: {} };
    case 'runAll': {
      const ids = await runManager.runAll(message.workspaceId);
      return { ok: true, data: { runIds: ids } };
    }
    case 'provider.checkAuth': {
      const result = await router.checkAuth(message.provider);
      return { ok: true, data: result };
    }
    case 'provider.diagnose': {
      const health = await router.diagnose(message.provider);
      return { ok: true, data: health };
    }
    case 'provider.capabilities': {
      const caps = await router.capabilities(message.provider);
      return { ok: true, data: caps };
    }
    case 'provider.listFlowMedia': {
      try {
        const data = await router.listFlowMedia(message.kind ?? 'any');
        return { ok: true, data };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    case 'provider.signFlowMedia': {
      try {
        const data = await router.signFlowMedia(message.mediaIds);
        return { ok: true, data };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
    case 'provider.fetchFlowMedia': {
      try {
        const result = await router.execute(
          'flow',
          { name: 'fetchMedia', payload: { url: message.url } },
          new AbortController().signal,
          () => undefined,
        );
        const media = result.medias?.[0];
        if (!media?.dataBase64) {
          return { ok: false, error: 'Không lấy được dữ liệu media từ Flow' };
        }
        return { ok: true, data: media };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    case 'provider.openLogin': {
      await router.openLogin(message.provider);
      return { ok: true, data: {} };
    }
    case 'log.clear':
      clearLogs();
      return { ok: true, data: {} };
    case 'settings.get':
      return { ok: true, data: await getSettings() };
    case 'settings.set':
      return { ok: true, data: await setSettings(message.settings) };
    default:
      return { ok: false, error: 'Unknown message' };
  }
}

// Track open editor windows per workflow
const editorWindows = new Map<string, number>();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'editor.open') {
    const workflowId = message.workflowId as string;
    const existing = editorWindows.get(workflowId);
    if (existing != null) {
      chrome.windows.update(existing, { focused: true }).then(
        () => sendResponse({ ok: true }),
        () => {
          editorWindows.delete(workflowId);
          void openEditor(workflowId).then((id) => {
            editorWindows.set(workflowId, id);
            sendResponse({ ok: true });
          });
        },
      );
      return true;
    }
    void openEditor(workflowId).then((id) => {
      editorWindows.set(workflowId, id);
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});

async function openEditor(workflowId: string): Promise<number> {
  const url = chrome.runtime.getURL(`src/pages/editor/index.html?id=${workflowId}`);
  const win = await chrome.windows.create({
    url,
    type: 'popup',
    width: 1280,
    height: 800,
  });
  const windowId = win.id!;
  const onRemoved = (id: number) => {
    if (id === windowId) {
      editorWindows.delete(workflowId);
      chrome.windows.onRemoved.removeListener(onRemoved);
    }
  };
  chrome.windows.onRemoved.addListener(onRemoved);
  return windowId;
}

log.info('Service worker ready');
