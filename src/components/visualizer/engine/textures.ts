import * as THREE from "three";
import { rng } from "./noise";

/**
 * Procedurální textury materiálů (látky, dřevo, omítka, kámen, listy). Vše je dlaždicové (bez švů),
 * generuje se jednou při startu a sdílí se. V Node (výpočet světla) se nevytvářejí — vrací null.
 * Měřítko: UV geometrie jsou v metrech, `repeat` textury = 1 / velikost dlaždice.
 */

const HEADLESS = typeof document === "undefined";
const cache = new Map<string, THREE.Texture | null>();
const cached = (key: string, make: () => THREE.Texture) => {
  if (HEADLESS) return null;
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
};

/** Dlaždicový hodnotový šum: mřížka s periodou `p` buněk (souřadnice v buňkách). */
function tileNoise(seed: number, p: number) {
  const R = rng(seed);
  const v = new Float32Array(p * p);
  for (let i = 0; i < v.length; i++) v[i] = R();
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const a = ((xi % p) + p) % p, b = ((yi % p) + p) % p, a1 = (a + 1) % p, b1 = (b + 1) % p;
    const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
    const v00 = v[b * p + a], v10 = v[b * p + a1], v01 = v[b1 * p + a], v11 = v[b1 * p + a1];
    return v00 + (v10 - v00) * u + (v01 - v00) * w + (v00 - v10 - v01 + v11) * u * w;
  };
}

/** fbm z dlaždicového šumu; x, y v rozsahu 0–1 přes celou dlaždici. */
function tileFbm(seed: number, base: number, oct: number) {
  const ns = Array.from({ length: oct }, (_, o) => ({ n: tileNoise(seed + o * 131, base << o), f: base << o }));
  return (x: number, y: number) => {
    let s = 0, a = 0.5, nrm = 0;
    for (const { n, f } of ns) { s += n(x * f, y * f) * a; nrm += a; a *= 0.5; }
    return s / nrm;
  };
}

