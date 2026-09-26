import * as THREE from "three";
import { artTexture, box, cyl, ellipsoid, group, put, std, type Materials } from "./kit";
import { rng } from "./noise";

/**
 * Nábytek z primitiv. Konvence: počátek = střed půdorysu na podlaze, přední strana míří do +z.
 * Svítidla nesou značku `userData.lamp` — scéna z nich vytvoří světla pro denní / večerní režim.
 */

export interface LampInfo { color: number; intensity: number; distance: number; mode: "evening" | "always"; shades: THREE.MeshStandardMaterial[] }

export function lampMark(x: number, y: number, z: number, info: LampInfo) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  o.userData.lamp = info;
  return o;
}

export function shadeMaterial(color = 0xf1ead9) {
  return std(color, 0.9, 0, { side: THREE.DoubleSide, emissive: 0xffc98f, emissiveIntensity: 0 });
}

const corners = (hx: number, hz: number) => [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]] as const;

/* ------------------------------------------------------------------ obývák */

export function sofa(M: Materials, len = 2.3, depth = 0.95, fabric: THREE.Material = M.sofa, pillows: THREE.Material[] = [M.sage, M.ochre]) {
  const g = new THREE.Group();
  const arm = 0.17, legH = 0.09;
  for (const [x, z] of corners(len / 2 - 0.1, depth / 2 - 0.1)) g.add(put(cyl(0.02, 0.014, legH, M.black, 12), x, 0, z));
  g.add(put(box(len, 0.26, depth, fabric, 0.05), 0, legH, 0));
  for (const s of [-1, 1]) g.add(put(box(arm, 0.56, depth, fabric, 0.07), s * (len / 2 - arm / 2), legH, 0));
  g.add(put(box(len - 0.04, 0.72, 0.2, fabric, 0.08), 0, legH, -depth / 2 + 0.1));
  const inner = len - 2 * arm;
  const n = inner > 1.6 ? 3 : 2;
  const cw = inner / n;
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + cw * (i + 0.5);
    g.add(put(box(cw - 0.012, 0.15, depth - 0.24, fabric, 0.06), x, legH + 0.25, 0.11));
    const back = put(box(cw - 0.03, 0.42, 0.17, fabric, 0.08), x, legH + 0.39, -depth / 2 + 0.26);
    back.rotation.x = -0.14;
    g.add(back);
  }
  pillows.forEach((mat, i) => {
    const s = i === 0 ? -1 : 1;
    const p = put(box(0.44, 0.42, 0.13, mat, 0.065), s * (inner / 2 - 0.3), legH + 0.39, -depth / 2 + 0.4);
    p.rotation.set(-0.22, s * 0.28, s * 0.1);
    g.add(p);
  });
  return g;
}

export function armchair(M: Materials, fabric: THREE.Material = M.cream) {
  const g = new THREE.Group();
  const w = 0.74, d = 0.78;
  for (const [x, z] of corners(w / 2 - 0.08, d / 2 - 0.08)) {
    const l = put(cyl(0.015, 0.022, 0.27, M.oak, 12), x, 0, z);
    l.rotation.set(z > 0 ? -0.13 : 0.13, 0, x > 0 ? 0.13 : -0.13);
    g.add(l);
  }
  g.add(put(box(w, 0.17, d, fabric, 0.07), 0, 0.25, 0.02));
  const back = put(box(w, 0.55, 0.16, fabric, 0.075), 0, 0.3, -d / 2 + 0.1);
  back.rotation.x = -0.2;
  g.add(back);
  for (const s of [-1, 1]) g.add(put(box(0.1, 0.24, d - 0.12, fabric, 0.045), s * (w / 2 - 0.05), 0.36, 0.01));
  const pillow = put(box(0.4, 0.3, 0.11, M.rust, 0.05), 0, 0.42, -d / 2 + 0.27);
  pillow.rotation.x = -0.25;
  g.add(pillow);
  return g;
}

