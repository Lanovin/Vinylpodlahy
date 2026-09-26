import { clamp01, fbm, hashString, rng, smoothstep, valueNoise } from "./noise";
import type { Palette, RGB } from "./palette";

/**
 * Procedurální podlaha: z palety dekoru a SKUTEČNÝCH rozměrů lamely (délka × šířka, V-drážka)
 * se vygeneruje sada unikátních lamel a z nich se poskládá opakovatelná dlaždice textury
 * (rovně / rybí kost; diagonála je jen otočení UV). Dlaždice je přesně periodická, takže
 * na podlaze bytu nejsou vidět švy textury.
 */
export type DecorKind = "wood" | "marble" | "concrete" | "slate" | "travertine" | "terrazzo";
export type Pattern = "straight" | "herringbone";

export interface DecorSpec {
  seedKey: string;
  kind: DecorKind;
  palette: Palette;
  /** Rozměr lamely v metrech. */
  plankL: number;
  plankW: number;
  bevel: boolean;
  pattern: Pattern;
}

export interface FloorTile {
  map: HTMLCanvasElement;
  bump: HTMLCanvasElement;
  /** Velikost dlaždice v metrech (pro UV ve světových souřadnicích). */
  tileW: number;
  tileH: number;
}

const TILE_TARGET_M = 4.6;
const BOARD_COUNT = 16;
const BOARD_PPM_MAX = 520;

const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: RGB, k: number, a: number) => `rgba(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)},${a})`;

function createCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

/** Hodnota „tmavosti“ t (0 = světlá kresba, 1 = tmavá) pro každý pixel lamely. */
type Field = (u: number, v: number) => number;

function woodField(seed: number, L: number, W: number): Field {
  const R = rng(seed);
  const n1 = valueNoise(seed ^ 0x51f3), n2 = valueNoise(seed ^ 0x2c9a), n3 = valueNoise(seed ^ 0x7e11);
  const flat = R() < 0.62;
  const freq = 1 / (0.0055 + R() * 0.006);
  const cy = (R() - 0.5) * W * 1.8;
  const cz = 0.015 + R() * 0.07;
  const tilt = (R() - 0.5) * 0.07;
  const u0 = R() * L;
  const ox = R() * 97, oy = R() * 57;
  const shift = (R() - 0.5) * 0.28;
  const poreAmt = 0.08 + R() * 0.1;
  const ringAmt = 0.34 + R() * 0.22;
  return (u, v) => {
    let r: number;
    if (flat) { const zz = cz + tilt * (u - u0); r = Math.sqrt((v - cy) * (v - cy) + zz * zz); }
    else r = v + tilt * 0.2 * u;
    r += 0.0032 * (fbm(n1, u * 2.2 + ox, v * 24 + oy, 3) - 0.5) * 2 + 0.0009 * (n2(u * 13 + ox, v * 110 + oy) - 0.5) * 2;
    const f = r * freq - Math.floor(r * freq);
    const ring = smoothstep(0.45, 0.88, f) * (1 - smoothstep(0.9, 1, f));
    const pore = smoothstep(0.66, 0.95, n3(u * 9 + ox, v * 520 + oy));
    const broad = fbm(n2, u * 0.8 + oy, v * 4.5 + ox, 3) - 0.5;
    return 0.08 + ringAmt * ring + poreAmt * pore + 0.4 * broad + shift;
  };
}

function stoneField(kind: DecorKind, seed: number): Field {
  const R = rng(seed);
  const n1 = valueNoise(seed ^ 0x33aa), n2 = valueNoise(seed ^ 0x1bd7), n3 = valueNoise(seed ^ 0x6c01);
  const ox = R() * 300, oy = R() * 300;
  const shift = (R() - 0.5) * 0.1;
  const ang = R() * Math.PI;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  switch (kind) {
    case "marble":
      return (u, v) => {
        const x = u + ox, y = v + oy;
        const w1 = Math.abs(Math.sin((x * ca + y * sa) * 4.5 + fbm(n1, x * 0.9, y * 0.9, 5) * 5.5));
        const w2 = Math.abs(Math.sin((x * sa - y * ca) * 13 + fbm(n2, x * 2.2, y * 2.2, 4) * 4));
        const cloud = fbm(n3, x * 1.6, y * 1.6, 4);
        return 0.1 + 0.3 * cloud + 0.42 * (1 - smoothstep(0, 0.03, w1)) * (0.5 + cloud) + 0.16 * (1 - smoothstep(0, 0.018, w2)) + shift;
      };
    case "slate":
      return (u, v) => { const x = u + ox, y = v + oy; return 0.45 + 0.7 * (fbm(n1, x * 1.3, y * 7, 5) - 0.5) + 0.28 * (n2(x * 38, y * 38) - 0.5) + shift; };
    case "travertine":
      return (u, v) => {
        const x = u + ox, y = v + oy;
        const hole = smoothstep(0.87, 0.94, n2(x * 22, y * 190));
        return 0.4 + 0.62 * (fbm(n1, x * 0.45, y * 9, 4) - 0.5) + 0.1 * (n3(x * 60, y * 60) - 0.5) + 0.32 * hole + shift;
      };
    case "terrazzo":
      return (u, v) => { const x = u + ox, y = v + oy; return 0.34 + 0.16 * (fbm(n1, x * 5, y * 5, 3) - 0.5) + 0.1 * (n2(x * 90, y * 90) - 0.5) + shift; };
    default: // beton, kámen
      return (u, v) => {
        const x = u + ox, y = v + oy;
        const speck = smoothstep(0.9, 0.97, n3(x * 240, y * 240));
        return 0.45 + 0.55 * (fbm(n1, x * 2.6, y * 2.6, 4) - 0.5) + 0.3 * (fbm(n2, x * 16, y * 16, 3) - 0.5) + 0.3 * speck + shift;
      };
  }
}

