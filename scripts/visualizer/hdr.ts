import fs from "node:fs";

/** Dekodér Radiance HDR (RGBE, RLE) → lineární Float32 RGB. Jen pro vývojové skripty vizualizace. */
export interface HdrImage { width: number; height: number; data: Float32Array }

export function readHdr(file: string): HdrImage {
  const buf = fs.readFileSync(file);
  let pos = 0;
  const line = () => {
    const s = pos;
    while (buf[pos] !== 0x0a) pos++;
    return buf.toString("latin1", s, pos++);
  };
  if (!line().startsWith("#?")) throw new Error("not a Radiance HDR");
  for (let l = line(); l !== ""; l = line()) if (l.startsWith("FORMAT") && !l.includes("32-bit_rle_rgbe")) throw new Error(l);
  const m = /-Y (\d+) \+X (\d+)/.exec(line());
  if (!m) throw new Error("unsupported orientation");
  const height = +m[1], width = +m[2];
  const data = new Float32Array(width * height * 3);
  const row = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    if (buf[pos] !== 2 || buf[pos + 1] !== 2 || ((buf[pos + 2] << 8) | buf[pos + 3]) !== width) throw new Error("expected RLE scanline");
    pos += 4;
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < width) {
        let n = buf[pos++];
        if (n > 128) { n -= 128; const v = buf[pos++]; while (n--) row[(x++) * 4 + c] = v; }
        else while (n--) row[(x++) * 4 + c] = buf[pos++];
      }
    }
    for (let x = 0; x < width; x++) {
      const e = row[x * 4 + 3];
      const f = e ? Math.pow(2, e - 136) : 0;
      const o = (y * width + x) * 3;
      data[o] = row[x * 4] * f; data[o + 1] = row[x * 4 + 1] * f; data[o + 2] = row[x * 4 + 2] * f;
    }
  }
  return { width, height, data };
}