export function coffeeTable(M: Materials, r = 0.45, h = 0.4) {
  const g = new THREE.Group();
  g.add(put(cyl(r, r, 0.032, M.oak, 48), 0, h - 0.032, 0));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    g.add(put(cyl(0.017, 0.017, h - 0.032, M.black, 10), Math.cos(a) * r * 0.62, 0, Math.sin(a) * r * 0.62));
  }
  g.add(put(box(0.3, 0.035, 0.22, M.rust, 0.004), -0.08, h, 0.05));
  g.add(put(box(0.26, 0.03, 0.19, M.cream, 0.004), -0.07, h + 0.035, 0.05));
  const vase = put(cyl(0.05, 0.06, 0.2, M.potWhite, 20), 0.18, h, -0.1);
  g.add(vase);
  for (let i = 0; i < 3; i++) {
    const st = put(cyl(0.003, 0.003, 0.28, M.walnut, 5), 0.18, h + 0.18, -0.1);
    st.rotation.set(0.25 * (i - 1), 0, 0.2 * (i - 1));
    g.add(st);
  }
  return g;
}

export function floorLamp(M: Materials, mode: LampInfo["mode"] = "evening") {
  const shade = shadeMaterial();
  const g = group(
    cyl(0.16, 0.17, 0.025, M.black, 32),
    put(cyl(0.011, 0.011, 1.38, M.black, 10), 0, 0.025, 0),
    put(cyl(0.19, 0.23, 0.3, shade, 36, true), 0, 1.3, 0),
  );
  g.add(lampMark(0, 1.42, 0, { color: 0xffc88a, intensity: 4.5, distance: 7, mode, shades: [shade] }));
  return g;
}

export function plant(M: Materials, h = 1.4, seed = 1, pot: THREE.Material = M.terracotta, kind: "fig" | "snake" | "bush" = "fig") {
  const R = rng(seed * 977 + 13);
  const g = new THREE.Group();
  const potH = kind === "bush" ? 0.26 : 0.36, potR = kind === "bush" ? 0.14 : 0.19;
  g.add(cyl(potR, potR * 0.78, potH, pot, 28));
  g.add(put(cyl(potR * 0.93, potR * 0.93, 0.01, M.soil, 20), 0, potH - 0.035, 0));
  if (kind === "snake") {
    for (let i = 0; i < 11; i++) {
      const bh = (h - potH) * (0.55 + R() * 0.45);
      const geo = new THREE.ConeGeometry(0.035 + R() * 0.012, bh, 4);
      geo.scale(1, 1, 0.22);
      geo.translate(0, bh / 2, 0);
      const blade = new THREE.Mesh(geo, R() < 0.5 ? M.leaf : M.leaf2);
      blade.castShadow = true;
      blade.position.set((R() - 0.5) * potR, potH - 0.03, (R() - 0.5) * potR);
      blade.rotation.set((R() - 0.5) * 0.35, R() * Math.PI, (R() - 0.5) * 0.35);
      g.add(blade);
    }
    return g;
  }
  const top = h - potH;
  if (kind === "fig") g.add(put(cyl(0.013, 0.02, top * 0.8, M.walnut, 8), 0, potH - 0.03, 0));
  const leaves = kind === "fig" ? 30 : 46;
  for (let i = 0; i < leaves; i++) {
    const hy = kind === "fig" ? 0.3 + 0.7 * Math.sqrt(R()) : 0.15 + 0.85 * R();
    const y = potH + top * hy;
    const a = R() * Math.PI * 2;
    const spread = kind === "fig" ? 0.06 + R() * 0.2 * (1.1 - hy * 0.5) : 0.05 + R() * 0.2 * Math.sin(hy * Math.PI);
    const L = kind === "fig" ? 0.11 + R() * 0.05 : 0.06 + R() * 0.03;
    const leaf = ellipsoid(L, 0.008, L * 0.62, R() < 0.5 ? M.leaf : M.leaf2, 10);
    const droop = 0.2 + R() * 0.7;
    leaf.rotation.order = "YZX";
    leaf.rotation.set((R() - 0.5) * 0.6, -a, -droop);
    const reach = spread + L * Math.cos(droop);
    leaf.position.set(Math.cos(a) * reach, y - L * Math.sin(droop) * 0.6, Math.sin(a) * reach);
    g.add(leaf);
  }
  return g;
}