function toTexture(w: number, h: number, fill: (d: Uint8ClampedArray) => void, srgb: boolean, repeat = 1) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  fill(img.data);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.repeat.setScalar(repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Normálová mapa z výškového pole (dlaždicové rozdíly). */
function normalFrom(hf: Float32Array, w: number, h: number, strength: number) {
  return toTexture(w, h, (d) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const hx = hf[y * w + ((x + 1) % w)] - hf[y * w + ((x - 1 + w) % w)];
      const hy = hf[((y + 1) % h) * w + x] - hf[((y - 1 + h) % h) * w + x];
      let nx = -hx * strength, ny = hy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const o = (y * w + x) * 4;
      d[o] = (nx * 0.5 + 0.5) * 255; d[o + 1] = (ny * 0.5 + 0.5) * 255; d[o + 2] = (nz * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
  }, false);
}

export interface MapPair { map: THREE.Texture | null; normal: THREE.Texture | null; rough?: THREE.Texture | null }

/* ------------------------------------------------------------------ látky */

export type FabricKind = "weave" | "linen" | "boucle" | "velvet" | "knit";

/**
 * Látka: dlaždice 25 cm. Mapa barvy je šedá kolem ~0,93 (násobí barvu materiálu), normála nese
 * vazbu nití, nopky / žmolky a jemné zvlnění.
 */
export function fabric(kind: FabricKind): MapPair {
  const S = 256;
  const make = () => {
    const seed = { weave: 11, linen: 23, boucle: 37, velvet: 41, knit: 47 }[kind];
    const low = tileFbm(seed, 4, 3), mid = tileFbm(seed + 7, 16, 3), fine = tileNoise(seed + 3, 128);
    const hf = new Float32Array(S * S), al = new Float32Array(S * S);
    const threads = kind === "linen" ? 64 : kind === "weave" ? 80 : 48;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const tx = u * threads, ty = v * threads;
      const warp = Math.sin(tx * Math.PI * 2) * 0.5 + 0.5, weft = Math.sin(ty * Math.PI * 2) * 0.5 + 0.5;
      const cell = (Math.floor(tx) + Math.floor(ty)) & 1;
      let h: number, a: number;
      if (kind === "knit") {
        // Hrubý pletený vzor: sloupky „V“ ze dvou šikmých oček.
        const cx = u * 18, cy = v * 24;
        const fu = cx - Math.floor(cx), fv = cy - Math.floor(cy);
        const lobe = (c: number) => Math.exp(-Math.pow((fu - c) / 0.17, 2)) * Math.pow(Math.sin(Math.PI * fv), 0.6);
        const hv = Math.max(lobe(0.3 + (fv - 0.5) * 0.3), lobe(0.7 - (fv - 0.5) * 0.3));
        h = hv * 1.6 + mid(u, v) * 0.2; a = 0.8 + hv * 0.2 - (low(u, v) - 0.5) * 0.05;
      } else if (kind === "boucle") {
        const b = fine(u * 128, v * 128);
        h = Math.pow(b, 2) * 1.4 + mid(u, v) * 0.6; a = 0.9 + b * 0.1 - (mid(u, v) - 0.5) * 0.06;
      } else if (kind === "velvet") {
        h = mid(u, v) * 0.5 + low(u, v) * 0.8; a = 0.93 + (low(u, v) - 0.5) * 0.08;
      } else {
        const slub = kind === "linen" ? Math.pow(fine(u * 128, v * 2 + 0.3), 3) * 0.8 : 0;
        h = (cell ? warp : weft) * 0.7 + slub + low(u, v) * 0.35;
        a = 0.9 + (cell ? warp : weft) * 0.06 + slub * 0.06 - (low(u, v) - 0.5) * 0.06;
      }
      hf[y * S + x] = h; al[y * S + x] = Math.min(1, a);
    }
    const map = toTexture(S, S, (d) => { for (let i = 0; i < S * S; i++) { const g = al[i] * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g; d[i * 4 + 3] = 255; } }, true);
    const normal = normalFrom(hf, S, S, kind === "velvet" ? 1.2 : kind === "knit" ? 3.5 : 2.2);
    return { map, normal };
  };
  if (HEADLESS) return { map: null, normal: null };
  const k = `fabric-${kind}`;
  if (!cache.has(k)) { const r = make(); cache.set(k, r.map); cache.set(`${k}-n`, r.normal); }
  return { map: cache.get(k)!, normal: cache.get(`${k}-n`)! };
}
/** Průměr mapy látky (pro výpočet světla bez textur). */
export const FABRIC_MEAN = 0.93;

/* ------------------------------------------------------------------ omítka */

/** Malířská omítka: dlaždice 80 cm, jemná „pomerančová kůra“ válečku a nepatrné kolísání odstínu. */
export function plaster(): MapPair {
  if (HEADLESS) return { map: null, normal: null };
  if (!cache.has("plaster")) {
    const S = 256;
    const peel = tileFbm(5, 32, 3), roll = tileFbm(9, 4, 3), tone = tileFbm(13, 2, 3);
    const hf = new Float32Array(S * S);
    const al = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      hf[y * S + x] = peel(u, v) * 0.9 + roll(u * 1, v) * 0.4;
      al[y * S + x] = 0.985 + (tone(u, v) - 0.5) * 0.03 + (peel(u, v) - 0.5) * 0.012;
    }
    cache.set("plaster", toTexture(S, S, (d) => { for (let i = 0; i < S * S; i++) { const g = Math.min(255, al[i] * 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g; d[i * 4 + 3] = 255; } }, true));
    cache.set("plaster-n", normalFrom(hf, S, S, 1.1));
  }
  return { map: cache.get("plaster")!, normal: cache.get("plaster-n")! };
}

/* ------------------------------------------------------------------ dřevo */

export type WoodTone = "oak" | "oakLight" | "walnut";
const WOOD: Record<WoodTone, [number, number, number][]> = {
  oak: [[214, 176, 128], [184, 140, 94], [132, 94, 58]],
  oakLight: [[232, 208, 170], [210, 180, 138], [164, 128, 88]],
  walnut: [[150, 110, 80], [108, 74, 52], [64, 42, 28]],
};

