/**
 * Formát předpočítaného světla (public/visualizer/bake-{day,evening}.bin, gzip).
 * Hodnoty jsou ozáření E v half-float (IEEE 754 binary16), každý proud je delta-kódovaný po kanálech
 * (u hladkých dat to gzip zmenší na zlomek).
 *
 *   u32 magic, u32 hash, u32 atlasW, u32 atlasH, u32 počet meshů s vrcholy, u32[] počty vrcholů
 *   atlas L0 (plné rozlišení, RGB), atlas DF a DW (poloviční rozlišení, RGB),
 *   pro každý mesh: L0, DF, DW (RGB na vrchol)
 *
 * L0 = světlo s výchozí podlahou a stěnami; DF / DW = světlo odražené od podlahy / stěn na jednotku
 * jejich odrazivosti (přepočet při změně dekoru a barvy stěn).
 */

export const BAKE_MAGIC = 0x334b4256; // "VBK3"

export interface BakeData {
  hash: number;
  atlasW: number;
  atlasH: number;
  atlas: { l0: Uint16Array; df: Uint16Array; dw: Uint16Array };
  vtx: { l0: Uint16Array; df: Uint16Array; dw: Uint16Array }[];
}

function undelta(a: Uint16Array) {
  for (let i = 3; i < a.length; i++) a[i] = (a[i] + a[i - 3]) & 0xffff;
  return a;
}

export function decodeBake(buf: ArrayBuffer): BakeData {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== BAKE_MAGIC) throw new Error("bake: bad magic");
  const hash = dv.getUint32(4, true), atlasW = dv.getUint32(8, true), atlasH = dv.getUint32(12, true), n = dv.getUint32(16, true);
  const counts: number[] = [];
  for (let i = 0; i < n; i++) counts.push(dv.getUint32(20 + i * 4, true));
  let off = 20 + n * 4;
  const take = (len: number) => { const a = undelta(new Uint16Array(buf.slice(off, off + len * 2))); off += len * 2; return a; };
  const full = atlasW * atlasH * 3, half = (atlasW / 2) * (atlasH / 2) * 3;
  const atlas = { l0: take(full), df: take(half), dw: take(half) };
  const vtx = counts.map((c) => ({ l0: take(c * 3), df: take(c * 3), dw: take(c * 3) }));
  if (off !== buf.byteLength) throw new Error("bake: size mismatch");
  return { hash, atlasW, atlasH, atlas, vtx };
}

export function encodeBake(d: BakeData): Uint8Array {
  const streams = [d.atlas.l0, d.atlas.df, d.atlas.dw, ...d.vtx.flatMap((v) => [v.l0, v.df, v.dw])];
  const head = 20 + d.vtx.length * 4;
  const out = new Uint8Array(head + streams.reduce((n, s) => n + s.length * 2, 0));
  const dv = new DataView(out.buffer);
  dv.setUint32(0, BAKE_MAGIC, true); dv.setUint32(4, d.hash, true); dv.setUint32(8, d.atlasW, true); dv.setUint32(12, d.atlasH, true); dv.setUint32(16, d.vtx.length, true);
  d.vtx.forEach((v, i) => dv.setUint32(20 + i * 4, v.l0.length / 3, true));
  let off = head;
  for (const s of streams) {
    const t = new Uint16Array(s.length);
    for (let i = 0; i < s.length; i++) t[i] = i < 3 ? s[i] : (s[i] - s[i - 3]) & 0xffff;
    out.set(new Uint8Array(t.buffer), off);
    off += s.length * 2;
  }
  return out;
}
