import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BakeMeta } from "./kit";

/**
 * Příprava scény pro předpočítané světlo — stejný, deterministický postup v prohlížeči i ve výpočtu:
 * 1. statické meshe se sloučí podle materiálu (méně vykreslovacích volání a jednoznačné pořadí vrcholů),
 * 2. rovné plochy stavby („lm“) dostanou mapy ve společném atlasu lightmapy (atribut bkuv).
 */

/** Velikost texelu lightmapy (m); podlaha má jemnější (userData.texel). */
export const TEXEL = 0.045;
export const ATLAS_W = 1024;
/** Mezera mezi mapami v atlasu: 2 texely okraje na každé straně (i pro poloviční rozlišení). */
const GUTTER = 4;

export interface Chart {
  /** Poloha levého dolního rohu v atlasu (texely, sudé) a rozměr (texely, sudé). */
  px: number; py: number; cw: number; ch: number;
  /** Světový roh, hrany (celá délka) a normála. */
  o: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3; n: THREE.Vector3;
  /** Index v lmMeshes (−1 u rezervované mapy 0). */
  mesh: number;
}

export interface BakeLayout {
  lmMeshes: THREE.Mesh[];
  vtxMeshes: THREE.Mesh[];
  charts: Chart[];
  atlasW: number;
  atlasH: number;
  hash: number;
}

export const bakeOf = (m: THREE.Material): NonNullable<BakeMeta["bake"]> => (m.userData as BakeMeta).bake ?? ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial ? "vtx" : "none");

function prepare(src: THREE.Mesh, lm: boolean) {
  const g = src.geometry.clone();
  g.applyMatrix4(src.matrixWorld);
  if (!g.index) g.setIndex([...Array(g.getAttribute("position").count).keys()]);
  const n = g.getAttribute("position").count;
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv", ...(lm ? ["lmq"] : [])].includes(k)) g.deleteAttribute(k);
  if (lm && !g.getAttribute("lmq")) throw new Error("lightmap mesh without lmq");
  g.clearGroups();
  return g;
}

/**
 * Sloučí statické meshe a rozvrhne lightmapu. `interior(p)` rozhoduje, zda je plocha vidět zevnitř
 * bytu (vnější fasáda a skryté čelní plochy stěn místo v atlasu nedostanou).
 */
