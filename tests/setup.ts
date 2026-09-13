import 'fake-indexeddb/auto';
import { beforeAll } from 'vitest';

beforeAll(() => {
  // jsdom File may lack Blob text/arrayBuffer helpers
  if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
    Blob.prototype.text = async function text() {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
  if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = async function arrayBuffer() {
      return await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }

  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage: () => Promise.resolve({ ok: true }),
      connect: () => ({
        onMessage: { addListener: () => undefined },
        disconnect: () => undefined,
        postMessage: () => undefined,
      }),
      getManifest: () => ({ version: '0.1.0' }),
      getURL: (p: string) => `chrome-extension://test/${p}`,
      onMessage: { addListener: () => undefined },
      onConnect: { addListener: () => undefined },
      onInstalled: { addListener: () => undefined },
      onStartup: { addListener: () => undefined },
    },
    storage: { local: { get: async () => ({}), set: async () => undefined } },
    downloads: { download: async () => 1 },
    notifications: { create: () => undefined },
    tabs: {
      create: async () => ({ id: 1 }),
      get: async () => ({ id: 1, status: 'complete' }),
      sendMessage: async () => ({}),
      onUpdated: { addListener: () => undefined, removeListener: () => undefined },
      onRemoved: { addListener: () => undefined },
    },
    windows: {
      create: async () => ({ id: 1 }),
      update: async () => ({}),
      onRemoved: { addListener: () => undefined, removeListener: () => undefined },
    },
    sidePanel: { setPanelBehavior: async () => undefined },
    alarms: { create: () => undefined, onAlarm: { addListener: () => undefined } },
  };
});
