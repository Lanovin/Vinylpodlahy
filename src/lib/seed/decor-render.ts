import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * Generátor „feedových“ fotek dekorů pro demo dataset.
 *
 * Reálné feedy nejsou, a stock fotek je jen pár — proto každý dekor dostane vlastní obrázek podlahy,
 * který odpovídá jeho názvu a tónu:
 *  - dřevo: skutečná kresba dřeva z texturových fotek (`fotky_podlahy/`), převedená na čistou
 *    kresbu (jas ÷ rozmazaný jas → bez stínů a vinětace) a obarvená na cílovou barvu dekoru;
 *    lamely se skládají podle skutečného rozměru (rovně s náhodným posunem / rybí kost), s fází nebo bez,
 *  - kámen / beton / mramor / terrazzo: procedurální textura (Perlinův šum) v cílové barvě, dlaždice podle formátu.
 * Barva se kalibruje: průměrná barva výsledku (sRGB, jako `sharp.stats()`) = `color` dekoru.
 *
 * Běží jen v seedu (sekvenčně, sharp na 1 vlákně) — stroj má málo paměti.
 */

export type WoodGrain = "calm" | "bold" | "mixed";
export type StoneKind = "concrete" | "travertine" | "marble" | "slate" | "terrazzo" | "granite";
export type DecorLook =
  | { kind: "wood"; grain?: WoodGrain; contrast?: number; variation?: number; warmth?: number }
  | { kind: StoneKind; variation?: number };

export interface DecorRenderSpec {
  /** Cílová průměrná barva dekoru (sRGB hex). */
  color: string;
  look: DecorLook;
  /** Rozměr lamely / dlaždice v mm [délka, šířka]. */
  plank: [number, number];
  bevel: boolean;
  herringbone?: boolean;
  /** Seed náhody (např. SKU) — stejný vstup = stejný obrázek. */
  seed: string;
}

/** Zdrojový obrázek „od dodavatele“: 2,25 × 1,41 m podlahy při 1,6 px/mm. */
export const SOURCE_W = 3600;
export const SOURCE_H = 2250;
export const PX_PER_MM = 1.6;
/** Zvýšit při změně vykreslování — seed pak obrázky přegeneruje (jinak je bere z cache). */
export const RENDER_VERSION = 2;
/** Verze procedurálních kamenných vzorků (přegeneruje jen kámen/beton). */
export const STONE_VERSION = 3;
/** Verze produktových fotek příslušenství. */
export const ACCESSORY_VERSION = 2;
export const renderVersionFor = (look: DecorLook) => (look.kind === "wood" ? `${RENDER_VERSION}` : `${RENDER_VERSION}.${STONE_VERSION}`);

// --- náhoda a šum --------------------------------------------------------------
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function hash2(a: number, b: number, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

type Noise = (x: number, y: number) => number;
function perlin(seed: number): Noise {
  const r = rng(seed);
  const a = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = a[i & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h: number, x: number, y: number) => {
    switch (h & 7) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y;
    }
  };
  return (x, y) => {
    const X = Math.floor(x), Y = Math.floor(y);
    const xf = x - X, yf = y - Y, xi = X & 255, yi = Y & 255;
    const u = fade(xf), v = fade(yf);
    const aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1], ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
    const x1 = grad(aa, xf, yf) + u * (grad(ba, xf - 1, yf) - grad(aa, xf, yf));
    const x2 = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
    return x1 + v * (x2 - x1);
  };
}
function fbm(n: Noise, x: number, y: number, oct: number) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) { s += amp * n(x * f + o * 17.3, y * f - o * 9.1); norm += amp; amp *= 0.5; f *= 2; }
  return s / norm;
}
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// --- barvy -------------------------------------------------------------------------
const toLin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const LUT = new Uint8Array(4097);
for (let i = 0; i <= 4096; i++) { const l = i / 4096; LUT[i] = Math.round(255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055)); }
const toSrgb8 = (l: number) => LUT[l <= 0 ? 0 : l >= 1 ? 4096 : Math.round(l * 4096)];
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
type RGB = [number, number, number];
const linOf = (hex: string): RGB => hexToRgb(hex).map(toLin) as RGB;

