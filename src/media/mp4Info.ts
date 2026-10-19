/**
 * Duration and frame rate of an MP4 / MOV file from its `moov` boxes, without decoding.
 * Pure (no DOM / WebCodecs) so the service worker can check a clip before uploading it.
 * Returns null when the box is missing or the file is not ISO-BMFF.
 */

function u32(view: DataView, at: number): number {
  return view.getUint32(at);
}

function u64(view: DataView, at: number): number {
  return view.getUint32(at) * 2 ** 32 + view.getUint32(at + 4);
}

/** Walk sibling boxes in `[start, end)`; yields `{ type, body, end }` for each. */
function* boxes(view: DataView, start: number, end: number): Generator<{ type: string; body: number; end: number }> {
  let at = start;
  while (at + 8 <= end) {
    let size = u32(view, at);
    const type = String.fromCharCode(
      view.getUint8(at + 4),
      view.getUint8(at + 5),
      view.getUint8(at + 6),
      view.getUint8(at + 7),
    );
    let body = at + 8;
    if (size === 1) {
      if (at + 16 > end) return;
      size = u64(view, at + 8);
      body = at + 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < body - at || at + size > end) return;
    yield { type, body, end: at + size };
    at += size;
  }
}

export function readMp4DurationSec(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const moov of boxes(view, 0, view.byteLength)) {
    if (moov.type !== 'moov') continue;
    for (const box of boxes(view, moov.body, moov.end)) {
      if (box.type !== 'mvhd') continue;
      const version = view.getUint8(box.body);
      const timescaleAt = box.body + (version === 1 ? 20 : 12);
      const durationAt = timescaleAt + 4;
      if (durationAt + (version === 1 ? 8 : 4) > box.end) return null;
      const timescale = u32(view, timescaleAt);
      const duration = version === 1 ? u64(view, durationAt) : u32(view, durationAt);
      return timescale > 0 ? duration / timescale : null;
    }
    return null;
  }
  return null;
}

function child(view: DataView, parent: { body: number; end: number }, type: string, skip = 0) {
  for (const box of boxes(view, parent.body + skip, parent.end)) if (box.type === type) return box;
  return undefined;
}

export interface Mp4VideoInfo {
  durationSec: number;
  /** Samples in the first video track: one per frame. */
  frames: number;
  fps: number;
}

/**
 * First video track (`hdlr` = `vide`): its `mdhd` duration and `stsz` sample count.
 * Flow measures an edit segment in frames of the input clip, so the real fps matters
 * (Studio 3D exports 30 fps; Flow renders 24).
 */
export function readMp4VideoInfo(bytes: Uint8Array): Mp4VideoInfo | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const root = { body: 0, end: view.byteLength };
  const moov = child(view, root, 'moov');
  if (!moov) return null;
  for (const trak of boxes(view, moov.body, moov.end)) {
    if (trak.type !== 'trak') continue;
    const mdia = child(view, trak, 'mdia');
    const hdlr = mdia && child(view, mdia, 'hdlr');
    if (!mdia || !hdlr || hdlr.body + 12 > hdlr.end) continue;
    const handler = String.fromCharCode(
      view.getUint8(hdlr.body + 8),
      view.getUint8(hdlr.body + 9),
      view.getUint8(hdlr.body + 10),
      view.getUint8(hdlr.body + 11),
    );
    if (handler !== 'vide') continue;
    const mdhd = child(view, mdia, 'mdhd');
    const stsz = (() => {
      const minf = child(view, mdia, 'minf');
      const stbl = minf && child(view, minf, 'stbl');
      return stbl && child(view, stbl, 'stsz');
    })();
    if (!mdhd || !stsz || stsz.body + 12 > stsz.end) return null;
    const version = view.getUint8(mdhd.body);
    const timescaleAt = mdhd.body + (version === 1 ? 20 : 12);
    if (timescaleAt + (version === 1 ? 12 : 8) > mdhd.end) return null;
    const timescale = u32(view, timescaleAt);
    const duration = version === 1 ? u64(view, timescaleAt + 4) : u32(view, timescaleAt + 4);
    const frames = u32(view, stsz.body + 8);
    if (!(timescale > 0) || !(duration > 0) || !(frames > 0)) return null;
    const durationSec = duration / timescale;
    return { durationSec, frames, fps: frames / durationSec };
  }
  return null;
}