export function artFrame(M: Materials, w: number, h: number, seed: number, colors: string[]) {
  const g = new THREE.Group();
  g.add(box(w, h, 0.03, M.frameDark, 0, false));
  const canvasMat = std(0xffffff, 0.9, 0, { map: artTexture(seed, colors) });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.1), canvasMat);
  pic.position.set(0, h / 2, 0.0155);
  g.add(pic);
  return g;
}

/** Záclona (jemné sklady), svislá rovina v ose x. */
export function curtain(M: Materials, w: number, h: number) {
  const geo = new THREE.PlaneGeometry(w, h, Math.max(8, Math.round(w / 0.03)), 1);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / 0.11) * Math.PI * 2) * 0.028);
  geo.computeVertexNormals();
  geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, M.sheer);
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ kuchyň */

/** Spodní linka po délce osy x, hloubka 0,62 m. */
export function kitchenBase(M: Materials, len: number, front: THREE.Material, opts: { sinkAt?: number; hobAt?: number } = {}) {
  const g = new THREE.Group();
  g.add(put(box(len, 0.1, 0.52, M.blackMatte, 0), 0, 0, -0.04));
  g.add(put(box(len, 0.78, 0.58, M.white, 0), 0, 0.1, -0.02));
  const n = Math.max(1, Math.round(len / 0.6));
  const fw = len / n;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + fw * (i + 0.5);
    const drawers = i % 3 === 1 ? [0.18, 0.26, 0.3] : [0.76];
    let y = 0.11;
    for (const dh of drawers) {
      g.add(put(box(fw - 0.005, dh - 0.005, 0.02, front, 0.003), x, y, 0.29));
      g.add(put(box(fw * 0.55, 0.012, 0.018, M.black, 0.004), x, y + dh - 0.05, 0.305));
      y += dh;
    }
  }
  g.add(put(box(len + 0.02, 0.04, 0.64, M.counter, 0.004), 0, 0.88, 0));
  if (opts.sinkAt !== undefined) {
    g.add(put(box(0.56, 0.006, 0.44, M.steel, 0.02), opts.sinkAt, 0.918, 0.02));
    g.add(put(box(0.5, 0.004, 0.38, std(0x7e8285, 0.3, 0.8), 0.02), opts.sinkAt, 0.922, 0.02));
    const tap = group(put(cyl(0.018, 0.022, 0.3, M.chrome, 16), 0, 0, 0));
    const spout = put(cyl(0.012, 0.012, 0.2, M.chrome, 12), 0, 0.28, 0.08);
    spout.rotation.x = Math.PI / 2;
    tap.add(spout);
    g.add(put(tap, opts.sinkAt, 0.92, -0.22));
  }
  if (opts.hobAt !== undefined) {
    g.add(put(box(0.6, 0.006, 0.5, M.glassBlack, 0.01), opts.hobAt, 0.92, 0.02));
  }
  return g;
}

export function kitchenUpper(M: Materials, len: number, front: THREE.Material, stripShade: THREE.MeshStandardMaterial) {
  const g = new THREE.Group();
  g.add(put(box(len, 0.72, 0.33, M.white, 0), 0, 0, 0));
  const n = Math.max(1, Math.round(len / 0.5));
  const fw = len / n;
  for (let i = 0; i < n; i++) g.add(put(box(fw - 0.005, 0.715, 0.02, front, 0.003), -len / 2 + fw * (i + 0.5), 0.0025, 0.175));
  g.add(put(box(len - 0.04, 0.008, 0.02, stripShade, 0), 0, -0.008, 0.12));
  return g;
}