// --- kresba dřeva z fotek ------------------------------------------------------------
interface GrainSource { w: number; h: number; d: Float32Array; half?: GrainSource }
interface Segment { src: GrainSource; x: number; y: number; w: number; h: number; style: "calm" | "bold"; norm: number }

const PHOTO_DIR = () => path.join(/*turbopackIgnore: true*/ process.cwd(), "fotky_podlahy");
/** Čisté úseky lamel na texturových fotkách (bez spár a hran), v px zdrojové fotky. */
const GRAIN_PHOTOS: { file: string; segments: [number, number, number, number, "calm" | "bold"][] }[] = [
  {
    file: "pexels-digitalbuggu-368755.jpg",
    segments: [
      [2900, 1130, 2380, 310, "bold"],
      [1650, 1545, 3630, 415, "bold"],
      [60, 2110, 4090, 670, "bold"],
      [40, 800, 2710, 270, "calm"],
      [40, 1110, 2710, 330, "calm"],
      [2900, 790, 2350, 270, "calm"],
      [30, 520, 4420, 220, "bold"],
    ],
  },
  {
    file: "pexels-hakimsatoso-5776224.jpg",
    segments: [
      [0, 20, 2973, 360, "bold"],
      [760, 420, 2213, 400, "calm"],
      [0, 880, 2973, 390, "calm"],
      [0, 1380, 1460, 320, "bold"],
      [1530, 1380, 1443, 320, "bold"],
    ],
  },
];

let grainCache: Segment[] | null = null;

async function loadGrain(): Promise<Segment[]> {
  if (grainCache) return grainCache;
  const segs: Segment[] = [];
  for (const g of GRAIN_PHOTOS) {
    const file = path.join(PHOTO_DIR(), g.file);
    const { data, info } = await sharp(file).rotate().greyscale().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;
    // Osvětlení / vinětace: silně rozmazaný jas (zmenšit → rozmazat → zvětšit).
    const low = await sharp(data, { raw: { width: w, height: h, channels: 1 } })
      .resize(Math.round(w / 16), Math.round(h / 16)).blur(6).resize(w, h, { kernel: "cubic" }).raw().toBuffer();
    const d = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = Math.log((data[i] + 4) / (low[i] + 4));
    const src: GrainSource = { w, h, d };
    for (const [x, y, sw, sh, style] of g.segments) {
      let s = 0, s2 = 0, n = 0;
      for (let yy = y; yy < y + sh; yy += 3) for (let xx = x; xx < x + sw; xx += 3) { const v = d[yy * w + xx]; s += v; s2 += v * v; n++; }
      const mean = s / n, sd = Math.sqrt(Math.max(1e-6, s2 / n - mean * mean));
      // Odečíst střední hodnotu úseku, normovat na jednotkový rozptyl.
      for (let yy = y; yy < y + sh; yy++) for (let xx = x; xx < x + sw; xx++) d[yy * w + xx] -= mean;
      segs.push({ src, x, y, w: sw, h: sh, style, norm: 1 / sd });
    }
    // Poloviční rozlišení (průměr 2×2) proti aliasingu, když se kresba vzorkuje řidčeji než 1 px.
    const hw = Math.floor(w / 2), hh = Math.floor(h / 2), hd = new Float32Array(hw * hh);
    for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < hw; xx++) {
      const i = 2 * yy * w + 2 * xx;
      hd[yy * hw + xx] = (d[i] + d[i + 1] + d[i + w] + d[i + w + 1]) / 4;
    }
    src.half = { w: hw, h: hh, d: hd };
  }
  grainCache = segs;
  return segs;
}

