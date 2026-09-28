/**
 * Společná data výpočtu světla: scéna převedená na sdílená pole (SharedArrayBuffer), aby ji všechna
 * vlákna četla bez kopírování, a pomocné funkce (náhoda, výhled z oken).
 */

export interface Emit { pos: number[]; dir: number[] | null; exp: number; radius: number; color: number[]; intensity: number }
export interface PortalDef { o: number[]; u: number[]; v: number[]; n: number[]; area: number }

export interface ScenePack {
  /** Geometrie pro BVH: polohy vrcholů (svět) a index (po sestavení BVH přeuspořádaný). */
  position: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
  bvhRoots: ArrayBuffer[];
  /** Na trojúhelník (v pořadí BVH): vrchol a, hrany b−a, c−a; znaménko orientace normály. */
  tri: Float32Array;
  triSign: Int8Array;
  /** Na vrchol: číslo meshe, číslo vzorku (u meshů s vrcholy, jinak −1) a UV lightmapy. */
  vMesh: Int32Array;
  vPoint: Int32Array;
  vUV: Float32Array;
  /** Na mesh: albedo RGB, skupina (0 ostatní, 1 podlaha, 2 stěny), propustnost, oboustrannost. */
  mAlbedo: Float32Array;
  mGroup: Uint8Array;
  mTransmit: Float32Array;
  mTwoSided: Uint8Array;
  /** Vzorky: poloha, normála, oboustranné (záclony). */
  pPos: Float32Array;
  pNor: Float32Array;
  pTwo: Uint8Array;
  /** Plocha vzorku (m²) a místnost (−1 = mimo místnosti). */
  pArea: Float32Array;
  pRoom: Int8Array;
  pMesh: Int32Array;
  nPoints: number;
  atlasW: number;
  atlasH: number;
  /** Texel lightmapy → vzorek (−1 mimo mapy; okraje map vyplněné nejbližším vzorkem). */
  texelPoint: Int32Array;
  /** Výhled z oken v lineárních hodnotách (už vynásobený jasem pro daný režim). */
  ext: { data: Float32Array; w: number; h: number; thetaMin: number; thetaMax: number; elevMin: number; elevMax: number };
  sun: { dir: number[]; e: number[]; radius: number } | null;
  emitters: Emit[];
  portals: PortalDef[];
}

/**
 * Místa osvětlená přímým sluncem (sluneční skvrny) jako malé plošné zdroje: odražené světlo od nich
 * se vzorkuje přímo (jinak by náhodné paprsky dávaly flekatý strop). Výběr podle výkonu, v místnosti
 * bodu častěji (směs dvou rozdělení, pdf se počítá z obou).
 */
export interface Bright {
  idx: Int32Array;
  w: Float32Array;
  cdf: Float64Array;
  W: number;
  L: Float32Array;
  E: Float32Array;
  room: Int8Array;
  /** Pro místnost r: bright indexy roomList[roomStart[r] .. roomStart[r+1]) a jejich kumulativní rozdělení. */
  roomStart: Int32Array;
  roomList: Int32Array;
  roomCdf: Float64Array;
  roomW: Float64Array;
}

export interface Shared {
  pack: ScenePack;
  /** Výstupy / vstupy jednotlivých fází (RGB na vzorek). */
  eDirect: Float32Array;
  eSunFront: Float32Array;
  /** Přímé slunce (obě strany) — jeho odraz se sbírá přes Bright, ne paprsky. */
  eSun: Float32Array;
  bright: Bright | null;
  ePrev: Float32Array;
  eNext: Float32Array;
  dF: Float32Array;
  dW: Float32Array;
  invalid: Uint8Array;
}

export type Job =
  | { kind: "direct"; from: number; to: number; seed: number }
  | { kind: "gather"; from: number; to: number; seed: number; rays: number; final: boolean };

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jas výhledu ve směru d (bilineárně, mimo výřez se drží okraje). */
export function extRadiance(ext: ScenePack["ext"], dx: number, dy: number, dz: number, out: number[]) {
  let theta = (Math.atan2(dz, dx) * 180) / Math.PI;
  while (theta < ext.thetaMin) theta += 360;
  while (theta >= ext.thetaMin + 360) theta -= 360;
  const elev = (Math.asin(Math.max(-1, Math.min(1, dy))) * 180) / Math.PI;
  const u = Math.min(1, Math.max(0, (theta - ext.thetaMin) / (ext.thetaMax - ext.thetaMin)));
  const v = Math.min(1, Math.max(0, (ext.elevMax - elev) / (ext.elevMax - ext.elevMin)));
  const x = Math.min(ext.w - 1.001, Math.max(0, u * ext.w - 0.5)), y = Math.min(ext.h - 1.001, Math.max(0, v * ext.h - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const d = ext.data, w = ext.w;
  for (let c = 0; c < 3; c++) {
    const a = d[(y0 * w + x0) * 3 + c], b = d[(y0 * w + x0 + 1) * 3 + c], e = d[((y0 + 1) * w + x0) * 3 + c], f = d[((y0 + 1) * w + x0 + 1) * 3 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy;
  }
}
