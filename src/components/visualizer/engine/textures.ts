import * as THREE from "three";
import { runJob, TEXTURE_JOBS, woodAlbedo, type FabricKind, type RawSet, type RawTexture, type TextureJob, type TextureResult, type WoodTone } from "./textureGen";
import { rng } from "./noise";

/**
 * Procedurální textury materiálů (látky, dřevo, omítka, kámen, listy). Vše je dlaždicové (bez švů),
 * generuje se jednou při startu a sdílí se. Pixely počítá `textureGen.ts` ve Web Workeru
 * (`preloadTextures`), takže start neblokuje hlavní vlákno; když worker není k dispozici nebo
 * nestihl, vypočtou se tady při prvním použití. V Node (výpočet světla) se nevytvářejí — vrací null.
 * Měřítko: UV geometrie jsou v metrech, `repeat` textury = 1 / velikost dlaždice.
 */

export { woodAlbedo };
export type { FabricKind, WoodTone };

const HEADLESS = typeof document === "undefined";

export interface MapPair { map: THREE.Texture | null; normal: THREE.Texture | null; rough?: THREE.Texture | null }

const JOBS = new Map<string, TextureJob>(TEXTURE_JOBS.map((j) => [j.key, j]));
type Slot = keyof RawSet;
/** Textury podle úlohy. Do hotových se pixely doplní, až je worker (nebo záložní výpočet) dodá. */
const built = new Map<string, Partial<Record<Slot, THREE.DataTexture>>>();
/** Úlohy, jejichž pixely ještě chybí (zástupná textura 1 × 1). */
const missing = new Set<string>();

function fill(t: THREE.DataTexture, raw: RawTexture) {
  // Zástupná textura se mohla už nahrát do GPU (jiná velikost) — uvolnit, ať se nahraje znovu.
  if (t.version > 1) t.dispose();
  t.image = { data: raw.data, width: raw.w, height: raw.h };
  t.needsUpdate = true;
}

/**
 * Textury úlohy hned (bez čekání na pixely): zástupný pixel 1 × 1, který se doplní později. Tvar shaderu
 * závisí jen na tom, že textura existuje a jaký má barevný prostor, ne na velikosti ani obsahu — materiály
 * (a jejich shadery) se proto mohou stavět a překládat už během generování.
 */
function get(key: string) {
  let b = built.get(key);
  if (!b) {
    if (!started) void preloadTextures(); // kdo textury použije, ten je i dostane
    const job = JOBS.get(key)!;
    const slots: Slot[] = job.kind === "woodShared" ? ["rough", "normal"] : job.kind === "wood" || job.kind === "quartz" ? ["map"] : ["map", "normal"];
    b = {};
    for (const name of slots) {
      const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = 8;
      if (name === "map") t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      b[name] = t;
    }
    built.set(key, b);
    missing.add(key);
  }
  return b;
}

function deliver(key: string, set: RawSet) {
  const b = built.get(key);
  if (!b || !missing.delete(key)) return;
  for (const name of Object.keys(set) as Slot[]) if (b[name]) fill(b[name]!, set[name]!);
}

let preloading: Promise<void> | null = null;
let started = false;

/**
 * Spustí generování textur: pixely počítají Web Workery (po jednom na skupinu úloh, ať se využije
 * víc jader), hlavní vlákno zatím staví scénu. Vyřeší se, až jsou všechny textury hotové. Když worker
 * nejde spustit, zbytek se vypočte tady (po částech, ať stránka dýchá).
 */