function sampleGrain(src: GrainSource, x: number, y: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const i = y0 * src.w + x0, d = src.d;
  const a = d[i] + fx * (d[i + 1] - d[i]);
  const b = d[i + src.w] + fx * (d[i + src.w + 1] - d[i + src.w]);
  return a + fy * (b - a);
}

// --- kladení ---------------------------------------------------------------------
interface PlankHit { id: number; u: number; v: number; L: number; W: number }
type Layout = (x: number, y: number) => PlankHit;

/** Rovné kladení s náhodným posunem řad (min. 25 % délky), u dlaždic pravidelná mřížka. */
function straightLayout(L: number, W: number, seed: number, grid: boolean): Layout {
  const r = rng(seed);
  const offs: number[] = [];
  let prev = 0;
  for (let i = 0; i < 400; i++) {
    let o = 0;
    if (!grid) {
      for (let k = 0; k < 20; k++) { o = r() * L; const diff = Math.abs(o - prev) % L; if (Math.min(diff, L - diff) > 0.25 * L) break; }
    }
    offs.push(o); prev = o;
  }
  return (x, y) => {
    const row = Math.floor(y / W);
    const o = offs[((row % 400) + 400) % 400];
    const k = Math.floor((x + o) / L);
    return { id: row * 1000 + k, u: x + o - k * L, v: y - row * W, L, W };
  };
}

/** Rybí kost (lamely pod 45°): H(t)=[t,t+n]×[t,t+1], V(t)=[t+n,t+n+1]×[t−n+1,t+1], pásy posunuté o m·(n,−n). */
function herringboneLayout(L: number, W: number): Layout {
  const n = Math.max(2, Math.round(L / W));
  const c = Math.SQRT1_2;
  return (X, Y) => {
    const x = (X * c + Y * c) / W, y = (-X * c + Y * c) / W;
    const m0 = Math.floor((x - y) / (2 * n));
    for (const m of [m0, m0 + 1, m0 - 1]) {
      const xp = x - m * n, yp = y + m * n;
      let t = Math.floor(yp);
      if (xp >= t && xp < t + n) return { id: (m * 4000 + t) * 2, u: (xp - t) * W, v: (yp - t) * W, L: n * W, W };
      t = Math.floor(xp) - n;
      if (yp >= t - n + 1 && yp < t + 1) return { id: (m * 4000 + t) * 2 + 1, u: (yp - (t - n + 1)) * W, v: (xp - t - n) * W, L: n * W, W };
    }
    return { id: 0, u: 0, v: 0, L: n * W, W };
  };
}

/** Zatmavení na spáře: fáze (V-drážka ~2 mm) nebo jen vlasová spára. */
function jointShade(h: PlankHit, bevel: boolean) {
  const b = bevel ? 2.0 : 0.7;
  const depth = bevel ? 0.5 : 0.42;
  const dl = Math.min(h.v, h.W - h.v), ds = Math.min(h.u, h.L - h.u);
  let s = 1;
  if (dl < b) { const t = smooth(0, b, dl); s *= 1 - (1 - t) * depth * (h.v < h.W / 2 ? 0.75 : 1); }
  if (ds < b) { const t = smooth(0, b, ds); s *= 1 - (1 - t) * depth * (h.u < h.L / 2 ? 0.8 : 1); }
  return s;
}

// --- vzorky kamene --------------------------------------------------------------------
type Shader = (x: number, y: number, out: RGB) => void;

interface PlankParams { lvl: GrainSource; k: number; seg: Segment; x0: number; y0: number; sx: number; sy: number; fx: boolean; fy: boolean; bright: number; tintR: number; tintB: number; cMul: number }

