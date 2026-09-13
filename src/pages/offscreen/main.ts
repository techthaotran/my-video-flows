/** Offscreen document — DOM-only helpers the service worker cannot run itself. */

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function once(target: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = () => reject(new Error(target.error?.message || 'video decode failed'));
    target.addEventListener(event, () => {
      target.removeEventListener('error', onError);
      resolve();
    }, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

/** Grab the first or last frame of a clip as JPEG base64. */
async function videoFrame(
  mime: string,
  dataBase64: string,
  which: 'first' | 'last',
): Promise<string> {
  const url = URL.createObjectURL(new Blob([b64ToBytes(dataBase64)], { type: mime || 'video/mp4' }));
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    const loaded = once(video, 'loadeddata');
    video.src = url;
    await loaded;

    const seeked = once(video, 'seeked');
    // First: near t=0 (exact 0 can be blank before the first keyframe paints).
    // Last: a hair before duration (seeking to `duration` exactly yields a blank frame).
    video.currentTime =
      which === 'first' ? Math.min(0.05, Math.max(0, video.duration * 0.01)) : Math.max(0, video.duration - 0.05);
    await seeked;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx || !canvas.width) throw new Error('video has no frames');
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92).split(',', 2)[1] ?? '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'offscreen.createObjectURL' && msg.buffer) {
    const blob = new Blob([msg.buffer], { type: msg.mime ?? 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    sendResponse({ url });
    return true;
  }
  if (
    (msg?.type === 'offscreen.videoFrame' || msg?.type === 'offscreen.lastFrame') &&
    typeof msg.dataBase64 === 'string'
  ) {
    const which: 'first' | 'last' =
      msg.type === 'offscreen.lastFrame' ? 'last' : msg.which === 'last' ? 'last' : 'first';
    videoFrame(msg.mime, msg.dataBase64, which)
      .then((dataBase64) => sendResponse({ dataBase64 }))
      .catch((e) => sendResponse({ error: e instanceof Error ? e.message : String(e) }));
    return true;
  }
  return false;
});