export function preloadTextures(): Promise<void> {
  if (HEADLESS) return Promise.resolve();
  started = true;
  for (const j of TEXTURE_JOBS) get(j.key);
  preloading ??= new Promise<void>((resolve) => {
    const jobs = TEXTURE_JOBS.filter((j) => missing.has(j.key));
    if (!jobs.length) { resolve(); return; }
    const fallback = async () => {
      for (const j of jobs) {
        if (!missing.has(j.key)) continue;
        deliver(j.key, runJob(j));
        await new Promise((r) => setTimeout(r, 0));
      }
      resolve();
    };
    if (typeof Worker === "undefined") { void fallback(); return; }
    // Skupiny úloh se rozdělí mezi workery podle odhadu náročnosti (největší první do nejméně vytíženého);
    // počet workerů odpovídá jádrům, na dvoujádru je jen jeden.
    const workers = Math.max(1, Math.min(3, Math.floor((navigator.hardwareConcurrency || 4) / 2)));
    const groups = new Map<number, TextureJob[]>();
    for (const j of jobs) groups.set(j.group, [...(groups.get(j.group) ?? []), j]);
    const bins = Array.from({ length: workers }, () => ({ cost: 0, jobs: [] as TextureJob[] }));
    for (const g of [...groups.values()].sort((a, b) => b.reduce((n, j) => n + j.cost, 0) - a.reduce((n, j) => n + j.cost, 0))) {
      const bin = bins.reduce((m, b) => (b.cost < m.cost ? b : m));
      bin.jobs.push(...g);
      bin.cost += g.reduce((n, j) => n + j.cost, 0);
    }
    const byGroup = bins.filter((b) => b.jobs.length).map((b) => b.jobs);
    let open = byGroup.length;
    let failed = false;
    const done = () => { if (--open === 0) { if (failed) void fallback(); else resolve(); } };
    for (const list of byGroup) {
      let worker: Worker;
      try { worker = new Worker(new URL("./texWorker.ts", import.meta.url)); } catch { failed = true; done(); continue; }
      let left = list.length;
      const finish = () => { worker.terminate(); done(); };
      worker.onmessage = (e: MessageEvent<TextureResult>) => { deliver(e.data.key, e.data.set); if (--left === 0) finish(); };
      worker.onerror = () => { failed = true; finish(); };
      worker.postMessage(list);
    }
  });
  return preloading;
}

/* ------------------------------------------------------------------ látky */

/**
 * Látka: dlaždice 25 cm. Mapa barvy je šedá kolem ~0,93 (násobí barvu materiálu), normála nese
 * vazbu nití, nopky / žmolky a jemné zvlnění.
 */
export function fabric(kind: FabricKind): MapPair {
  if (HEADLESS) return { map: null, normal: null };
  const t = get(`fabric-${kind}`);
  return { map: t.map!, normal: t.normal! };
}
/** Průměr mapy látky (pro výpočet světla bez textur). */
export const FABRIC_MEAN = 0.93;

/** Malířská omítka: dlaždice 80 cm, jemná „pomerančová kůra“ válečku a nepatrné kolísání odstínu. */
export function plaster(): MapPair {
  if (HEADLESS) return { map: null, normal: null };
  const t = get("plaster");
  return { map: t.map!, normal: t.normal! };
}

/** Dýha: dlaždice 1 × 0,5 m, léta podél U; mapa barvy + drsnost (póry matnější). */
export function wood(tone: WoodTone): MapPair {
  if (HEADLESS) return { map: null, normal: null, rough: null };
  const shared = get("wood-shared");
  return { map: get(`wood-${tone}`).map!, normal: shared.normal!, rough: shared.rough! };
}

/** Křemenná deska: dlaždice 60 cm, drobná zrnka a jemné mraky. */
export function quartz() {
  return HEADLESS ? null : get("quartz").map!;
}

/** Velkoformátový obklad 60 × 120 cm v kamenném vzhledu se spárou (dlaždice 1,2 m = dva kusy). */
export function stoneTiles(): MapPair {
  if (HEADLESS) return { map: null, normal: null };
  const t = get("tiles");
  return { map: t.map!, normal: t.normal! };
}

/* ------------------------------------------------------------------ listy */

/**
 * Atlas listů 2 × 2 (alpha): 0 = fíkus (velký, zvlněný okraj), 1 = oválný list, 2 = úzký list,
 * 3 = drobné lístky. Žilnatina v barvě, list svítí proti světlu díky oboustrannému materiálu.
 */
let leaves: THREE.Texture | null = null;
export function leafAtlas() {
  if (HEADLESS) return null;
  return leaves ??= (() => {
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
  })();
}