/** Kresba dřeva (tón 0–1, póry, letokruhy) — počítá se jednou a jen se přebarvuje podle druhu. */
let grain: { t: Float32Array; pore: Float32Array; late: Float32Array; W: number; H: number } | null = null;
function woodGrain() {
  if (grain) return grain;
  const W = 512, H = 256;
  const R = rng(97);
  const warp = tileFbm(71, 4, 4), pores = tileNoise(73, 256), fig = tileFbm(79, 8, 3), streak = tileFbm(83, 2, 3);
  const t = new Float32Array(W * H), pore = new Float32Array(W * H), late = new Float32Array(W * H);
  const boards = 5; // pruhy různých fošen napříč
  const offs = Array.from({ length: boards }, () => [R() * 10, 0.6 + R() * 0.8, R() - 0.5]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const bi = Math.min(boards - 1, Math.floor(v * boards));
    const [o, f, sh] = offs[bi];
    const r = (v * boards - bi) * f * 7 + o + (warp(u, v) - 0.5) * 3.2 + Math.sin(u * Math.PI * 2 + o) * 0.35;
    const ring = r - Math.floor(r);
    const lt = Math.pow(Math.max(0, Math.sin(ring * Math.PI)), 6);
    const pr = Math.pow(pores(u * 256, v * 48), 6);
    const i = y * W + x;
    t[i] = Math.min(1, Math.max(0, 0.42 + lt * 0.26 + (fig(u, v) - 0.5) * 0.3 + (streak(u, v) - 0.5) * 0.25 + sh * 0.14 + pr * 0.25));
    pore[i] = pr; late[i] = lt;
  }
  grain = { t, pore, late, W, H };
  return grain;
}

/** Dýha: dlaždice 1 × 0,5 m, léta podél U; mapa barvy + drsnost (póry matnější). */
export function wood(tone: WoodTone): MapPair {
  if (HEADLESS) return { map: null, normal: null, rough: null };
  const k = `wood-${tone}`;
  if (!cache.has(k)) {
    const { t, pore, late, W, H } = woodGrain();
    const [light, base, dark] = WOOD[tone];
    const px = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const v = t[i];
      const c = v < 0.5 ? light.map((l, j) => l + (base[j] - l) * (v / 0.5)) : base.map((b, j) => b + (dark[j] - b) * ((v - 0.5) / 0.5));
      px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255;
    }
    cache.set(k, toTexture(W, H, (d) => d.set(px), true));
    if (!cache.has("wood-r")) {
      const rough = new Uint8ClampedArray(W * H * 4);
      const hf = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const rr = 150 + pore[i] * 90 + late[i] * 20;
        rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = rr; rough[i * 4 + 3] = 255;
        hf[i] = -pore[i] * 0.6 - late[i] * 0.15;
      }
      cache.set("wood-r", toTexture(W, H, (d) => d.set(rough), false));
      cache.set("wood-n", normalFrom(hf, W, H, 0.9));
    }
  }
  return { map: cache.get(k)!, normal: cache.get("wood-n")!, rough: cache.get("wood-r")! };
}
export const woodAlbedo = (tone: WoodTone) => WOOD[tone][1];

/* ------------------------------------------------------------------ kámen, obklad */

/** Křemenná deska: dlaždice 60 cm, drobná zrnka a jemné mraky. */
export function quartz() {
  return cached("quartz", () => {
    const S = 512;
    const cloud = tileFbm(91, 4, 4), grain = tileNoise(93, 256);
    return toTexture(S, S, (d) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const u = x / S, v = y / S;
        const g = grain(u * 256, v * 256);
        let l = 0.95 + (cloud(u, v) - 0.5) * 0.05;
        if (g > 0.93) l -= (g - 0.93) * 4;
        else if (g < 0.05) l -= 0.12;
        const i = (y * S + x) * 4;
        d[i] = l * 240; d[i + 1] = l * 238; d[i + 2] = l * 233; d[i + 3] = 255;
      }
    }, true);
  });
}