export function tallUnit(M: Materials, w: number, h: number, front: THREE.Material, oven: boolean) {
  const g = new THREE.Group();
  g.add(put(box(w, 0.1, 0.52, M.blackMatte), 0, 0, -0.04));
  g.add(put(box(w, h - 0.1, 0.58, M.white), 0, 0.1, -0.02));
  if (oven) {
    g.add(put(box(w - 0.005, 0.5, 0.02, front, 0.003), 0, 0.105, 0.29));
    g.add(put(box(w - 0.02, 0.58, 0.02, M.glassBlack, 0.004), 0, 0.64, 0.292));
    g.add(put(box(w * 0.6, 0.014, 0.02, M.steel, 0.004), 0, 1.15, 0.31));
    g.add(put(box(w - 0.005, h - 1.3, 0.02, front, 0.003), 0, 1.25, 0.29));
  } else {
    g.add(put(box(w - 0.005, 1.25, 0.02, front, 0.003), 0, 0.105, 0.29));
    g.add(put(box(w - 0.005, h - 1.37, 0.02, front, 0.003), 0, 1.36, 0.29));
    g.add(put(box(0.012, 0.7, 0.018, M.black, 0.004), w / 2 - 0.05, 0.55, 0.305));
  }
  return g;
}

export function hood(M: Materials) {
  return group(put(box(0.6, 0.12, 0.45, M.steel, 0.005), 0, 0, 0.05), put(box(0.3, 0.9, 0.25, M.steel, 0.005), 0, 0.12, -0.05));
}

/** Ostrůvek po ose x, sezení na straně +z (přesah desky). */
export function island(M: Materials, len: number, depth: number, front: THREE.Material) {
  const g = new THREE.Group();
  const body = depth - 0.28;
  g.add(put(box(len - 0.04, 0.1, body - 0.06, M.blackMatte), 0, 0, -0.14));
  g.add(put(box(len, 0.78, body, front, 0.01), 0, 0.1, -0.14));
  const n = Math.max(1, Math.round(len / 0.6));
  for (let i = 1; i < n; i++) g.add(put(box(0.004, 0.7, 0.004, M.blackMatte, 0), -len / 2 + (len / n) * i, 0.14, -0.14 - body / 2 - 0.001));
  g.add(put(box(len + 0.04, 0.045, depth, M.counter, 0.006), 0, 0.88, 0));
  // Na desce: mísa s ovocem a prkénko.
  g.add(put(cyl(0.14, 0.09, 0.08, M.potWhite, 28), -len * 0.22, 0.925, 0.05));
  for (let i = 0; i < 4; i++) g.add(put(ellipsoid(0.04, 0.04, 0.04, i % 2 ? M.ochre : M.rust, 10), -len * 0.22 + (i - 1.5) * 0.04, 0.99, 0.05 + (i % 2) * 0.03));
  g.add(put(box(0.38, 0.02, 0.25, M.oakLight, 0.006), len * 0.2, 0.925, -0.05));
  return g;
}

export function barStool(M: Materials) {
  const g = new THREE.Group();
  g.add(put(cyl(0.19, 0.18, 0.045, M.oak, 28), 0, 0.66, 0));
  for (const [x, z] of corners(0.13, 0.13)) {
    const l = put(cyl(0.011, 0.013, 0.67, M.black, 8), x, 0, z);
    l.rotation.set(z > 0 ? -0.1 : 0.1, 0, x > 0 ? 0.1 : -0.1);
    g.add(l);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 28), M.black);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.26;
  g.add(ring);
  return g;
}

export function pendant(M: Materials, drop: number, shade: THREE.MeshStandardMaterial) {
  const g = new THREE.Group();
  g.add(put(cyl(0.003, 0.003, drop, M.black, 5), 0, -drop, 0));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.black);
  dome.position.y = -drop - 0.12;
  dome.castShadow = true;
  g.add(dome);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.14, 28), shade);
  inner.rotation.x = Math.PI / 2;
  inner.position.y = -drop - 0.118;
  g.add(inner);
  return g;
}

/* ------------------------------------------------------------------ ložnice */

