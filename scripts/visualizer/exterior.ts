/**
 * Výhled z oken modelového bytu: z HDR panoramatu vyrobí výřez public/visualizer/exterior-{l,s}.jpg.
 *
 * Zdroj: „Studio Garden“ od Sergeje Majborody, Poly Haven, licence CC0 (bez nutnosti uvádět autora).
 *   curl -o studio_garden_4k.hdr https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/studio_garden_4k.hdr
 *   npx tsx scripts/visualizer/exterior.ts studio_garden_4k.hdr
 */
import path from "node:path";
import sharp from "sharp";
import { EXTERIOR } from "../../src/components/visualizer/engine/lighting";
import { readHdr } from "./hdr";

const src = process.argv[2];
if (!src) throw new Error("usage: exterior.ts <panorama.hdr>");
const img = readHdr(src);
const { width: W, height: H, data } = img;
const E = EXTERIOR;
const CLAMP = 40;

function sample(u: number, v: number, out: number[]) {
  // Bilineárně, u se opakuje dokola, v se ořízne.
  const x = u * W - 0.5, y = Math.min(H - 1, Math.max(0, v * H - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const y1 = Math.min(H - 1, y0 + 1);
  out[0] = out[1] = out[2] = 0;
  for (const [xx, yy, w] of [[x0, y0, (1 - fx) * (1 - fy)], [x0 + 1, y0, fx * (1 - fy)], [x0, y1, (1 - fx) * fy], [x0 + 1, y1, fx * fy]] as const) {
    const o = ((yy * W) + (((xx % W) + W) % W)) * 3;
    for (let c = 0; c < 3; c++) out[c] += Math.min(CLAMP, data[o + c]) * w;
  }
}

async function write(fullWidth: number, file: string, quality: number) {
  const w = Math.round((fullWidth * (E.thetaMax - E.thetaMin)) / 360);
  const h = Math.round(((fullWidth / 2) * (E.elevMax - E.elevMin)) / 180);
  const px = Buffer.alloc(w * h * 3);
  const s = [0, 0, 0], acc = [0, 0, 0];
  const SS = 3;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      acc[0] = acc[1] = acc[2] = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const theta = E.thetaMin + ((i + (sx + 0.5) / SS) / w) * (E.thetaMax - E.thetaMin);
        const elev = E.elevMax - ((j + (sy + 0.5) / SS) / h) * (E.elevMax - E.elevMin);
        const u = (((theta / 360 + 0.5 + E.rotU) % 1) + 1) % 1;
        sample(u, (90 - elev) / 180, s);
        acc[0] += s[0]; acc[1] += s[1]; acc[2] += s[2];
      }
      for (let c = 0; c < 3; c++) {
        const x = acc[c] / (SS * SS);
        const t = x / (1 + x);
        const srgb = t <= 0.0031308 ? 12.92 * t : 1.055 * Math.pow(t, 1 / 2.4) - 0.055;
        px[(j * w + i) * 3 + c] = Math.round(Math.min(1, Math.max(0, srgb)) * 255);
      }
    }
  }
  await sharp(px, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(file);
  console.log(file, w, "×", h);
}

const out = path.resolve("public/visualizer");
write(3584, path.join(out, "exterior-l.jpg"), 82)
  .then(() => write(2048, path.join(out, "exterior-s.jpg"), 80))
  .catch((e) => { console.error(e); process.exit(1); });
