/**
 * Minimal ISO-BMFF bytes: `ftyp`, padding `free`, then `moov` with `mvhd` and one video
 * `trak` (`mdhd` duration, `hdlr` = vide, `stsz` sample count = duration × fps).
 */
export function makeMp4(
  durationSec: number,
  opts: { version?: 0 | 1; timescale?: number; fps?: number; pad?: number } = {},
): Uint8Array {
  const version = opts.version ?? 0;
  const timescale = opts.timescale ?? 1000;
  const fps = opts.fps ?? 24;
  const duration = Math.round(durationSec * timescale);
  const box = (type: string, ...bodies: Uint8Array[]): Uint8Array => {
    const len = bodies.reduce((n, b) => n + b.length, 0);
    const out = new Uint8Array(8 + len);
    new DataView(out.buffer).setUint32(0, out.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    let at = 8;
    for (const b of bodies) {
      out.set(b, at);
      at += b.length;
    }
    return out;
  };
  /** mvhd / mdhd share the version, timescale, duration layout. */
  const header = (size0: number, size1: number) => {
    const body = new Uint8Array(version === 1 ? size1 : size0);
    const v = new DataView(body.buffer);
    v.setUint8(0, version);
    if (version === 1) {
      v.setUint32(20, timescale);
      v.setUint32(24, Math.floor(duration / 2 ** 32));
      v.setUint32(28, duration >>> 0);
    } else {
      v.setUint32(12, timescale);
      v.setUint32(16, duration);
    }
    return body;
  };
  const hdlr = new Uint8Array(24);
  hdlr.set(new TextEncoder().encode('vide'), 8);
  const stsz = new Uint8Array(12);
  new DataView(stsz.buffer).setUint32(8, Math.round(durationSec * fps));

  const trak = box(
    'trak',
    box('mdia', box('mdhd', header(24, 36)), box('hdlr', hdlr), box('minf', box('stbl', box('stsz', stsz)))),
  );
  return concat([
    box('ftyp', new TextEncoder().encode('isom\0\0\0\0isomiso2mp41')),
    box('free', new Uint8Array(opts.pad ?? 600)),
    box('moov', box('mvhd', header(100, 112)), trak),
  ]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