/** Velkoformátový obklad 60 × 120 cm v kamenném vzhledu se spárou (dlaždice 1,2 m = dva kusy). */
export function stoneTiles(): MapPair {
  if (HEADLESS) return { map: null, normal: null };
  if (!cache.has("tiles")) {
    const S = 512;
    const cloud = tileFbm(101, 4, 3), vein = tileFbm(103, 3, 4), speck = tileNoise(107, 256);
    const hf = new Float32Array(S * S);
    const px = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const gx = Math.min(u * 2 - Math.floor(u * 2), 1 - (u * 2 - Math.floor(u * 2))) * 600, gy = Math.min(v, 1 - v) * 1200;
      const groutD = Math.min(gx, gy); // mm od spáry
      const grout = groutD < 1.6;
      const vv = Math.abs(Math.sin((u * 1.3 + v * 0.7 + vein(u, v) * 1.6) * Math.PI * 3));
      let l = 0.93 + (cloud(u, v) - 0.5) * 0.08 - (1 - Math.min(1, vv / 0.04)) * 0.1 - Math.pow(speck(u * 256, v * 256), 12) * 0.2;
      if (grout) l = 0.78;
      const i = (y * S + x) * 4;
      px[i] = l * 228; px[i + 1] = l * 224; px[i + 2] = l * 216; px[i + 3] = 255;
      hf[y * S + x] = grout ? -1 : groutD < 4 ? -1 + (groutD - 1.6) / 2.4 : 0;
    }
    cache.set("tiles", toTexture(S, S, (d) => d.set(px), true));
    cache.set("tiles-n", normalFrom(hf, S, S, 1.5));
  }
  return { map: cache.get("tiles")!, normal: cache.get("tiles-n")! };
}

/* ------------------------------------------------------------------ listy */

/**
 * Atlas listů 2 × 2 (alpha): 0 = fíkus (velký, zvlněný okraj), 1 = oválný list, 2 = úzký list,
 * 3 = drobné lístky. Žilnatina v barvě, list svítí proti světlu díky oboustrannému materiálu.
 */
export function leafAtlas() {
  return cached("leaves", () => {
    const S = 512, c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    const R = rng(211);
    const leaf = (cx: number, cy: number, len: number, wid: number, wave: number, col: string, vein: string) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      const N = 40;
      for (let i = 0; i <= N; i++) { const t = i / N, y = -len / 2 + t * len, w = Math.sin(Math.PI * Math.pow(t, 0.8)) * wid * (1 + Math.sin(t * 18) * wave); ctx.lineTo(w, y); }
      for (let i = N; i >= 0; i--) { const t = i / N, y = -len / 2 + t * len, w = Math.sin(Math.PI * Math.pow(t, 0.8)) * wid * (1 + Math.sin(t * 18 + 1) * wave); ctx.lineTo(-w, y); }
      ctx.closePath();
      const g = ctx.createLinearGradient(-wid, 0, wid, 0);
      g.addColorStop(0, col); g.addColorStop(0.5, vein); g.addColorStop(1, col);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.globalAlpha = 0.25; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = vein; ctx.lineWidth = Math.max(1, wid * 0.05);
      ctx.beginPath(); ctx.moveTo(0, -len / 2); ctx.lineTo(0, len / 2); ctx.stroke();
      ctx.lineWidth = Math.max(0.6, wid * 0.02);
      for (let i = 1; i < 9; i++) { const y = -len / 2 + (i / 9) * len; ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(wid * 0.4, y - len * 0.05, wid * 0.8, y - len * 0.1); ctx.moveTo(0, y); ctx.quadraticCurveTo(-wid * 0.4, y - len * 0.05, -wid * 0.8, y - len * 0.1); ctx.stroke(); }
      ctx.restore();
    };
    ctx.clearRect(0, 0, S, S);
    leaf(128, 128, 230, 92, 0.05, "#3f5f2f", "#6f8f4f");
    leaf(384, 128, 220, 70, 0.0, "#4d6b37", "#7c9a58");
    leaf(128, 384, 236, 26, 0.0, "#48673a", "#86a36a");
    for (let i = 0; i < 7; i++) leaf(330 + R() * 110, 300 + R() * 170, 60 + R() * 30, 20 + R() * 8, 0, i % 2 ? "#577a3e" : "#4a6c36", "#86a066");
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}