function makeBoards(spec: DecorSpec, ppm: number): HTMLCanvasElement[] {
  const { plankL: L, plankW: W, palette } = spec;
  const pw = Math.max(8, Math.round(L * ppm)), ph = Math.max(4, Math.round(W * ppm));
  const seed = hashString(spec.seedKey);
  const wood = spec.kind === "wood";
  const pivot = wood ? 0.3 : 0.45;
  const toColor = (t: number): RGB => (t < pivot ? mixc(palette.light, palette.base, t / pivot) : mixc(palette.base, palette.dark, (t - pivot) / (1 - pivot)));

  // 1. průchod: pole tmavosti; současně průměrná barva, aby celek seděl na změřený základ dekoru.
  const fields: Float32Array[] = [];
  const sum = [0, 0, 0];
  for (let b = 0; b < BOARD_COUNT; b++) {
    const f = wood ? woodField(seed + b * 7919, L, W) : stoneField(spec.kind, seed + b * 7919);
    const arr = new Float32Array(pw * ph);
    for (let y = 0; y < ph; y++) {
      const v = ((y + 0.5) / ph) * W;
      for (let x = 0; x < pw; x++) {
        const t = clamp01(f(((x + 0.5) / pw) * L, v));
        arr[y * pw + x] = t;
      }
    }
    // Průměr jen z řídkého vzorku (stačí pro korekci).
    for (let i = 0; i < arr.length; i += 7) { const c = toColor(arr[i]); sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2]; }
    fields.push(arr);
  }
  const samples = fields.reduce((n, a) => n + Math.ceil(a.length / 7), 0);
  const corr = [0, 1, 2].map((i) => Math.min(1.35, Math.max(0.75, palette.base[i] / Math.max(1, sum[i] / samples))));

  // 2. průchod: zápis pixelů.
  const R = rng(seed ^ 0xabcdef);
  return fields.map((arr) => {
    const c = createCanvas(pw, ph);
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(pw, ph);
    const d = img.data;
    for (let i = 0; i < arr.length; i++) {
      const col = toColor(arr[i]);
      d[i * 4] = col[0] * corr[0];
      d[i * 4 + 1] = col[1] * corr[1];
      d[i * 4 + 2] = col[2] * corr[2];
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (spec.kind === "terrazzo") {
      // Kamínky terrazza.
      const chips = Math.round(L * W * 2600);
      const cols = [palette.dark, palette.light, mixc(palette.dark, palette.base, 0.4), [170, 120, 96] as RGB];
      for (let k = 0; k < chips; k++) {
        const col = cols[Math.floor(R() * (R() < 0.08 ? 4 : 3))];
        ctx.fillStyle = rgba(col, R() < 0.5 ? 0.9 : 1.05, 1);
        const cx = R() * pw, cy = R() * ph, rr = (0.0015 + R() * R() * 0.007) * ppm;
        ctx.beginPath();
        const sides = 5 + Math.floor(R() * 3);
        for (let s = 0; s < sides; s++) { const a = (s / sides) * Math.PI * 2 + R() * 0.6; const q = rr * (0.6 + R() * 0.5); ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
        ctx.fill();
      }
    }
    return c;
  });
}

interface Placement { x: number; y: number; vertical: boolean; board: number; fu: boolean; fv: boolean }

function assignTable(count: number, R: () => number) {
  const t: { board: number; fu: boolean; fv: boolean }[] = [];
  let prev = -1;
  for (let i = 0; i < count; i++) {
    let b = Math.floor(R() * BOARD_COUNT);
    if (b === prev) b = (b + 1 + Math.floor(R() * (BOARD_COUNT - 1))) % BOARD_COUNT;
    prev = b;
    t.push({ board: b, fu: R() < 0.5, fv: R() < 0.3 });
  }
  return t;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

export function buildFloorTile(spec: DecorSpec, maxSide: number): FloorTile {
  const L = spec.plankL, W = spec.plankW;
  const R = rng(hashString(spec.seedKey + "|layout|" + spec.pattern));
  const planks: Placement[] = [];
  let tileW: number, tileH: number;
  let rotate = 0;

  if (spec.pattern === "straight") {
    const n = Math.max(1, Math.round(TILE_TARGET_M / L));
    const m = Math.max(2, Math.round(TILE_TARGET_M / W));
    tileW = n * L; tileH = m * W;
    // Posun spojů mezi řadami min. 30 cm (u krátkých lamel třetina délky), jako při skutečné pokládce.
    const minShift = Math.min(0.3, L / 3);
    const circ = (a: number, b: number) => { const d = Math.abs(a - b) % L; return Math.min(d, L - d); };
    const offs: number[] = [];
    for (let i = 0; i < m; i++) {
      let o = R() * L;
      for (let tries = 0; tries < 40 && i > 0; tries++) {
        const okPrev = circ(o, offs[i - 1]) >= minShift;
        const okPrev2 = i < 2 || circ(o, offs[i - 2]) >= minShift * 0.5;
        const okWrap = i < m - 1 || circ(o, offs[0]) >= minShift;
        if (okPrev && okPrev2 && okWrap) break;
        o = R() * L;
      }
      offs.push(o);
    }
    const table = assignTable(n * m, R);
    for (let i = 0; i < m; i++) {
      for (let k = -1; k <= n; k++) {
        const a = table[i * n + mod(k, n)];
        planks.push({ x: offs[i] + (k - 1) * L, y: i * W, vertical: false, ...a });
      }
    }
  } else {
    // Rybí kost: mřížka v osách lamel má vektory (w, w) a (L, −L); po otočení o −45° je obdélníková
    // s periodou √2·w × √2·L — dlaždice je tedy přesně opakovatelná.
    const a = Math.SQRT2 * W, b = Math.SQRT2 * L;
    const n = Math.max(2, Math.round(TILE_TARGET_M / a));
    const m = Math.max(1, Math.round(TILE_TARGET_M / b));
    tileW = n * a; tileH = m * b;
    rotate = -Math.PI / 4;
    const table = assignTable(n * m * 2, R);
    const kMargin = Math.ceil(b / a) + 2;
    for (let j = -m - 2; j <= 2; j++) {
      for (let k = -kMargin; k <= n + kMargin; k++) {
        const X = k * a, Y = -j * b;
        if (X < -b - a || X > tileW + b + a || Y < -b * 1.5 || Y > tileH + b * 1.5) continue;
        const base = (mod(k, n) * m + mod(j, m)) * 2;
        planks.push({ x: k * W + j * L, y: k * W - j * L, vertical: false, ...table[base] });
        planks.push({ x: k * W + L + j * L, y: (k + 1) * W - L - j * L, vertical: true, ...table[base + 1] });
      }
    }
  }

  const ppm = maxSide / Math.max(tileW, tileH);
  const pw = Math.round(tileW * ppm), ph = Math.round(tileH * ppm);
  const boards = makeBoards(spec, Math.min(ppm, BOARD_PPM_MAX));
  const seam = spec.palette.dark;

  const map = createCanvas(pw, ph);
  const mctx = map.getContext("2d")!;
  mctx.fillStyle = rgba(seam, 0.55, 1);
  mctx.fillRect(0, 0, pw, ph);
  mctx.imageSmoothingQuality = "high";

  const bw = Math.max(64, Math.round(pw / 2)), bh = Math.max(64, Math.round(ph / 2));
  const bump = createCanvas(bw, bh);
  const bctx = bump.getContext("2d")!;
  bctx.fillStyle = "#000";
  bctx.fillRect(0, 0, bw, bh);

  const drawAll = (ctx: CanvasRenderingContext2D, sx: number, sy: number, isBump: boolean) => {
    ctx.setTransform(sx / tileW, 0, 0, sy / tileH, 0, 0);
    if (rotate) ctx.rotate(rotate);
    for (const p of planks) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.vertical) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
      if (isBump) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, L, W);
        ctx.strokeStyle = spec.bevel ? "#000" : "#555";
        ctx.lineWidth = spec.bevel ? 0.005 : 0.0018;
        ctx.strokeRect(0, 0, L, W);
      } else {
        ctx.save();
        if (p.fu) { ctx.translate(L, 0); ctx.scale(-1, 1); }
        if (p.fv) { ctx.translate(0, W); ctx.scale(1, -1); }
        ctx.drawImage(boards[p.board], 0, 0, L, W);
        ctx.restore();
        if (spec.bevel) {
          ctx.strokeStyle = rgba(seam, 0.45, 0.62);
          ctx.lineWidth = 0.0026;
          ctx.strokeRect(0, 0, L, W);
          ctx.strokeStyle = "rgba(255,248,236,0.10)";
          ctx.lineWidth = 0.0012;
          ctx.strokeRect(0.0022, 0.0022, L - 0.0044, W - 0.0044);
        } else {
          ctx.strokeStyle = rgba(seam, 0.5, 0.38);
          ctx.lineWidth = 0.0009;
          ctx.strokeRect(0, 0, L, W);
        }
      }
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
  drawAll(mctx, pw, ph, false);
  drawAll(bctx, bw, bh, true);
  for (const b of boards) { b.width = 0; b.height = 0; }
  return { map, bump, tileW, tileH };
}
