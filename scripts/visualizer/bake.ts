/**
 * Výpočet světla modelového bytu (globální osvětlení) → public/visualizer/bake-{day,evening}.bin.
 * Spusťte po každé změně geometrie nebo světel scény:  npm run bake:viz [day|evening]
 *
 * Postup: přímé světlo (slunce, obloha přes okenní otvory, svítidla) + několik iterací sběru
 * odraženého světla. Rovné plochy stavby mají lightmapu (texel 3 cm), nábytek světlo ve vrcholech.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { Worker } from "node:worker_threads";
import sharp from "sharp";
import * as THREE from "three";
import { MeshBVH, SAH } from "three-mesh-bvh";
import { buildApartment, roomIndexAt } from "../../src/components/visualizer/engine/apartment";
import { encodeBake } from "../../src/components/visualizer/engine/bakeFormat";
import type { BakeMeta } from "../../src/components/visualizer/engine/kit";
import { EXTERIOR, SUN_COLOR, SUN_DIR, SUN_E, SUN_RADIUS, type LightingMode } from "../../src/components/visualizer/engine/lighting";
import type { Bright, Job, ScenePack, Shared } from "./bake-shared";

const OUT = path.resolve("public/visualizer");
const sab = <T extends Float32Array | Int32Array | Uint32Array | Uint8Array>(C: { new (b: SharedArrayBuffer): T; BYTES_PER_ELEMENT: number }, n: number) => new C(new SharedArrayBuffer(Math.max(1, n) * C.BYTES_PER_ELEMENT));
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)} s]`, ...a);

async function loadExterior() {
  const { data, info } = await sharp(path.join(OUT, "exterior-s.jpg")).raw().toBuffer({ resolveWithObject: true });
  const px = new Float32Array(info.width * info.height * 3);
  for (let i = 0; i < px.length; i++) {
    const s = data[i] / 255;
    const t = Math.min(0.985, s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4));
    px[i] = t / (1 - t);
  }
  return { data: px, w: info.width, h: info.height };
}

function buildPack(apt: ReturnType<typeof buildApartment>) {
  const L = apt.layout;
  const meshes = [...L.lmMeshes, ...L.vtxMeshes];
  let nv = 0, ni = 0;
  for (const m of meshes) { nv += m.geometry.getAttribute("position").count; ni += m.geometry.index!.count; }
  const position = sab(Float32Array, nv * 3), normal = sab(Float32Array, nv * 3), index = sab(Uint32Array, ni);
  const vMesh = sab(Int32Array, nv), vPoint = sab(Int32Array, nv), vUV = sab(Float32Array, nv * 2);
  const mAlbedo = sab(Float32Array, meshes.length * 3), mGroup = sab(Uint8Array, meshes.length), mTransmit = sab(Float32Array, meshes.length), mTwoSided = sab(Uint8Array, meshes.length);

  // Vzorky: nejdřív texely lightmapy, pak vrcholy.
  const texelPoint = sab(Int32Array, L.atlasW * L.atlasH).fill(-1);
  const pts: number[] = [], nrm: number[] = [], two: number[] = [], area: number[] = [], pmesh: number[] = [];
  const P = new THREE.Vector3();
  L.charts.forEach((c, ci) => {
    if (ci === 0) return;
    const a = (c.u.length() * c.v.length()) / (c.cw * c.ch);
    for (let j = 0; j < c.ch; j++) for (let i = 0; i < c.cw; i++) {
      P.copy(c.o).addScaledVector(c.u, (i + 0.5) / c.cw).addScaledVector(c.v, (j + 0.5) / c.ch);
      texelPoint[(c.py + j) * L.atlasW + c.px + i] = pts.length / 3;
      pts.push(P.x, P.y, P.z); nrm.push(c.n.x, c.n.y, c.n.z); two.push(0); area.push(a); pmesh.push(c.mesh);
    }
  });
  const nLm = pts.length / 3;
  // Okraje map (2 texely) → nejbližší texel mapy, aby zásah na hraně nesáhl do prázdna.
  for (const c of L.charts.slice(1)) {
    for (let j = -2; j < c.ch + 2; j++) for (let i = -2; i < c.cw + 2; i++) {
      if (i >= 0 && j >= 0 && i < c.cw && j < c.ch) continue;
      const x = c.px + i, y = c.py + j;
      if (x < 0 || y < 0 || x >= L.atlasW || y >= L.atlasH || texelPoint[y * L.atlasW + x] >= 0) continue;
      texelPoint[y * L.atlasW + x] = texelPoint[(c.py + Math.min(c.ch - 1, Math.max(0, j))) * L.atlasW + c.px + Math.min(c.cw - 1, Math.max(0, i))];
    }
  }

  let vo = 0, io = 0;
  meshes.forEach((m, mi) => {
    const g = m.geometry;
    const mat = m.material as THREE.MeshStandardMaterial;
    const meta = mat.userData as BakeMeta;
    const alb = meta.albedo ?? [mat.color.r, mat.color.g, mat.color.b];
    mAlbedo.set(alb, mi * 3);
    mGroup[mi] = meta.group === "floor" ? 1 : meta.group === "wall" ? 2 : 0;
    mTransmit[mi] = meta.transmit ?? 0;
    mTwoSided[mi] = mat.side === THREE.DoubleSide ? 1 : 0;
    const p = g.getAttribute("position") as THREE.BufferAttribute, n = g.getAttribute("normal") as THREE.BufferAttribute;
    const lm = mi < L.lmMeshes.length;
    const uv = lm ? (g.getAttribute("bkuv") as THREE.BufferAttribute) : null;
    // Plocha připadající na vrchol (třetina přilehlých trojúhelníků).
    const va = new Float32Array(p.count);
    if (!lm) {
      const ia = g.index!.array, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
      for (let t = 0; t < ia.length; t += 3) {
        A.fromBufferAttribute(p, ia[t]); B.fromBufferAttribute(p, ia[t + 1]); C.fromBufferAttribute(p, ia[t + 2]);
        const ar = B.sub(A).cross(C.sub(A)).length() / 6;
        va[ia[t]] += ar; va[ia[t + 1]] += ar; va[ia[t + 2]] += ar;
      }
    }
    for (let k = 0; k < p.count; k++) {
      position.set([p.getX(k), p.getY(k), p.getZ(k)], (vo + k) * 3);
      normal.set([n.getX(k), n.getY(k), n.getZ(k)], (vo + k) * 3);
      vMesh[vo + k] = mi;
      if (uv) { vPoint[vo + k] = -1; vUV[(vo + k) * 2] = uv.getX(k); vUV[(vo + k) * 2 + 1] = uv.getY(k); }
      else {
        vPoint[vo + k] = pts.length / 3;
        pts.push(p.getX(k), p.getY(k), p.getZ(k)); nrm.push(n.getX(k), n.getY(k), n.getZ(k)); two.push((meta.transmit ?? 0) > 0 ? 1 : 0);
        area.push(va[k]); pmesh.push(mi);
      }
    }
    const ix = g.index!.array;
    for (let k = 0; k < ix.length; k++) index[io + k] = ix[k] + vo;
    vo += p.count; io += ix.length;
  });

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geom.setIndex(new THREE.BufferAttribute(index, 1));
  const bvh = new MeshBVH(geom, { strategy: SAH, targetLeafSize: 6, useSharedArrayBuffer: true } as never);
  const ser = MeshBVH.serialize(bvh, { cloneBuffers: false });
  if (ser.index !== index) throw new Error("BVH index not shared");
  if (ser.roots.length !== 1) throw new Error("expected a single BVH root");
  // Předpočítané trojúhelníky pro rychlý průsečík (Möller–Trumbore) a orientace podle normál vrcholů.
  const nt = ni / 3;
  const tri = sab(Float32Array, nt * 9), triSign = new Int8Array(new SharedArrayBuffer(nt));
  for (let t = 0; t < nt; t++) {
    const a = index[t * 3], b = index[t * 3 + 1], c = index[t * 3 + 2];
    for (let k = 0; k < 3; k++) {
      tri[t * 9 + k] = position[a * 3 + k];
      tri[t * 9 + 3 + k] = position[b * 3 + k] - position[a * 3 + k];
      tri[t * 9 + 6 + k] = position[c * 3 + k] - position[a * 3 + k];
    }
    const e1 = [tri[t * 9 + 3], tri[t * 9 + 4], tri[t * 9 + 5]], e2 = [tri[t * 9 + 6], tri[t * 9 + 7], tri[t * 9 + 8]];
    const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    let d = 0;
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) d += g[k] * normal[v * 3 + k];
    triSign[t] = d < 0 ? -1 : 1;
  }

  const nPoints = pts.length / 3;
  const pPos = sab(Float32Array, nPoints * 3), pNor = sab(Float32Array, nPoints * 3), pTwo = sab(Uint8Array, nPoints);
  pPos.set(pts); pNor.set(nrm); pTwo.set(two);
  const pArea = sab(Float32Array, nPoints), pMesh = sab(Int32Array, nPoints), pRoom = new Int8Array(new SharedArrayBuffer(nPoints));
  pArea.set(area); pMesh.set(pmesh);
  for (let i = 0; i < nPoints; i++) pRoom[i] = roomIndexAt(pts[i * 3] + nrm[i * 3] * 0.05, pts[i * 3 + 2] + nrm[i * 3 + 2] * 0.05);
  log(`scéna: ${meshes.length} meshů, ${nv} vrcholů, ${ni / 3} trojúhelníků; vzorky: ${nLm} texelů (atlas ${L.atlasW}×${L.atlasH}) + ${nPoints - nLm} vrcholů`);
  return {
    position, normal, index, bvhRoots: ser.roots as ArrayBuffer[], tri, triSign, vMesh, vPoint, vUV, mAlbedo, mGroup, mTransmit, mTwoSided,
    pPos, pNor, pTwo, pArea, pRoom, pMesh, nPoints, atlasW: L.atlasW, atlasH: L.atlasH, texelPoint,
  };
}

async function runStage(workers: Worker[], n: number, make: (from: number, to: number) => Job, label: string) {
  const CH = 1500;
  let next = 0, done = 0, lastLog = Date.now();
  await new Promise<void>((resolve) => {
    const feed = (w: Worker) => {
      if (next >= n) return;
      const from = next, to = Math.min(n, next + CH);
      next = to;
      w.postMessage(make(from, to));
    };
    for (const w of workers) {
      w.removeAllListeners("message");
      w.on("message", (m: { done: number }) => {
        done += m.done;
        if (Date.now() - lastLog > 15000) { lastLog = Date.now(); log(`  ${label}: ${((done / n) * 100).toFixed(0)} %`); }
        if (done >= n) resolve(); else feed(w);
      });
      feed(w);
    }
  });
  log(`${label} hotovo`);
}

/* ---------------- dočištění: doplnění neplatných vzorků a vyhlazení šumu */