function woodShader(spec: DecorRenderSpec, look: Extract<DecorLook, { kind: "wood" }>, segs: Segment[], layout: Layout, base: RGB, pxPerMm: number): Shader {
  const seed = hashStr(spec.seed);
  const contrast = look.contrast ?? 0.22;
  const variation = look.variation ?? 0.06;
  const warmth = look.warmth ?? 1;
  const pool = segs.filter((s) => (look.grain ?? "mixed") === "mixed" || s.style === look.grain);
  const cache = new Map<number, PlankParams>();
  const cloud = perlin(seed + 7);
  const eR = 1 - 0.1 * warmth, eB = 1 + 0.16 * warmth;
  const params = (h: PlankHit): PlankParams => {
    let p = cache.get(h.id);
    if (p) return p;
    const r = rng(seed ^ Math.imul(h.id + 7919, 2654435761));
    const seg = pool[Math.floor(r() * pool.length)];
    const ratio = h.L / h.W;
    // Výška výřezu ve zdroji (napříč lamelou) a délka (podél) — kresbu lze podél mírně zhustit.
    let hs = seg.h * (0.55 + 0.4 * r());
    let ls = hs * ratio * (0.75 + 0.25 * r());
    if (ls > seg.w - 4) { ls = seg.w - 4; hs = Math.min(hs, Math.max(seg.h * 0.4, (ls / ratio) * 1.6)); }
    const sx = ls / h.L, sy = hs / h.W;
    const useHalf = Math.max(sx, sy) / pxPerMm > 1.4 && !!seg.src.half;
    p = {
      lvl: useHalf ? seg.src.half! : seg.src, k: useHalf ? 0.5 : 1,
      seg, sx, sy,
      x0: seg.x + 1 + r() * Math.max(0, seg.w - ls - 3), y0: seg.y + 1 + r() * Math.max(0, seg.h - hs - 3),
      fx: r() < 0.5, fy: r() < 0.5,
      bright: Math.exp(gauss(r) * variation), tintR: Math.exp(gauss(r) * variation * 0.25), tintB: Math.exp(gauss(r) * variation * 0.25),
      cMul: 0.85 + 0.3 * r(),
    };
    cache.set(h.id, p);
    return p;
  };
  return (x, y, out) => {
    const h = layout(x, y);
    const p = params(h);
    const u = p.fx ? h.L - h.u : h.u, v = p.fy ? h.W - h.v : h.v;
    const d = sampleGrain(p.lvl, (p.x0 + u * p.sx) * p.k, (p.y0 + v * p.sy) * p.k) * p.seg.norm;
    const f = Math.exp(contrast * p.cMul * Math.max(-3.5, Math.min(3.5, d)));
    const lowF = 1 + 0.035 * cloud(x / 420, y / 420);
    const s = jointShade(h, spec.bevel) * p.bright * lowF;
    out[0] = base[0] * s * p.tintR * f ** eR;
    out[1] = base[1] * s * f;
    out[2] = base[2] * s * p.tintB * f ** eB;
  };
}

const TERRAZZO_CHIPS: RGB[] = ["#f4f2ee", "#9c9a96", "#5a5856", "#c9b79c", "#b07a62", "#2e2e2e", "#e3ddd2", "#7d8a8c", "#f4f2ee", "#9c9a96"].map(linOf);