export function finalizeScene(root: THREE.Object3D, interior: (p: THREE.Vector3) => boolean): BakeLayout {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { meshes: THREE.Mesh[]; lm: boolean }>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const kind = bakeOf(m.material);
    if (kind === "none") return;
    const key = `${kind}|${m.material.uuid}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${m.userData.overview ?? ""}|${m.renderOrder}`;
    let b = buckets.get(key);
    if (!b) { b = { meshes: [], lm: kind === "lm" }; buckets.set(key, b); }
    b.meshes.push(m);
  });

  const lmMeshes: THREE.Mesh[] = [], vtxMeshes: THREE.Mesh[] = [];
  for (const { meshes, lm } of buckets.values()) {
    const first = meshes[0];
    const merged = mergeGeometries(meshes.map((m) => prepare(m, lm)), false);
    if (!merged) throw new Error("merge failed");
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.userData.overview = first.userData.overview;
    for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); }
    root.add(mesh);
    (lm ? lmMeshes : vtxMeshes).push(mesh);
  }
  // Prázdné skupiny (bez meshů) už nejsou potřeba.
  const empty: THREE.Object3D[] = [];
  root.traverse((o) => { if (o !== root && (o as THREE.Group).isGroup && o.children.length === 0) empty.push(o); });
  for (const o of empty) o.removeFromParent();

  /* ---------------- lightmapa: každý čtyřúhelník (4 po sobě jdoucí vrcholy) = jedna mapa */
  interface Quad { mesh: number; first: number; chart: number }
  const charts: Chart[] = [];
  const quads: Quad[] = [];
  // Mapa 0: „nikam“ pro plochy, které zevnitř nejsou vidět.
  charts.push({ px: 0, py: 0, cw: 2, ch: 2, o: new THREE.Vector3(), u: new THREE.Vector3(), v: new THREE.Vector3(), n: new THREE.Vector3(0, 1, 0), mesh: -1 });
  const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const center = new THREE.Vector3(), nrm = new THREE.Vector3();
  lmMeshes.forEach((mesh, mi) => {
    const g = mesh.geometry;
    const texel = ((mesh.material as THREE.Material).userData.texel as number | undefined) ?? TEXEL;
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const nor = g.getAttribute("normal") as THREE.BufferAttribute;
    const q = g.getAttribute("lmq") as THREE.BufferAttribute;
    for (let f = 0; f + 3 < pos.count; f += 4) {
      let i00 = -1, i10 = -1, i01 = -1;
      for (let k = 0; k < 4; k++) {
        const u = Math.round(q.getX(f + k)), v = Math.round(q.getY(f + k));
        if (u === 0 && v === 0) i00 = f + k; else if (u === 1 && v === 0) i10 = f + k; else if (u === 0 && v === 1) i01 = f + k;
      }
      if (i00 < 0 || i10 < 0 || i01 < 0) throw new Error("lightmap quad without 0–1 UV");
      P[0].fromBufferAttribute(pos, i00);
      P[1].fromBufferAttribute(pos, i10).sub(P[0]);
      P[2].fromBufferAttribute(pos, i01).sub(P[0]);
      nrm.fromBufferAttribute(nor, i00);
      const w = P[1].length(), h = P[2].length();
      center.copy(P[0]).addScaledVector(P[1], 0.5).addScaledVector(P[2], 0.5).addScaledVector(nrm, 0.03);
      if (w < 0.004 || h < 0.004 || !interior(center)) { quads.push({ mesh: mi, first: f, chart: 0 }); continue; }
      const even = (x: number) => Math.max(2, 2 * Math.ceil(x / (2 * texel)));
      charts.push({ px: 0, py: 0, cw: even(w), ch: even(h), o: P[0].clone(), u: P[1].clone(), v: P[2].clone(), n: nrm.clone(), mesh: mi });
      quads.push({ mesh: mi, first: f, chart: charts.length - 1 });
    }
  });

  // Regálové balení: seřadit podle výšky, řádky zleva doprava.
  const order = charts.map((_, i) => i).slice(1).sort((a, b) => charts[b].ch - charts[a].ch || charts[b].cw - charts[a].cw || a - b);
  let x = 2 + GUTTER, y = 2, rowH = 2;
  for (const i of order) {
    const c = charts[i];
    if (c.cw + GUTTER > ATLAS_W) throw new Error("chart wider than atlas");
    if (x + c.cw + 2 > ATLAS_W) { x = 2; y += rowH + GUTTER; rowH = 0; }
    c.px = x; c.py = y;
    x += c.cw + GUTTER;
    rowH = Math.max(rowH, c.ch);
  }
  const atlasH = Math.ceil((y + rowH + GUTTER) / 4) * 4;

  for (const qd of quads) {
    const g = lmMeshes[qd.mesh].geometry;
    let uv2 = g.getAttribute("bkuv") as THREE.BufferAttribute | undefined;
    if (!uv2) { uv2 = new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2); g.setAttribute("bkuv", uv2); }
    const q = g.getAttribute("lmq") as THREE.BufferAttribute;
    const c = charts[qd.chart];
    for (let k = 0; k < 4; k++) {
      const i = qd.first + k;
      const u = qd.chart === 0 ? 0.5 : q.getX(i), v = qd.chart === 0 ? 0.5 : q.getY(i);
      uv2.setXY(i, (c.px + u * c.cw) / ATLAS_W, (c.py + v * c.ch) / atlasH);
    }
  }
  for (const m of lmMeshes) m.geometry.deleteAttribute("lmq");

  // Otisk rozvržení: počty vrcholů a mapy — předpočítané světlo musí sedět přesně na tuto scénu.
  let hash = 2166136261;
  const mix = (v: number) => { hash = Math.imul(hash ^ (v >>> 0), 16777619) >>> 0; };
  for (const m of [...lmMeshes, ...vtxMeshes]) { mix(m.geometry.getAttribute("position").count); mix(m.geometry.index!.count); }
  for (const c of charts) { mix(c.px); mix(c.py); mix(c.cw); mix(c.ch); }
  mix(atlasH);
  return { lmMeshes, vtxMeshes, charts, atlasW: ATLAS_W, atlasH, hash };
}