function smoothVertices(g: THREE.BufferGeometry, layers: Float32Array[], invalid: Uint8Array, first: number) {
  const n = g.getAttribute("position").count;
  const pos = g.getAttribute("position") as THREE.BufferAttribute, nor = g.getAttribute("normal") as THREE.BufferAttribute;
  // Sousedé přes trojúhelníky + vrcholy ve stejném místě (švy mezi stěnami dílu).
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set());
  const ix = g.index!.array;
  for (let t = 0; t < ix.length; t += 3) for (const [a, b] of [[ix[t], ix[t + 1]], [ix[t + 1], ix[t + 2]], [ix[t + 2], ix[t]]]) { nb[a].add(b); nb[b].add(a); }
  const key = (i: number) => `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
  const same = new Map<string, number[]>();
  for (let i = 0; i < n; i++) { const k = key(i); const a = same.get(k); if (a) a.push(i); else same.set(k, [i]); }
  for (const ids of same.values()) for (const a of ids) for (const b of ids) if (a !== b) nb[a].add(b);
  const dot = (a: number, b: number) => nor.getX(a) * nor.getX(b) + nor.getY(a) * nor.getY(b) + nor.getZ(a) * nor.getZ(b);
  const ok = new Uint8Array(n);
  for (let i = 0; i < n; i++) ok[i] = invalid[first + i] ? 0 : 1;
  // Doplnění neplatných vrcholů z platných sousedů (vlna po vlně).
  for (let it = 0; it < 40; it++) {
    const fill: number[] = [];
    for (let i = 0; i < n; i++) if (!ok[i]) { for (const j of nb[i]) if (ok[j]) { fill.push(i); break; } }
    if (!fill.length) break;
    for (const i of fill) for (const L of layers) for (let c = 0; c < 3; c++) {
      let s = 0, w = 0;
      for (const j of nb[i]) if (ok[j]) { s += L[(first + j) * 3 + c]; w++; }
      L[(first + i) * 3 + c] = s / w;
    }
    for (const i of fill) ok[i] = 1;
  }
  // Vyhlazení (sousedé s podobnou normálou).
  for (let it = 0; it < 2; it++) {
    for (const L of layers) {
      const src = L.slice(first * 3, (first + n) * 3);
      for (let i = 0; i < n; i++) {
        let w = 1;
        const acc = [src[i * 3], src[i * 3 + 1], src[i * 3 + 2]];
        for (const j of nb[i]) {
          if (dot(i, j) < 0.7) continue;
          acc[0] += src[j * 3] * 0.6; acc[1] += src[j * 3 + 1] * 0.6; acc[2] += src[j * 3 + 2] * 0.6; w += 0.6;
        }
        for (let c = 0; c < 3; c++) L[(first + i) * 3 + c] = acc[c] / w;
      }
    }
  }
}

function blurChart(src: Float32Array, valid: Uint8Array, w: number, h: number, sigma: number) {
  const r = Math.ceil(sigma * 2.5);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const tmp = new Float32Array(src.length), tw = new Float32Array(w * h), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s0 = 0, s1 = 0, s2 = 0, sw = 0;
    for (let d = -r; d <= r; d++) { const xx = x + d; if (xx < 0 || xx >= w || !valid[y * w + xx]) continue; const q = (y * w + xx) * 3, kw = k[d + r]; s0 += src[q] * kw; s1 += src[q + 1] * kw; s2 += src[q + 2] * kw; sw += kw; }
    const o = (y * w + x) * 3;
    tw[y * w + x] = sw;
    if (sw > 0) { tmp[o] = s0 / sw; tmp[o + 1] = s1 / sw; tmp[o + 2] = s2 / sw; }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s0 = 0, s1 = 0, s2 = 0, sw = 0;
    for (let d = -r; d <= r; d++) { const yy = y + d; if (yy < 0 || yy >= h || tw[yy * w + x] <= 0) continue; const q = (yy * w + x) * 3, kw = k[d + r]; s0 += tmp[q] * kw; s1 += tmp[q + 1] * kw; s2 += tmp[q + 2] * kw; sw += kw; }
    const o = (y * w + x) * 3;
    if (sw > 0) { out[o] = s0 / sw; out[o + 1] = s1 / sw; out[o + 2] = s2 / sw; }
  }
  return out;
}

/** Rozdělení slunečních skvrn pro přímé vzorkování odrazu (výkon = jas × plocha). */
function buildBright(pack: ScenePack, S: Shared): Bright | null {
  const ids: number[] = [];
  for (let i = 0; i < pack.nPoints; i++) if (!S.invalid[i] && S.eSun[i * 3] + S.eSun[i * 3 + 1] + S.eSun[i * 3 + 2] > 1e-5) ids.push(i);
  if (!ids.length) return null;
  const nb = ids.length;
  const sab64 = (k: number) => new Float64Array(new SharedArrayBuffer(Math.max(1, k) * 8));
  const B: Bright = {
    idx: sab(Int32Array, nb), w: sab(Float32Array, nb), cdf: sab64(nb), W: 0, L: sab(Float32Array, nb * 3), E: sab(Float32Array, nb * 3),
    room: new Int8Array(new SharedArrayBuffer(nb)), roomStart: sab(Int32Array, 5), roomList: sab(Int32Array, nb), roomCdf: sab64(nb), roomW: sab64(4),
  };
  let acc = 0;
  ids.forEach((q, b) => {
    const m = pack.pMesh[q];
    for (let c = 0; c < 3; c++) { B.E[b * 3 + c] = S.eSun[q * 3 + c]; B.L[b * 3 + c] = (pack.mAlbedo[m * 3 + c] * S.eSun[q * 3 + c]) / Math.PI; }
    const w = (0.2126 * B.L[b * 3] + 0.7152 * B.L[b * 3 + 1] + 0.0722 * B.L[b * 3 + 2]) * pack.pArea[q] + 1e-9;
    B.idx[b] = q; B.w[b] = w; B.room[b] = pack.pRoom[q];
    acc += w; B.cdf[b] = acc;
  });
  B.W = acc;
  for (let b = 0; b < nb; b++) B.cdf[b] /= acc;
  // Po místnostech.
  let o = 0;
  for (let r = 0; r < 4; r++) {
    B.roomStart[r] = o;
    let ra = 0;
    const s0 = o;
    for (let b = 0; b < nb; b++) if (B.room[b] === r) { B.roomList[o] = b; ra += B.w[b]; B.roomCdf[o] = ra; o++; }
    for (let k = s0; k < o; k++) B.roomCdf[k] /= ra || 1;
    B.roomW[r] = ra;
  }
  B.roomStart[4] = o;
  return B;
}

async function bakeMode(mode: LightingMode, apt: ReturnType<typeof buildApartment>, base: ReturnType<typeof buildPack>) {
  const ext = await loadExterior();
  const tint = mode === "day" ? [1, 1, 1] : EXTERIOR.evening;
  // „Šedý svět“: průměrná barva výhledu (váha podle prostorového úhlu) se posune k neutrální —
  // obloha zůstane modrá a zeleň zelená, ale celek nebarví byt (jako vyvážení bílé ve fotoaparátu).
  const avg = [0, 0, 0];
  let wsum = 0;
  for (let y = 0; y < ext.h; y++) {
    const elev = EXTERIOR.elevMax - ((y + 0.5) / ext.h) * (EXTERIOR.elevMax - EXTERIOR.elevMin);
    const w = Math.cos((elev * Math.PI) / 180);
    for (let x = 0; x < ext.w; x++) for (let c = 0; c < 3; c++) avg[c] += ext.data[(y * ext.w + x) * 3 + c] * w;
    wsum += w * ext.w;
  }
  const al = 0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2];
  const gain = avg.map((a) => Math.pow(al / Math.max(1e-6, a), 0.85));
  log(`výhled: průměr ${avg.map((a) => (a / wsum).toFixed(3)).join(" ")}, vyvážení ${gain.map((g) => g.toFixed(2)).join(" ")}`);
  for (let i = 0; i < ext.data.length; i += 3) {
    const d = ext.data;
    for (let c = 0; c < 3; c++) d[i + c] *= gain[c];
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    for (let c = 0; c < 3; c++) d[i + c] = (l + (d[i + c] - l) * EXTERIOR.bakeSaturation) * EXTERIOR.radiance * tint[c];
  }
  const sd = new THREE.Vector3(...SUN_DIR).normalize();
  const pack: ScenePack = {
    ...base,
    ext: { ...ext, thetaMin: EXTERIOR.thetaMin, thetaMax: EXTERIOR.thetaMax, elevMin: EXTERIOR.elevMin, elevMax: EXTERIOR.elevMax },
    sun: mode === "day" ? { dir: [sd.x, sd.y, sd.z], e: SUN_COLOR.map((c) => c * SUN_E), radius: SUN_RADIUS } : null,
    emitters: apt.emitters.filter((e) => e.mode === "always" || mode === "evening").map((e) => ({ pos: e.pos.toArray(), dir: e.dir ? e.dir.toArray() : null, exp: e.exp, radius: e.radius, color: [e.color.r, e.color.g, e.color.b], intensity: e.intensity })),
    portals: apt.portals.map((p) => ({ o: p.o.toArray(), u: p.u.toArray(), v: p.v.toArray(), n: p.n.toArray(), area: p.u.length() * p.v.length() })),
  };
  const n = pack.nPoints;
  const S: Shared = {
    pack, eDirect: sab(Float32Array, n * 3), eSunFront: sab(Float32Array, n * 3), eSun: sab(Float32Array, n * 3), bright: null,
    ePrev: sab(Float32Array, n * 3), eNext: sab(Float32Array, n * 3), dF: sab(Float32Array, n * 3), dW: sab(Float32Array, n * 3), invalid: sab(Uint8Array, n),
  };
  const nw = Math.max(1, Math.min(os.cpus().length, 4));
  // Vlákno se spouští přes tsx (TypeScript) — registrace načítání .ts a pak samotný soubor vlákna.
  const boot = `require("tsx/cjs"); require(${JSON.stringify(path.join(__dirname, "bake-worker.ts"))});`;
  const spawn = () => Array.from({ length: nw }, () => new Worker(boot, { eval: true, workerData: S }));
  log(`${mode}: ${nw} vláken`);
  let workers = spawn();
  await runStage(workers, n, (from, to) => ({ kind: "direct", from, to, seed: 1 }), `${mode} přímé světlo`);
  await Promise.all(workers.map((w) => w.terminate()));
  S.bright = buildBright(pack, S);
  if (S.bright) log(`sluneční skvrny: ${S.bright.idx.length} osvětlených vzorků`);
  workers = spawn();
  // Paprsky sbírají jen světlo bez přímého slunce (to přidávají sluneční skvrny zvlášť).
  const rest = (src: Float32Array) => { for (let i = 0; i < n * 3; i++) S.ePrev[i] = Math.max(0, src[i] - S.eSun[i]); };
  rest(S.eDirect);
  const schedule = process.env.BAKE_QUICK ? [16, 36] : [36, 49, 64, 196];
  for (let it = 0; it < schedule.length; it++) {
    const final = it === schedule.length - 1;
    await runStage(workers, n, (from, to) => ({ kind: "gather", from, to, seed: 100 + it, rays: schedule[it], final }), `${mode} odraz ${it + 1}/${schedule.length} (${schedule[it]} paprsků)`);
    if (!final) rest(S.eNext);
  }
  await Promise.all(workers.map((w) => w.terminate()));

  // L0 = vše kromě přímého slunce na přivrácené straně (to kreslí scéna sama se stínovou mapou).
  const l0 = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) l0[i] = Math.max(0, S.eNext[i] - S.eSunFront[i]);
  const layers = [l0, S.dF, S.dW];
  let bad = 0;
  for (let i = 0; i < n; i++) bad += S.invalid[i];
  log(`neplatných vzorků (uvnitř těles): ${bad} z ${n}`);

  /* ---- lightmapa */
  const L = apt.layout;
  const AW = L.atlasW, AH = L.atlasH;
  const full = { l0: new Float32Array(AW * AH * 3), df: new Float32Array(AW * AH * 3), dw: new Float32Array(AW * AH * 3) };
  const tp = base.texelPoint;
  L.charts.forEach((c, ci) => {
    const w = c.cw, h = c.ch;
    const valid = new Uint8Array(w * h);
    const chartLayers = layers.map(() => new Float32Array(w * h * 3));
    if (ci === 0) {
      for (const cl of chartLayers) cl.fill(0.15);
    } else {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const p = tp[(c.py + j) * AW + c.px + i];
        valid[j * w + i] = S.invalid[p] ? 0 : 1;
        layers.forEach((Lr, li) => { for (let k = 0; k < 3; k++) chartLayers[li][(j * w + i) * 3 + k] = Lr[p * 3 + k]; });
      }
      if (!valid.some((v) => v)) valid.fill(1);
    }
        // Podlaha má jemné texely (kontaktní stíny), stěny a strop se vyhladí víc — šum je na hladké ploše vidět.
    const floor = (apt.layout.lmMeshes[c.mesh]?.material as THREE.Material | undefined)?.userData.group === "floor";
    const blurred = ci === 0 ? chartLayers : chartLayers.map((cl, li) => blurChart(cl, valid, w, h, li === 0 ? (floor ? 1.1 : 1.7) : 2.5));
    const dst = [full.l0, full.df, full.dw];
    // Včetně okraje 2 texely (kopie krajních hodnot kvůli bilineárnímu filtrování).
    for (let j = -2; j < h + 2; j++) for (let i = -2; i < w + 2; i++) {
      const x = c.px + i, y = c.py + j;
      if (x < 0 || y < 0 || x >= AW || y >= AH) continue;
      const si = Math.min(w - 1, Math.max(0, i)), sj = Math.min(h - 1, Math.max(0, j));
      for (let li = 0; li < 3; li++) for (let k = 0; k < 3; k++) dst[li][(y * AW + x) * 3 + k] = blurred[li][(sj * w + si) * 3 + k];
    }
  });
  const half = (src: Float32Array) => {
    const out = new Float32Array((AW / 2) * (AH / 2) * 3);
    for (let y = 0; y < AH / 2; y++) for (let x = 0; x < AW / 2; x++) for (let k = 0; k < 3; k++) {
      const s = (xx: number, yy: number) => src[(yy * AW + xx) * 3 + k];
      out[(y * (AW / 2) + x) * 3 + k] = (s(2 * x, 2 * y) + s(2 * x + 1, 2 * y) + s(2 * x, 2 * y + 1) + s(2 * x + 1, 2 * y + 1)) / 4;
    }
    return out;
  };

  /* ---- vrcholy */
  let first = L.charts.slice(1).reduce((a, c) => a + c.cw * c.ch, 0);
  const vtx: { l0: Uint16Array; df: Uint16Array; dw: Uint16Array }[] = [];
  // Half-float se zaokrouhlenou mantisou (L0 na 8 bitů = 0,4 %, odražené světlo na 6 bitů): nejnižší bity
  // nesou jen šum, který by zhoršoval kompresi.
  const hf = (a: Float32Array, keep = 8) => {
    const o = new Uint16Array(a.length), drop = 10 - keep, half = drop > 0 ? 1 << (drop - 1) : 0, mask = 0xffff ^ ((1 << drop) - 1);
    for (let i = 0; i < a.length; i++) { const h = THREE.DataUtils.toHalfFloat(Math.min(60000, Math.max(0, a[i]))); o[i] = Math.min(0x7bff, (h + half) & mask); }
    return o;
  };
  for (const m of L.vtxMeshes) {
    const cnt = m.geometry.getAttribute("position").count;
    smoothVertices(m.geometry, layers, S.invalid, first);
    vtx.push({ l0: hf(l0.slice(first * 3, (first + cnt) * 3)), df: hf(S.dF.slice(first * 3, (first + cnt) * 3), 6), dw: hf(S.dW.slice(first * 3, (first + cnt) * 3), 6) });
    first += cnt;
  }
  const bin = encodeBake({ hash: L.hash, atlasW: AW, atlasH: AH, atlas: { l0: hf(full.l0), df: hf(half(full.df), 6), dw: hf(half(full.dw), 6) }, vtx });
  const gz = zlib.gzipSync(bin, { level: 9 });
  const file = path.join(OUT, `bake-${mode}.bin`);
  fs.writeFileSync(file, gz);
  log(`${file}: ${(bin.length / 1e6).toFixed(1)} MB → gzip ${(gz.length / 1e6).toFixed(2)} MB`);
}

async function main() {
  const want = process.argv.slice(2).filter((a): a is LightingMode => a === "day" || a === "evening");
  const modes: LightingMode[] = want.length ? want : ["day", "evening"];
  const apt = buildApartment();
  const base = buildPack(apt);
  for (const m of modes) await bakeMode(m, apt, base);
  log("hotovo");
}

main().catch((e) => { console.error(e); process.exit(1); });