export function bed(M: Materials, w = 1.8, l = 2.1, duvet: THREE.Material = M.linen, throwMat: THREE.Material = M.sage) {
  const g = new THREE.Group();
  const head = std(0xb7ab9c, 0.97);
  for (const [x, z] of corners(w / 2 - 0.1, l / 2 - 0.1)) g.add(put(cyl(0.025, 0.02, 0.07, M.oak, 10), x, 0, z));
  g.add(put(box(w + 0.08, 0.26, l + 0.02, head, 0.04), 0, 0.07, 0));
  g.add(put(box(w, 0.2, l - 0.04, M.cream, 0.07), 0, 0.31, -0.01));
  g.add(put(box(w + 0.1, 1.08, 0.1, head, 0.05), 0, 0.07, -l / 2 - 0.04));
  // Přikrývka přes spodní dvě třetiny, se splývajícími okraji.
  const dl = l * 0.74;
  g.add(put(box(w + 0.06, 0.11, dl, duvet, 0.05), 0, 0.46, l / 2 - dl / 2 + 0.02));
  for (const s of [-1, 1]) g.add(put(box(0.03, 0.3, dl, duvet, 0.012), s * (w / 2 + 0.03), 0.27, l / 2 - dl / 2 + 0.02));
  g.add(put(box(w + 0.06, 0.06, 0.28, duvet, 0.03), 0, 0.53, l / 2 - dl + 0.1));
  for (const s of [-1, 1]) {
    const p = put(box(0.72, 0.2, 0.46, M.white, 0.09), s * 0.42, 0.5, -l / 2 + 0.3);
    p.rotation.x = -0.35;
    g.add(p);
    const p2 = put(box(0.5, 0.36, 0.13, s < 0 ? M.sage : M.ochre, 0.06), s * 0.3, 0.52, -l / 2 + 0.52);
    p2.rotation.x = -0.3;
    g.add(p2);
  }
  g.add(put(box(w + 0.14, 0.025, 0.55, throwMat, 0.012), 0, 0.575, l / 2 - 0.38));
  return g;
}

export function nightstand(M: Materials) {
  const g = group(put(box(0.46, 0.5, 0.4, M.oak, 0.012), 0, 0.02, 0));
  for (const [x, z] of corners(0.18, 0.15)) g.add(put(cyl(0.012, 0.012, 0.02, M.black, 6), x, 0, z));
  g.add(put(box(0.4, 0.004, 0.004, M.walnut, 0), 0, 0.33, 0.2));
  g.add(put(box(0.14, 0.012, 0.015, M.black, 0.004), 0, 0.42, 0.205));
  return g;
}

export function tableLamp(M: Materials, mode: LampInfo["mode"] = "evening") {
  const shade = shadeMaterial(0xf3ece0);
  const g = group(cyl(0.075, 0.09, 0.26, M.terracotta, 28), put(cyl(0.13, 0.16, 0.2, shade, 32, true), 0, 0.27, 0));
  g.add(lampMark(0, 0.36, 0, { color: 0xffc27f, intensity: 3.2, distance: 5, mode, shades: [shade] }));
  return g;
}

export function wardrobe(M: Materials, len: number, h = 2.3, depth = 0.6) {
  const g = new THREE.Group();
  g.add(put(box(len, 0.08, depth - 0.06, M.blackMatte), 0, 0, -0.03));
  g.add(put(box(len, h - 0.08, depth - 0.02, M.white), 0, 0.08, -0.01));
  const n = Math.max(2, Math.round(len / 0.5));
  const dw = len / n;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + dw * (i + 0.5);
    g.add(put(box(dw - 0.005, h - 0.085, 0.02, M.lacquer, 0.003), x, 0.082, depth / 2 - 0.01));
    const side = i % 2 === 0 ? 1 : -1;
    g.add(put(box(0.012, 0.5, 0.02, M.brass, 0.004), x + side * (dw / 2 - 0.04), 0.95, depth / 2 + 0.008));
  }
  return g;
}