function stoneShader(spec: DecorRenderSpec, kind: StoneKind, variation: number, layout: Layout, base: RGB): Shader {
  const seed = hashStr(spec.seed);
  const n1 = perlin(seed + 1), n2 = perlin(seed + 2), n3 = perlin(seed + 3);
  const tile = new Map<number, { ox: number; oy: number; b: number; tr: number; tb: number }>();
  const tileParams = (id: number) => {
    let t = tile.get(id);
    if (!t) {
      const r = rng(seed ^ Math.imul(id + 31, 2246822519));
      t = { ox: r() * 20000, oy: r() * 20000, b: Math.exp(gauss(r) * variation), tr: Math.exp(gauss(r) * variation * 0.3), tb: Math.exp(gauss(r) * variation * 0.3) };
      tile.set(id, t);
    }
    return t;
  };
  return (x, y, out) => {
    const h = layout(x, y);
    const t = tileParams(h.id);
    const px = h.u + t.ox, py = h.v + t.oy;
    let f = 1;
    let mix = 0; // 0 = základ, 1 = barva žilky/zrna
    let mixCol: RGB | null = null;
    switch (kind) {
      case "concrete": {
        f = 1 + 0.3 * fbm(n1, px / 380, py / 380, 4) + 0.14 * fbm(n2, px / 55, py / 55, 3) + 0.09 * n3(px / 1.3, py / 1.3);
        const cx = Math.floor(px / 6), cy = Math.floor(py / 6), hr = hash2(cx, cy, seed);
        if (hr < 0.13) {
          const dx = px - (cx + 0.5) * 6, dy = py - (cy + 0.5) * 6, rad = 0.35 + hr * 7;
          const dd = Math.sqrt(dx * dx + dy * dy);
          if (dd < rad) f *= 0.62 + 0.38 * smooth(0, rad, dd);
        }
        break;
      }
      case "travertine": {
        // Řez „vein-cut“: téměř rovné vodorovné vrstvy + izotropní skvrny + póry (typický znak travertinu).
        const t1 = fbm(n1, px / 2400, py / 14, 4);
        f = 1 + 0.16 * t1 + 0.2 * fbm(n2, px / 220, py / 160, 4) + 0.07 * n3(px / 1.5, py / 1.5);
        // Póry: nepravidelně rozházené protáhlé dutinky (3×3 sousední buňky).
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const cx = Math.floor(px / 30) + i, cy = Math.floor(py / 12) + j, hr = hash2(cx, cy, seed);
          if (hr > 0.55) continue;
          const ex = px - (cx + hash2(cx, cy, seed + 5)) * 30, ey = py - (cy + hash2(cx, cy, seed + 6)) * 12;
          const rx = 1.2 + hr * 22 * hash2(cx, cy, seed + 7), ry = 0.6 + hr * 4 * hash2(cx, cy, seed + 8);
          const e = (ex * ex) / (rx * rx) + (ey * ey) / (ry * ry);
          if (e < 1) f *= 0.42 + 0.58 * smooth(0.1, 1, e);
        }
        mix = Math.max(0, Math.min(1, 0.4 + 2.5 * fbm(n3, px / 500 + 50, py / 260, 4)));
        mixCol = [base[0] * 0.86, base[1] * 0.8, base[2] * 0.7];
        break;
      }
      case "marble": {
        // Žilky: zvlněné (domain warping) rovnoběžné linie, tenké ostré + široké měkké „mraky“.
        const wx = px + 140 * fbm(n1, px / 520, py / 520, 5), wy = py + 140 * fbm(n2, px / 520 + 40, py / 520, 5);
        const s1 = Math.abs(Math.sin((wx * 0.82 + wy * 0.57) / 120));
        const vx = px + 60 * fbm(n2, px / 180, py / 180, 4), vy = py + 60 * fbm(n1, px / 180, py / 180 + 70, 4);
        const s2 = Math.abs(Math.sin((vx * 0.3 - vy * 0.95) / 55));
        const veinMask = smooth(-0.1, 0.35, fbm(n3, px / 700, py / 700, 3));
        const vein = (Math.exp(-((s1 / 0.04) ** 2)) * 0.6 + Math.exp(-((s1 / 0.3) ** 2)) * 0.12) * veinMask + Math.exp(-((s2 / 0.02) ** 2)) * 0.22 * (1 - veinMask * 0.5);
        f = 1 + 0.08 * fbm(n3, px / 400, py / 400, 3) + 0.015 * n3(px / 1.2, py / 1.2);
        mix = Math.min(1, vein);
        mixCol = [base[0] * 0.48, base[1] * 0.49, base[2] * 0.52];
        break;
      }
      case "slate": {
        f = 1 + 0.4 * fbm(n1, px / 600, py / 40, 5) + 0.25 * fbm(n2, px / 90, py / 16, 4) + 0.1 * n3(px / 1.4, py / 1.4);
        const fl = fbm(n2, px / 26 + 300, py / 20, 3);
        if (fl > 0.15) f *= 1 + Math.min(0.1, (fl - 0.15) * 0.8);
        mix = smooth(0.1, 0.5, fbm(n3, px / 250 + 90, py / 120, 3)) * 0.5;
        mixCol = [base[0] * 1.15, base[1] * 1.0, base[2] * 0.85];
        break;
      }
      case "granite": {
        const g = n3(px / 1.7, py / 1.7) + 0.5 * n2(px / 4, py / 4);
        f = 1 + 0.15 * fbm(n1, px / 300, py / 300, 3);
        if (g > 0.36) { mix = Math.min(1, (g - 0.36) * 4); mixCol = [Math.min(1, base[0] * 3.2), Math.min(1, base[1] * 3.2), Math.min(1, base[2] * 3.3)]; }
        else if (g < -0.4) f *= 0.62;
        break;
      }
      case "terrazzo": {
        f = 1 + 0.03 * fbm(n1, px / 300, py / 300, 3) + 0.03 * n3(px / 1.1, py / 1.1);
        const C = 11, cx = Math.floor(px / C), cy = Math.floor(py / C);
        for (let j = -1; j <= 1 && !mixCol; j++) for (let i = -1; i <= 1; i++) {
          const hx = hash2(cx + i, cy + j, seed), hy = hash2(cx + i, cy + j, seed + 1), hs = hash2(cx + i, cy + j, seed + 2);
          if (hs > 0.8) continue;
          const ccx = (cx + i + hx) * C, ccy = (cy + j + hy) * C;
          const R = hs < 0.06 ? 5 + hs * 60 : 1.0 + hs * 4.2;
          const dx = px - ccx, dy = py - ccy, dd = Math.sqrt(dx * dx + dy * dy);
          if (dd > R * 1.4) continue;
          const ang = Math.atan2(dy, dx);
          // Nepravidelný mnohoúhelník (úlomek kamene): 4–7 hran + drobná nepravidelnost.
          const k = 4 + Math.floor(hash2(cx + i, cy + j, seed + 4) * 4), seg = (2 * Math.PI) / k;
          const a = (((ang + hx * 6.28) % seg) + seg) % seg - seg / 2;
          const rr = (R * Math.cos(seg / 2)) / Math.cos(a) * (1 + 0.1 * Math.sin(2 * ang + hy * 6.28));
          if (dd < rr) { mixCol = TERRAZZO_CHIPS[Math.floor(hash2(cx + i, cy + j, seed + 3) * TERRAZZO_CHIPS.length)]; mix = 1; break; }
        }
        break;
      }
    }
    const s = jointShade(h, spec.bevel) * t.b;
    let r = base[0] * t.tr, g = base[1], b = base[2] * t.tb;
    if (mixCol && mix > 0) { r += (mixCol[0] - r) * mix; g += (mixCol[1] - g) * mix; b += (mixCol[2] - b) * mix; }
    out[0] = r * f * s; out[1] = g * f * s; out[2] = b * f * s;
  };
}

