import { describe, expect, it, beforeEach, vi } from 'vitest';
import { pasteFiles, readAccountEmail } from '@/providers/dom-kit';

describe('readAccountEmail', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('đọc email từ aria-label của nút tài khoản Google', () => {
    document.body.innerHTML =
      '<a aria-label="Google Account: Thao Tran (Thao.Tran@Example.com)"><img alt="avatar"></a>';
    expect(readAccountEmail()).toBe('thao.tran@example.com');
  });

  it('không có email thì trả undefined', () => {
    document.body.innerHTML = '<img alt="Account">';
    expect(readAccountEmail()).toBeUndefined();
  });
});

/** jsdom không có DataTransfer và ClipboardEvent.clipboardData - stub tối thiểu. */
class FakeDataTransfer {
  files: File[] = [];
  items = { add: (f: File) => void this.files.push(f) };
}
class FakeClipboardEvent extends Event {
  clipboardData: FakeDataTransfer;
  constructor(type: string, init: EventInit & { clipboardData: FakeDataTransfer }) {
    super(type, init);
    this.clipboardData = init.clipboardData;
  }
}

describe('pasteFiles', () => {
  beforeEach(() => {
    vi.stubGlobal('DataTransfer', FakeDataTransfer);
    vi.stubGlobal('ClipboardEvent', FakeClipboardEvent);
  });

  it('bắn sự kiện paste mang file vào ô soạn thảo', () => {
    document.body.innerHTML = '<div contenteditable="true" id="input"></div>';
    const input = document.getElementById('input')!;
    let received: string[] = [];
    input.addEventListener('paste', (e) => {
      received = (e as unknown as FakeClipboardEvent).clipboardData.files.map((f) => f.name);
    });
    pasteFiles(input, [new File(['x'], 'model.png', { type: 'image/png' })]);
    expect(received).toEqual(['model.png']);
  });
});