export function bench(M: Materials, len = 1.2) {
  const g = new THREE.Group();
  for (const [x, z] of corners(len / 2 - 0.06, 0.13)) g.add(put(cyl(0.017, 0.017, 0.38, M.oak, 10), x, 0, z));
  g.add(put(box(len, 0.1, 0.38, M.charcoalFabric, 0.04), 0, 0.37, 0));
  return g;
}

/* ------------------------------------------------------------------ koupelna */

export function bathtub(M: Materials, l = 1.8, w = 0.75, h = 0.56) {
  const g = new THREE.Group();
  const t = 0.07;
  g.add(put(box(l, h, t, M.lacquer, 0.012), 0, 0, w / 2 - t / 2));
  g.add(put(box(l, h, t, M.lacquer, 0.012), 0, 0, -w / 2 + t / 2));
  for (const s of [-1, 1]) g.add(put(box(t, h, w - 2 * t, M.lacquer, 0.012), s * (l / 2 - t / 2), 0, 0));
  g.add(put(box(l - 2 * t, 0.2, w - 2 * t, M.ceramic, 0.04), 0, 0, 0));
  const tap = put(cyl(0.02, 0.02, 0.22, M.chrome, 14), l / 2 - 0.3, h, -w / 2 + 0.035);
  g.add(tap);
  const spout = put(cyl(0.012, 0.012, 0.14, M.chrome, 10), l / 2 - 0.3, h + 0.2, -w / 2 + 0.1);
  spout.rotation.x = Math.PI / 2;
  g.add(spout);
  return g;
}

export function vanity(M: Materials, w = 0.9, d = 0.48) {
  const g = new THREE.Group();
  g.add(put(box(w, 0.42, d, M.oak, 0.01), 0, 0.42, 0));
  g.add(put(box(w - 0.02, 0.004, 0.004, M.walnut, 0), 0, 0.63, d / 2));
  g.add(put(box(w + 0.02, 0.03, d + 0.01, M.counter, 0.005), 0, 0.84, 0));
  g.add(put(cyl(0.2, 0.16, 0.13, M.ceramic, 40), 0, 0.87, 0.02));
  g.add(put(cyl(0.18, 0.18, 0.003, std(0xe6e8e8, 0.1), 40), 0, 0.995, 0.02));
  const tap = put(cyl(0.014, 0.018, 0.3, M.chrome, 14), 0, 0.87, -d / 2 + 0.06);
  g.add(tap);
  const spout = put(cyl(0.01, 0.01, 0.13, M.chrome, 10), 0, 1.15, -d / 2 + 0.12);
  spout.rotation.x = Math.PI / 2;
  g.add(spout);
  return g;
}

export function toilet(M: Materials) {
  const g = new THREE.Group();
  g.add(put(box(0.37, 0.19, 0.54, M.ceramic, 0.09), 0, 0.22, 0.27));
  g.add(put(box(0.38, 0.03, 0.5, M.ceramic, 0.014), 0, 0.41, 0.28));
  g.add(put(box(0.24, 0.16, 0.012, M.chrome, 0.004), 0, 0.95, 0.006));
  return g;
}

export function towelRadiator(M: Materials, w = 0.5, h = 1.2, towel: THREE.Material = M.sage) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) g.add(put(cyl(0.013, 0.013, h, M.whiteMatte, 10), s * (w / 2), 0.15, 0.05));
  for (let i = 0; i < 12; i++) {
    const bar = put(cyl(0.009, 0.009, w, M.whiteMatte, 8), 0, 0.2 + (i / 11) * (h - 0.1), 0.05);
    bar.rotation.z = Math.PI / 2;
    g.add(bar);
  }
  g.add(put(box(w - 0.06, 0.6, 0.03, towel, 0.012), 0, 0.72, 0.075));
  return g;
}

/* ------------------------------------------------------------------ předsíň */