// --- vykreslení + kalibrace barvy -----------------------------------------------------
async function renderWith(shader: Shader, target: RGB, w: number, h: number, pxPerMm: number): Promise<Buffer> {
  // 1) podvzorek → zisk na kanál tak, aby průměr sRGB (jako sharp.stats) seděl na cílovou barvu
  const step = 5;
  const samples: number[] = [];
  const tmp: RGB = [0, 0, 0];
  for (let y = 2; y < h; y += step) for (let x = (y * 7) % step; x < w; x += step) { shader(x / pxPerMm, y / pxPerMm, tmp); samples.push(tmp[0], tmp[1], tmp[2]); }
  const gain: RGB = [1, 1, 1];
  for (let it = 0; it < 6; it++) {
    const sum = [0, 0, 0];
    for (let i = 0; i < samples.length; i += 3) for (let c = 0; c < 3; c++) sum[c] += toSrgb8(samples[i + c] * gain[c]);
    const cnt = samples.length / 3;
    for (let c = 0; c < 3; c++) gain[c] *= target[c] / Math.max(1e-4, toLin(sum[c] / cnt));
  }
  // 2) plné vykreslení
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      shader(x / pxPerMm, y / pxPerMm, tmp);
      const i = (y * w + x) * 3;
      out[i] = toSrgb8(tmp[0] * gain[0]); out[i + 1] = toSrgb8(tmp[1] * gain[1]); out[i + 2] = toSrgb8(tmp[2] * gain[2]);
    }
  }
  return out;
}

