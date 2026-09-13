/** Shared DOM automation helpers for provider content scripts */

export type Locator =
  | { role: string; name?: string | RegExp }
  | { ariaLabel: string | RegExp }
  | { testId: string }
  | { text: string | RegExp }
  | { placeholder: string | RegExp }
  | { css: string };

export interface WaitOptions {
  timeout?: number;
  visible?: boolean;
}

export function matchesText(el: Element, pattern: string | RegExp): boolean {
  const t = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
  return typeof pattern === 'string' ? t.includes(pattern) : pattern.test(t);
}

function matchPattern(value: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value);
}

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function roleSelectors(role: string): string[] {
  const sels = [`[role="${role}"]`];
  if (role === 'button') {
    sels.push('button', 'input[type="button"]', 'input[type="submit"]', 'summary');
  } else if (role === 'textbox') {
    sels.push(
      'textarea',
      'input:not([type])',
      'input[type="text"]',
      'input[type="search"]',
      '[contenteditable="true"]',
    );
  } else if (role === 'link') {
    sels.push('a[href]');
  } else if (role === 'img') {
    sels.push('img');
  }
  return sels;
}

export function queryAll(locator: Locator, root: ParentNode = document): Element[] {
  if ('css' in locator) return [...root.querySelectorAll(locator.css)];
  if ('testId' in locator) {
    return [...root.querySelectorAll(`[data-testid="${locator.testId}"]`)];
  }
  if ('placeholder' in locator) {
    return [
      ...root.querySelectorAll('textarea[placeholder], input[placeholder], [data-placeholder]'),
    ].filter((el) => {
      const ph =
        el.getAttribute('placeholder') ??
        el.getAttribute('data-placeholder') ??
        el.getAttribute('aria-placeholder') ??
        '';
      return matchPattern(ph, locator.placeholder);
    });
  }
  if ('ariaLabel' in locator) {
    return [...root.querySelectorAll('[aria-label]')].filter((el) => {
      const label = el.getAttribute('aria-label') ?? '';
      return matchPattern(label, locator.ariaLabel);
    });
  }
  if ('role' in locator) {
    const nodes = new Set<Element>();
    for (const sel of roleSelectors(locator.role)) {
      for (const el of root.querySelectorAll(sel)) nodes.add(el);
    }
    return [...nodes].filter((el) => {
      if (!locator.name) return true;
      const name =
        el.getAttribute('aria-label') ??
        el.getAttribute('title') ??
        (el.textContent ?? '').trim().replace(/\s+/g, ' ');
      return matchPattern(name, locator.name);
    });
  }
  if ('text' in locator) {
    return [...root.querySelectorAll('button, a, [role="button"], [type="submit"]')].filter((el) =>
      matchesText(el, locator.text),
    );
  }
  return [];
}

export function query(locator: Locator, root?: ParentNode): Element | null {
  const all = queryAll(locator, root);
  return all.find(isVisible) ?? all[0] ?? null;
}

export async function waitFor(locator: Locator, opts: WaitOptions = {}): Promise<Element> {
  const timeout = opts.timeout ?? 15000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = query(locator);
    if (el) {
      if (!opts.visible || isVisible(el)) return el;
    }
    await sleep(100 + Math.random() * 50);
  }
  throw Object.assign(new Error(`waitFor timeout: ${JSON.stringify(locator)}`), {
    code: 'SELECTOR_NOT_FOUND',
  });
}

export async function click(el: Element): Promise<void> {
  (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  await sleep(80 + Math.random() * 40);
  const target = el as HTMLElement;
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const) {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, view: window, pointerId: 1 }),
    );
  }
  await humanDelay();
}

export async function typeInto(el: Element, text: string): Promise<void> {
  const target = el as HTMLElement;
  target.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  target.focus();
  await sleep(40);

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    // Clear then set — React/controlled inputs cần InputEvent
    setter?.call(el, '');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    setter?.call(el, text);
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }),
    );
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (target.isContentEditable) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    sel?.removeAllRanges();
    sel?.addRange(range);
    const inserted = document.execCommand('insertText', false, text);
    if (!inserted) {
      target.textContent = '';
      target.appendChild(document.createTextNode(text));
    }
    target.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
    );
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }
  await humanDelay();
}

/** Đọc giá trị hiện tại của ô prompt (textarea / contenteditable). */
export function readEditableValue(el: Element): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value ?? '';
  }
  return (el.textContent ?? '').replace(/\u00a0/g, ' ').trim();
}

export async function uploadFiles(
  target: HTMLInputElement | Element,
  files: { name: string; mime: string; data: Blob }[],
): Promise<void> {
  const dt = new DataTransfer();
  for (const f of files) {
    dt.items.add(new File([f.data], f.name, { type: f.mime }));
  }
  if (target instanceof HTMLInputElement && target.type === 'file') {
    target.files = dt.files;
    target.dispatchEvent(new Event('change', { bubbles: true }));
    target.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    const rect = target.getBoundingClientRect();
    const drop = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      dataTransfer: dt,
    });
    target.dispatchEvent(drop);
  }
  await humanDelay();
}

export function observeNewItems(container: Element, itemSelector: string): () => Element[] {
  const before = new Set([...container.querySelectorAll(itemSelector)]);
  return () => [...container.querySelectorAll(itemSelector)].filter((el) => !before.has(el));
}

export async function humanDelay(min = 120, max = 380): Promise<void> {
  await sleep(min + Math.random() * (max - min));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