export function shoeCabinet(M: Materials, len = 1.0, h = 0.86, d = 0.32) {
  const g = new THREE.Group();
  g.add(put(box(len, h - 0.02, d, M.lacquer, 0.006), 0, 0.02, 0));
  g.add(put(box(len + 0.02, 0.025, d + 0.01, M.oak, 0.004), 0, h, 0));
  for (let i = 1; i < 3; i++) g.add(put(box(len - 0.02, 0.004, 0.004, M.whiteMatte, 0), 0, (h / 3) * i, d / 2));
  g.add(put(cyl(0.06, 0.07, 0.14, M.terracotta, 20), len / 2 - 0.15, h + 0.025, 0));
  g.add(put(box(0.2, 0.05, 0.12, M.walnut, 0.01), -len / 2 + 0.2, h + 0.025, 0));
  return g;
}

export function roundMirror(M: Materials, r = 0.36) {
  const geo = new THREE.CylinderGeometry(r, r, 0.02, 48);
  geo.rotateX(Math.PI / 2);
  const g = group(new THREE.Mesh(geo, M.brass));
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r - 0.02, 48), M.mirror);
  glass.position.z = 0.0105;
  g.add(glass);
  return g;
}

export function coatRack(M: Materials, len = 0.9) {
  const g = new THREE.Group();
  g.add(put(box(len, 0.08, 0.025, M.oak, 0.006), 0, 1.72, 0.0125));
  for (let i = 0; i < 4; i++) {
    const peg = put(cyl(0.012, 0.012, 0.08, M.oak, 8), -len / 2 + 0.12 + i * ((len - 0.24) / 3), 1.76, 0.06);
    peg.rotation.x = Math.PI / 2;
    g.add(peg);
  }
  const coat1 = put(box(0.44, 0.92, 0.13, std(0x6b5a48, 0.95), 0.06), -len / 2 + 0.2, 0.82, 0.1);
  coat1.rotation.z = 0.03;
  const coat2 = put(box(0.4, 0.8, 0.12, std(0x3f4a52, 0.95), 0.06), len / 2 - 0.24, 0.94, 0.1);
  coat2.rotation.z = -0.04;
  g.add(coat1, coat2);
  return g;
}

/* ------------------------------------------------------------------ architektura */

export function doorLeaf(M: Materials, w: number, h: number, mat: THREE.Material = M.door) {
  const g = group(put(box(w, h, 0.04, mat, 0.004), 0, 0, 0));
  const handle = put(box(0.13, 0.018, 0.018, M.black, 0.005), w / 2 - 0.12, 1.02, 0.035);
  const handle2 = put(box(0.13, 0.018, 0.018, M.black, 0.005), w / 2 - 0.12, 1.02, -0.035);
  g.add(handle, handle2);
  return g;
}

/** Zárubeň/obložka otvoru: šířka po ose x, tloušťka stěny po ose z. */
export function doorCasing(M: Materials, w: number, h: number, t: number) {
  const g = new THREE.Group();
  const d = t + 0.024;
  for (const s of [-1, 1]) g.add(put(box(0.055, h + 0.055, d, M.door, 0.004), s * (w / 2 + 0.0275), 0, 0));
  g.add(put(box(w + 0.11, 0.055, d, M.door, 0.004), 0, h, 0));
  return g;
}

/** Okno v otvoru w × h (šířka po ose x); rám, příčka, sklo a vnitřní parapet. */
export function windowUnit(M: Materials, w: number, h: number, t: number, sill: boolean) {
  const g = new THREE.Group();
  const f = 0.065, fd = 0.08;
  const frame = M.white;
  g.add(put(box(w, f, fd, frame), 0, 0, 0));
  g.add(put(box(w, f, fd, frame), 0, h - f, 0));
  for (const s of [-1, 1]) g.add(put(box(f, h, fd, frame), s * (w / 2 - f / 2), 0, 0));
  if (w > 1.1) g.add(put(box(f * 0.9, h, fd, frame), 0, 0, 0));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - f, h - f), M.glass);
  glass.position.set(0, h / 2, 0);
  glass.castShadow = false;
  g.add(glass);
  if (sill) g.add(put(box(w + 0.08, 0.03, t * 0.5 + 0.12, M.whiteMatte, 0.004), 0, -0.03, t * 0.25 + 0.06));
  return g;
}