export async function renderDecor(spec: DecorRenderSpec, w = SOURCE_W, h = SOURCE_H, pxPerMm = PX_PER_MM): Promise<Buffer> {
  const target = linOf(spec.color);
  const [L, W] = spec.plank;
  const seed = hashStr(spec.seed);
  const look = spec.look;
  let shader: Shader;
  if (look.kind === "wood") {
    const layout = spec.herringbone ? herringboneLayout(L, W) : straightLayout(L, W, seed, false);
    shader = woodShader(spec, look, await loadGrain(), layout, target, pxPerMm);
  } else {
    shader = stoneShader(spec, look.kind, look.variation ?? 0.05, straightLayout(L, W, seed, true), target);
  }
  return renderWith(shader, target, w, h, pxPerMm);
}

/** Vykreslí dekor a uloží jako „fotku od dodavatele“ (webp). */
export async function writeDecorImage(spec: DecorRenderSpec, file: string) {
  const raw = await renderDecor(spec);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(raw, { raw: { width: SOURCE_W, height: SOURCE_H, channels: 3 } }).webp({ quality: 78, effort: 4 }).toFile(file);
}

// --- příslušenství ---------------------------------------------------------------------
export type AccessoryVisual =
  | { kind: "skirting"; color: string; wood: boolean; floor: string }
  | { kind: "transition"; metal: "silver" | "oak"; left: string; right: string }
  | { kind: "underlay"; color: string; foil?: boolean };

const ACC = 600;

async function rawToPng(raw: Buffer, w: number, h: number) {
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

/** Materiál bez spár (jedna velká „lamela“) — vzorek barvy lišty / dřevodekoru. */
async function material(color: string, look: DecorLook, w: number, h: number, pxPerMm: number, seed: string, plankLenMm = 2400) {
  return rawToPng(await renderDecor({ color, look, plank: [plankLenMm, h / pxPerMm + 50], bevel: false, seed }, w, h, pxPerMm), w, h);
}

function brushed(color: string, w: number, h: number, seed: string, vertical: boolean) {
  const base = linOf(color);
  const n = perlin(hashStr(seed));
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = vertical ? x : y, b = vertical ? y : x;
    const f = 1 + 0.05 * n(a / 0.6, b / 40) + 0.03 * n(a / 3, b / 200) + 0.12 * Math.cos(((vertical ? x / w : y / h) - 0.35) * Math.PI);
    const i = (y * w + x) * 3;
    for (let c = 0; c < 3; c++) out[i + c] = toSrgb8(base[c] * f);
  }
  return out;
}

