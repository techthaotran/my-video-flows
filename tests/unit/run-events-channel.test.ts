import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectRunEvents } from '@/shared/messaging';
import type { SwToUiEvent } from '@/shared/messaging';

interface FakePort {
  name: string;
  postMessage: (msg: unknown) => void;
  disconnect: () => void;
  onMessage: { addListener: (fn: (m: unknown) => void) => void };
  onDisconnect: { addListener: (fn: () => void) => void };
  /** Giả lập service worker tắt: Chrome bắn onDisconnect. */
  kill: () => void;
  emit: (ev: SwToUiEvent) => void;
  disconnected: boolean;
}

const ports: FakePort[] = [];
let connectFails = 0;

function makePort(): FakePort {
  const messageListeners: ((m: unknown) => void)[] = [];
  const disconnectListeners: (() => void)[] = [];
  const port: FakePort = {
    name: 'run-events',
    postMessage: () => undefined,
    disconnect: () => {
      port.disconnected = true;
    },
    onMessage: { addListener: (fn) => messageListeners.push(fn) },
    onDisconnect: { addListener: (fn) => disconnectListeners.push(fn) },
    kill: () => {
      port.disconnected = true;
      disconnectListeners.forEach((fn) => fn());
    },
    emit: (ev) => messageListeners.forEach((fn) => fn(ev)),
    disconnected: false,
  };
  return port;
}

beforeEach(() => {
  vi.useFakeTimers();
  ports.length = 0;
  connectFails = 0;
  const chrome = globalThis.chrome as unknown as Record<string, Record<string, unknown>>;
  chrome.runtime.connect = () => {
    if (connectFails > 0) {
      connectFails--;
      throw new Error('Extension context invalidated.');
    }
    const port = makePort();
    ports.push(port);
    return port;
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('kênh run-events', () => {
  it('nối ngay khi tạo và chuyển tiếp sự kiện', () => {
    const seen: SwToUiEvent[] = [];
    const channel = connectRunEvents((ev) => seen.push(ev));
    expect(ports).toHaveLength(1);
    expect(channel.connected).toBe(true);

    ports[0]!.emit({ type: 'queue.update', running: 1, waiting: 0 });
    expect(seen).toEqual([{ type: 'queue.update', running: 1, waiting: 0 }]);
    channel.disconnect();
  });

  it('service worker tắt thì tự nối lại, sự kiện lần chạy sau vẫn tới', async () => {
    const seen: SwToUiEvent[] = [];
    const channel = connectRunEvents((ev) => seen.push(ev));

    // Lần chạy 1 xong, service worker rảnh rồi bị Chrome tắt.
    ports[0]!.emit({ type: 'node.status', runId: 'r1', nodeId: 'm', status: 'success' });
    ports[0]!.kill();
    expect(channel.connected).toBe(false);

    await vi.advanceTimersByTimeAsync(300);
    expect(ports).toHaveLength(2);
    expect(channel.connected).toBe(true);

    // Lần chạy 2: đây chính là progress từng không bao giờ hiện lên.
    ports[1]!.emit({ type: 'node.status', runId: 'r2', nodeId: 'm', status: 'running' });
    ports[1]!.emit({ type: 'node.progress', runId: 'r2', nodeId: 'm', progress: 40, message: 'Ghép clip 2/3' });
    expect(seen.map((e) => e.type)).toEqual(['node.status', 'node.status', 'node.progress']);
    channel.disconnect();
  });

  it('nối lại thất bại thì lùi dần rồi vẫn nối được', async () => {
    connectFails = 0;
    const channel = connectRunEvents(() => undefined);
    connectFails = 2;
    ports[0]!.kill();

    await vi.advanceTimersByTimeAsync(250); // lần 1 — ném lỗi
    expect(ports).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500); // lần 2 — ném lỗi
    expect(ports).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000); // lần 3 — thành công
    expect(ports).toHaveLength(2);
    expect(channel.connected).toBe(true);
    channel.disconnect();
  });

  it('disconnect chủ động thì không nối lại nữa', async () => {
    const channel = connectRunEvents(() => undefined);
    channel.disconnect();
    expect(ports[0]!.disconnected).toBe(true);

    ports[0]!.kill();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ports).toHaveLength(1);
    expect(channel.connected).toBe(false);
  });
});
