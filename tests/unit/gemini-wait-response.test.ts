import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastModelResponse, waitResponseDone } from '@/providers/gemini/driver';
import { strings } from '@/shared/strings';

function track(p: Promise<void>) {
  const state: { done: boolean; error?: unknown } = { done: false };
  p.then(
    () => {
      state.done = true;
    },
    (e) => {
      state.error = e;
    },
  );
  return state;
}

function addReply(text: string): HTMLElement {
  const reply = document.createElement('model-response');
  const content = document.createElement('message-content');
  content.textContent = text;
  reply.appendChild(content);
  document.body.appendChild(reply);
  return content;
}

describe('gemini waitResponseDone', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    // Account avatar: used to end the wait early via `img[src*="google"]`.
    document.body.innerHTML = '<img alt="Google Account" src="https://lh3.googleusercontent.com/a/avatar">';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('completes when the reply text stays unchanged for ~3s', async () => {
    const progress: string[] = [];
    const state = track(
      waitResponseDone({
        timeoutMs: 60_000,
        signal: new AbortController().signal,
        onProgress: (_p, m) => m && progress.push(m),
      }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const content = addReply('Xin');
    await vi.advanceTimersByTimeAsync(1000);
    content.textContent = 'Xin chào';
    await vi.advanceTimersByTimeAsync(2500);
    expect(state.done).toBe(false);
    await vi.advanceTimersByTimeAsync(700);
    expect(state.done).toBe(true);
    expect(progress[0]).toBe(strings.geminiSent);
    expect(progress).toContain(strings.geminiAnswering(8, 2));
  });

  it('completes when the stop button was seen and then disappears', async () => {
    const state = track(waitResponseDone({ timeoutMs: 60_000, signal: new AbortController().signal }));
    const stop = document.createElement('button');
    stop.setAttribute('aria-label', 'Stop response');
    document.body.appendChild(stop);
    await vi.advanceTimersByTimeAsync(5000);
    expect(state.done).toBe(false);
    stop.remove();
    await vi.advanceTimersByTimeAsync(600);
    expect(state.done).toBe(true);
  });

  it('does not finish while the stop button is visible even if text is stable', async () => {
    const state = track(waitResponseDone({ timeoutMs: 60_000, signal: new AbortController().signal }));
    const stop = document.createElement('button');
    stop.setAttribute('aria-label', 'Stop response');
    document.body.appendChild(stop);
    addReply('đang viết');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(state.done).toBe(false);
    stop.remove();
    await vi.advanceTimersByTimeAsync(600);
    expect(state.done).toBe(true);
  });

  it('avatar image alone no longer ends the wait; times out with TIMEOUT', async () => {
    const state = track(
      waitResponseDone({ timeoutMs: 20_000, signal: new AbortController().signal, noReplyMs: 60_000 }),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    expect(state.done).toBe(false);
    expect(state.error).toBeUndefined();
    await vi.advanceTimersByTimeAsync(10_001);
    expect(state.done).toBe(false);
    expect((state.error as { code?: string }).code).toBe('TIMEOUT');
    expect((state.error as Error).message).toBe(strings.geminiTimeout(20, '', 0));
  });

  it('finishes when a lingering "stop" match never goes away but the reply is stable', async () => {
    const stop = document.createElement('button');
    stop.setAttribute('aria-label', 'Stop dictation');
    document.body.appendChild(stop);
    const state = track(waitResponseDone({ timeoutMs: 180_000, signal: new AbortController().signal }));
    addReply('{"type": "scene"}');
    await vi.advanceTimersByTimeAsync(19_000);
    expect(state.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(state.done).toBe(true);
  });

  it('fails fast when Gemini never starts a reply', async () => {
    const state = track(waitResponseDone({ timeoutMs: 180_000, signal: new AbortController().signal }));
    await vi.advanceTimersByTimeAsync(60_100);
    expect((state.error as Error).message).toBe(strings.geminiNoReply(60));
  });

  it('timeout message names the lingering stop element and received chars', async () => {
    const stop = document.createElement('button');
    stop.setAttribute('aria-label', 'Stop response');
    document.body.appendChild(stop);
    const content = addReply('a');
    const state = track(waitResponseDone({ timeoutMs: 10_000, signal: new AbortController().signal }));
    for (let i = 0; i < 9; i++) {
      content.textContent += 'b';
      await vi.advanceTimersByTimeAsync(1000);
    }
    await vi.advanceTimersByTimeAsync(1_100);
    expect((state.error as Error).message).toBe(strings.geminiTimeout(10, 'Stop response', 10));
  });

  it('ignores the reply that was already on the page before sending', async () => {
    addReply('câu trả lời cũ');
    const baseline = lastModelResponse();
    const state = track(
      waitResponseDone({ timeoutMs: 30_000, signal: new AbortController().signal, baseline }),
    );
    await vi.advanceTimersByTimeAsync(8000);
    expect(state.done).toBe(false);
    addReply('câu trả lời mới');
    await vi.advanceTimersByTimeAsync(3100);
    expect(state.done).toBe(true);
  });

  it('rejects when aborted', async () => {
    const ctrl = new AbortController();
    const state = track(waitResponseDone({ timeoutMs: 30_000, signal: ctrl.signal }));
    ctrl.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.error).toBeInstanceOf(Error);
  });
});

describe('gemini lastModelResponse', () => {
  it('returns the outermost wrapper of the newest reply', () => {
    document.body.innerHTML =
      '<model-response id="a"><message-content>1</message-content></model-response>' +
      '<model-response id="b"><div class="response-container"><message-content>2</message-content></div></model-response>';
    expect(lastModelResponse()?.id).toBe('b');
    document.body.innerHTML = '';
    expect(lastModelResponse()).toBeNull();
  });
});