export async function writeAccessoryImage(v: AccessoryVisual, file: string, seed: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ppm = 4; // 600 px ≈ 150 mm
  if (v.kind === "skirting") {
    const wallH = 290, boardH = 240, floorH = ACC - wallH - boardH;
    const wall = await sharp({ create: { width: ACC, height: wallH, channels: 3, background: "#ecebe7" } }).png().toBuffer();
    const board = v.wood
      ? await material(v.color, { kind: "wood", grain: "calm", contrast: 0.2, variation: 0 }, ACC, boardH, ppm, seed)
      : await rawToPng(brushed(v.color, ACC, boardH, seed, false), ACC, boardH);
    const floor = await material(v.floor, { kind: "wood", grain: "calm", contrast: 0.18, variation: 0 }, ACC, floorH, 1.2, seed + "f");
    const shade = Buffer.from(`<svg width="${ACC}" height="${ACC}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <rect x="0" y="${wallH}" width="${ACC}" height="14" fill="url(#t)"/><rect x="0" y="${wallH + boardH}" width="${ACC}" height="26" fill="url(#g)"/><rect x="0" y="${wallH - 3}" width="${ACC}" height="3" fill="#000" opacity="0.12"/></svg>`);
    await sharp({ create: { width: ACC, height: ACC, channels: 3, background: "#fff" } })
      .composite([{ input: wall, top: 0, left: 0 }, { input: board, top: wallH, left: 0 }, { input: floor, top: wallH + boardH, left: 0 }, { input: shade, top: 0, left: 0 }])
      .webp({ quality: 84 }).toFile(file);
    return;
  }
  if (v.kind === "transition") {
    const stripW = 152, side = (ACC - stripW) / 2;
    const left = await rawToPng(await renderDecor({ color: v.left, look: { kind: "wood", contrast: 0.2 }, plank: [1220, 190], bevel: true, seed: seed + "l" }, side, ACC, 1.6), side, ACC);
    const right = await rawToPng(await renderDecor({ color: v.right, look: { kind: "concrete" }, plank: [610, 305], bevel: false, seed: seed + "r" }, side, ACC, 1.6), side, ACC);
    const strip = v.metal === "silver"
      ? await rawToPng(brushed("#b9bbbd", stripW, ACC, seed, true), stripW, ACC)
      : await sharp(await material("#b48c62", { kind: "wood", grain: "calm", contrast: 0.22, variation: 0 }, ACC, stripW, 4, seed + "s")).rotate(90).png().toBuffer();
    const edge = Buffer.from(`<svg width="${stripW}" height="${ACC}"><rect x="0" y="0" width="5" height="${ACC}" fill="#000" opacity="0.28"/><rect x="${stripW - 5}" y="0" width="5" height="${ACC}" fill="#000" opacity="0.32"/><rect x="5" y="0" width="4" height="${ACC}" fill="#fff" opacity="0.35"/></svg>`);
    await sharp({ create: { width: ACC, height: ACC, channels: 3, background: "#fff" } })
      .composite([{ input: left, left: 0, top: 0 }, { input: right, left: side + stripW, top: 0 }, { input: strip, left: side, top: 0 }, { input: edge, left: side, top: 0 }])
      .webp({ quality: 84 }).toFile(file);
    return;
  }
  // podložka: jemná pěna (IXPE), u termo podložky fólie
  const base = linOf(v.color);
  const n = perlin(hashStr(seed)), n2 = perlin(hashStr(seed) + 1);
  const out = Buffer.alloc(ACC * ACC * 3);
  for (let y = 0; y < ACC; y++) for (let x = 0; x < ACC; x++) {
    const f = v.foil
      ? 1 + 0.18 * fbm(n, x / 90, y / 60, 4) + 0.06 * n2(x / 6, y / 30) + 0.1 * Math.sin((x + y) / 140)
      : 1 + 0.06 * n(x / 2.2, y / 2.2) + 0.04 * fbm(n2, x / 120, y / 120, 3) - 0.08 * Math.max(0, n(x / 1.1 + 50, y / 1.1));
    const i = (y * ACC + x) * 3;
    for (let c = 0; c < 3; c++) out[i + c] = toSrgb8(base[c] * f);
  }
  await sharp(out, { raw: { width: ACC, height: ACC, channels: 3 } }).webp({ quality: 84 }).toFile(file);
}
