import * as THREE from "three";
import { cloth, cushion, cylinder, lathe, leafCard, pillow, plane, roundedBox, tube } from "./geometry";
import { artTexture, box, cyl, ellipsoid, group, linearOf, meta, put, std, type Materials } from "./kit";
import { rng } from "./noise";
import { fabric } from "./textures";

/**
 * Nábytek a doplňky. Konvence: počátek = střed půdorysu na podlaze, přední strana míří do +z.
 * Měkké díly (sedáky, polštáře, přikrývka) mají vlastní tvary z geometry.ts, aby nepůsobily jako kvádry.
 * Svítidla nesou značku `userData.lamp` — z ní vznikne zdroj světla pro výpočet osvětlení.
 */

export interface LampInfo {
  color: number; intensity: number; distance: number; mode: "evening" | "always"; shades: THREE.MeshStandardMaterial[];
  /** Směrové svítidlo (bodovka, LED pásek): osa a exponent vyzařování cos^exp; poloměr zdroje pro měkké stíny. */
  dir?: [number, number, number]; exp?: number; radius?: number;
}

export function lampMark(x: number, y: number, z: number, info: LampInfo) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  o.userData.lamp = info;
  return o;
}

/** Lněné stínidlo: večer září (emissive), pro výpočet světla částečně propouští. */
export function shadeMaterial(color = 0xf1ead9) {
  const f = fabric("linen");
  const m = std(color, 0.9, 0, { side: THREE.DoubleSide, emissive: 0xffc98f, emissiveIntensity: 0, map: f.map ? f.map.clone() : null });
  if (m.map) { m.map.repeat.setScalar(6); m.map.needsUpdate = true; }
  return meta(m, { transmit: 0.35, albedo: linearOf(color) });
}

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; };
const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const corners = (hx: number, hz: number) => [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]] as const;

/** Kónická noha (dřevo), volitelně rozkročená. */
function leg(M: Materials, h: number, r0: number, r1: number, mat: THREE.Material = M.oak, tiltX = 0, tiltZ = 0) {
  const l = mesh(cylinder(r1, r0, h, 14, 0), mat);
  l.rotation.set(tiltX, 0, tiltZ);
  return l;
}

/** Kniha: desky + světlý blok stránek. */
function book(M: Materials, w: number, t: number, d: number, cover: THREE.Material) {
  return group(
    box(w, t, d, cover, 0),
    put(box(w - 0.012, t - 0.006, d - 0.008, M.paper, 0, false), 0.006, 0.003, 0),
  );
}

/* ------------------------------------------------------------------ obývák */

export function sofa(M: Materials, len = 2.3, depth = 0.95, fab: THREE.Material = M.sofa) {
  const g = new THREE.Group();
  const legH = 0.1, baseH = 0.2, armW = 0.2, armTop = 0.64, backD = 0.22, seatH = 0.19;
  for (const [x, z] of corners(len / 2 - 0.12, depth / 2 - 0.1)) g.add(at(leg(M, legH, 0.024, 0.017), x, 0, z));
  const y0 = legH;
  g.add(at(mesh(cushion(len, baseH, depth, 0.045, [0.004, 0.003, 0.008], 3), fab), 0, y0 + baseH / 2, 0));
  for (const s of [-1, 1]) g.add(at(mesh(cushion(armW, armTop - y0, depth, 0.075, [0.01, 0.018, 0.012], 5 + s), fab), s * (len / 2 - armW / 2), y0 + (armTop - y0) / 2, 0));
  const inner = len - 2 * armW;
  g.add(at(mesh(cushion(inner + 0.02, 0.44, backD, 0.06, [0.008, 0.01, 0.012], 9), fab), 0, y0 + baseH + 0.22, -depth / 2 + backD / 2));
  const n = 3, cw = inner / n;
  const R = rng(17);
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + cw * (i + 0.5);
    const sd = depth - backD - 0.015;
    g.add(at(mesh(cushion(cw - 0.012, seatH, sd, 0.055, [0.01, 0.03, 0.022], 20 + i), fab), x + (R() - 0.5) * 0.01, y0 + baseH + seatH / 2 - 0.012, depth / 2 - sd / 2 - 0.008, 0, (R() - 0.5) * 0.02));
    // Opěrák se opírá dozadu, dole se opírá o sedák.
    g.add(at(mesh(cushion(cw - 0.018, 0.47, 0.19, 0.075, [0.012, 0.02, 0.04], 30 + i), fab), x, y0 + baseH + seatH + 0.21, -depth / 2 + backD + 0.075, -0.2 + (R() - 0.5) * 0.04, (R() - 0.5) * 0.03));
  }
  // Dekorativní polštáře.
  // Polštáře stojí na sedáku a opírají se o opěrák (nesmí do něj zasahovat).
  const pil = (mat: THREE.Material, s: number, w: number, h: number, seed: number) =>
    g.add(at(mesh(pillow(w, h, 0.16, seed), mat), s * (inner / 2 - w / 2 - 0.03), y0 + baseH + seatH + h / 2 + 0.005, -depth / 2 + backD + 0.27, -0.34, s * 0.22, s * 0.06));
  pil(M.sage, -1, 0.47, 0.45, 41);
  pil(M.ochre, 1, 0.44, 0.42, 43);
  g.add(at(mesh(pillow(0.42, 0.3, 0.13, 45), M.boucle), inner / 2 - 0.6, y0 + baseH + seatH + 0.16, -depth / 2 + backD + 0.33, -0.3, -0.12, 0.04));
  // Pletená deka přehozená přes pravou područku.
  const ax = len / 2 - armW / 2;
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(ax - armW / 2 - 0.26, y0 + baseH + seatH + 0.018, 0),
    new THREE.Vector3(ax - armW / 2 - 0.06, y0 + baseH + seatH + 0.03, 0),
    new THREE.Vector3(ax - armW / 2 + 0.02, armTop + 0.012, 0),
    new THREE.Vector3(ax + armW / 2 - 0.02, armTop + 0.014, 0),
    new THREE.Vector3(ax + armW / 2 + 0.018, armTop - 0.08, 0),
    new THREE.Vector3(ax + armW / 2 + 0.03, 0.3, 0),
  ]);
  const bw = 0.52;
  g.add(mesh(cloth(40, 16, (u, v) => {
    const p = path.getPoint(u);
    const hang = Math.max(0, (u - 0.62) / 0.38);
    const fold = Math.sin(v * Math.PI * 5 + u * 2) * 0.012 * (0.3 + hang * 1.6);
    return [p.x + fold * (hang > 0 ? 1 : 0.2), p.y + (hang > 0 ? 0 : fold * 0.4), (v - 0.5) * bw * (1 + hang * 0.08) + 0.08 + Math.sin(u * 7) * 0.01];
  }), meta(M.knit, {})));
  return g;
}

export function armchair(M: Materials, fab: THREE.Material = M.boucle) {
  const g = new THREE.Group();
  const w = 0.72, d = 0.76;
  // Dubový rám: nohy nakloněné, područky jako ploché lišty.
  for (const s of [-1, 1]) {
    g.add(at(leg(M, 0.6, 0.022, 0.018, M.oak, 0.08, 0), s * (w / 2 - 0.03), 0, d / 2 - 0.08));
    g.add(at(leg(M, 0.62, 0.022, 0.018, M.oak, -0.12, 0), s * (w / 2 - 0.03), 0, -d / 2 + 0.1));
    g.add(at(mesh(roundedBox(0.055, 0.028, d - 0.04, 0.012), M.oak), s * (w / 2 - 0.03), 0.6, 0.0, -0.04));
    g.add(at(mesh(roundedBox(0.03, 0.045, d - 0.16), M.oak), s * (w / 2 - 0.03), 0.3, 0.0));
  }
  g.add(at(mesh(roundedBox(w - 0.1, 0.035, 0.035), M.oak), 0, 0.3, d / 2 - 0.1));
  g.add(at(mesh(roundedBox(w - 0.1, 0.035, 0.035), M.oak), 0, 0.3, -d / 2 + 0.12));
  g.add(at(mesh(cushion(w - 0.1, 0.13, d - 0.14, 0.05, [0.008, 0.025, 0.015], 51), fab), 0, 0.39, 0.03));
  g.add(at(mesh(cushion(w - 0.12, 0.5, 0.13, 0.055, [0.008, 0.012, 0.03], 53), fab), 0, 0.72, -d / 2 + 0.14, -0.26));
  g.add(at(mesh(pillow(0.4, 0.3, 0.12, 55), M.rust), 0.02, 0.6, -d / 2 + 0.28, -0.3, 0.1, 0.04));
  return g;
}

export function coffeeTable(M: Materials, r = 0.45, h = 0.4) {
  const g = new THREE.Group();
  g.add(at(mesh(cylinder(r, r, 0.034, 64, 0.009), M.oak), 0, h - 0.034, 0));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const l = mesh(cylinder(0.02, 0.014, h - 0.03, 14), M.oak);
    const lx = Math.cos(a) * r * 0.58, lz = Math.sin(a) * r * 0.58;
    l.position.set(lx, 0, lz);
    // Mírné rozkročení ven.
    l.rotation.set(Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08);
    g.add(l);
  }
  // Na stolku: dvě knihy, keramická váza se suchými větvičkami, miska.
  g.add(at(book(M, 0.3, 0.032, 0.22, std(0x7d8a7a, 0.8)), -0.1, h, 0.08, 0, 0.2));
  g.add(at(book(M, 0.25, 0.026, 0.19, std(0xd9cdb8, 0.8)), -0.1, h + 0.032, 0.08, 0, 0.35));
  const vase = mesh(lathe([[0, 0], [0.05, 0], [0.058, 0.02], [0.062, 0.09], [0.045, 0.19], [0.022, 0.24], [0.024, 0.26], [0.02, 0.26], [0.018, 0.22], [0, 0.22]], 32), std(0xd8d2c6, 0.55));
  g.add(at(vase, 0.17, h, -0.12));
  const R = rng(61);
  for (let i = 0; i < 6; i++) {
    const a = R() * Math.PI * 2, lean = 0.1 + R() * 0.35, len = 0.35 + R() * 0.25;
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * lean * 0.3, len * 0.5, Math.sin(a) * lean * 0.3), new THREE.Vector3(Math.cos(a) * lean * 0.7 + (R() - 0.5) * 0.05, len, Math.sin(a) * lean * 0.7)];
    g.add(at(mesh(tube(pts, 0.0025, 5), M.walnut), 0.17, h + 0.2, -0.12));
    for (let k = 0; k < 5; k++) {
      const t = 0.45 + k * 0.12;
      const p = new THREE.CatmullRomCurve3(pts).getPoint(Math.min(1, t));
      const lf = mesh(leafCard(0.05, 0.022, 3, 0.1, 0.1), std(0xa99a74, 0.8, 0, { side: THREE.DoubleSide, map: M.leaf.map, alphaTest: 0.5 }));
      g.add(at(lf, 0.17 + p.x, h + 0.2 + p.y, -0.12 + p.z, -0.6 + R() * 1.2, R() * 6.28, R() - 0.5));
    }
  }
  g.add(at(mesh(lathe([[0, 0], [0.04, 0], [0.075, 0.03], [0.08, 0.045], [0.074, 0.045], [0.07, 0.035], [0, 0.012]], 32), std(0x3a3632, 0.4)), 0.12, h, 0.16));
  return g;
}

export function floorLamp(M: Materials, mode: LampInfo["mode"] = "evening") {
  const shade = shadeMaterial();
  const g = group(
    mesh(cylinder(0.15, 0.16, 0.022, 40, 0.006), M.black),
    at(mesh(cylinder(0.011, 0.011, 1.36, 12), M.black), 0, 0.022, 0),
    at(mesh(cylinder(0.2, 0.22, 0.32, 48, 0, true), shade), 0, 1.28, 0),
    at(mesh(cylinder(0.018, 0.018, 0.08, 12), M.brass), 0, 1.36, 0),
  );
  g.add(lampMark(0, 1.42, 0, { color: 0xffc88a, intensity: 4.5, distance: 7, mode, shades: [shade], radius: 0.04 }));
  return g;
}

/** Keramický květináč z profilu (válec se zaobleným dnem a okrajem). */
function pot(M: Materials, r: number, h: number, mat: THREE.Material) {
  return group(
    mesh(lathe([[0, 0], [r * 0.78, 0], [r * 0.86, 0.015], [r * 0.97, h * 0.6], [r, h - 0.01], [r * 1.02, h], [r * 0.93, h], [r * 0.9, h - 0.04], [0, h - 0.04]], 36), mat),
    at(mesh(cylinder(r * 0.9, r * 0.9, 0.012, 24), M.soil, false), 0, h - 0.05, 0),
  );
}

export function plant(M: Materials, h = 1.4, seed = 1, potMat: THREE.Material = M.terracotta, kind: "fig" | "snake" | "bush" = "fig") {
  const R = rng(seed * 977 + 13);
  const g = new THREE.Group();
  const potH = kind === "bush" ? 0.24 : kind === "snake" ? 0.32 : 0.38, potR = kind === "bush" ? 0.13 : kind === "snake" ? 0.16 : 0.2;
  g.add(pot(M, potR, potH, potMat));
  const top = h - potH;
  if (kind === "snake") {
    for (let i = 0; i < 12; i++) {
      const bh = top * (0.55 + R() * 0.45);
      const lf = mesh(leafCard(bh, 0.085 + R() * 0.04, 2, 0.3, 0.05 + R() * 0.1), M.leaf);
      const a = R() * Math.PI * 2, rr = R() * potR * 0.6;
      g.add(at(lf, Math.cos(a) * rr, potH - 0.05, Math.sin(a) * rr, (R() - 0.5) * 0.25, R() * Math.PI, (R() - 0.5) * 0.25));
    }
    return g;
  }
  if (kind === "fig") {
    // Fíkus lyrata: kmínek se dvěma větvemi, velké listy po celé horní polovině.
    const trunk = [new THREE.Vector3(0, potH - 0.05, 0), new THREE.Vector3(0.02, potH + top * 0.4, -0.01), new THREE.Vector3(-0.02, potH + top * 0.75, 0.02), new THREE.Vector3(0.01, potH + top * 0.97, 0)];
    const stems = [trunk];
    for (const [a, l] of [[0.6, 0.45], [3.4, 0.38]] as const) {
      const b = new THREE.CatmullRomCurve3(trunk).getPoint(0.45 + R() * 0.1);
      stems.push([b, b.clone().add(new THREE.Vector3(Math.cos(a) * l * 0.35, l * 0.55, Math.sin(a) * l * 0.35)), b.clone().add(new THREE.Vector3(Math.cos(a) * l * 0.55, l, Math.sin(a) * l * 0.55))]);
    }
    stems.forEach((st, si) => {
      g.add(mesh(tube(st, si === 0 ? 0.013 : 0.008, 8), M.walnut));
      const curve = new THREE.CatmullRomCurve3(st);
      const n = si === 0 ? 34 : 16;
      for (let i = 0; i < n; i++) {
        const t = (si === 0 ? 0.35 : 0.25) + (si === 0 ? 0.65 : 0.75) * Math.pow(R(), 0.6);
        const p = curve.getPoint(t);
        const L = 0.22 + R() * 0.13;
        const lf = mesh(leafCard(L, L * 0.72, 0, 0.25, 0.25), M.leaf);
        lf.rotation.order = "YXZ";
        at(lf, p.x, p.y, p.z, -(0.55 + R() * 0.85), R() * Math.PI * 2, (R() - 0.5) * 0.4);
        g.add(lf);
      }
    });
    return g;
  }
  // Keřík: drobné lístky na krátkých stoncích do tvaru kopule.
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2, el = Math.acos(1 - R() * 0.9);
    const rr = top * 0.55 * (0.7 + R() * 0.3);
    const x = Math.sin(el) * Math.cos(a) * rr, z = Math.sin(el) * Math.sin(a) * rr, y = potH + Math.cos(el) * rr * 0.9;
    const lf = mesh(leafCard(0.07 + R() * 0.03, 0.045, R() < 0.5 ? 1 : 3, 0.2, 0.2), M.leaf);
    lf.rotation.order = "YXZ";
    at(lf, x, y, z, -(0.3 + R() * 1.0), a + Math.PI / 2 + (R() - 0.5), (R() - 0.5) * 0.5);
    g.add(lf);
  }
  return g;
}

export function artFrame(M: Materials, w: number, h: number, seed: number, colors: string[]) {
  const g = new THREE.Group();
  g.add(box(w, h, 0.025, M.frameDark, 0, false));
  // Pasparta a obraz pod sklem.
  g.add(put(mesh(plane(w - 0.03, h - 0.03), M.paper, false), 0, 0.015, 0.0128));
  const avg = colors.map((c) => linearOf(parseInt(c.slice(1), 16))).reduce((a, c) => [a[0] + c[0] / colors.length, a[1] + c[1] / colors.length, a[2] + c[2] / colors.length], [0, 0, 0]);
  const canvasMat = meta(std(0xffffff, 0.9, 0, { map: artTexture(seed, colors) }), { albedo: avg as [number, number, number] });
  const m = Math.min(w, h) * 0.14;
  g.add(put(mesh(plane(w - 2 * m, h - 2 * m), canvasMat, false), 0, m, 0.0132));
  return g;
}

/** Záclona: nepravidelné sklady, dole mírně rozevřená, horní hrana v kolejnici. */
export function curtain(M: Materials, w: number, h: number, seed = 1) {
  const nx = Math.max(10, Math.round(w / 0.015)), ny = Math.ceil(h / 0.06);
  const R = rng(seed * 31 + 7);
  const ph = Array.from({ length: 8 }, () => R() * 6);
  const geo = new THREE.PlaneGeometry(w, h, nx, ny);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const v = 0.5 - y / h; // 0 nahoře, 1 dole
    const pleat = x / 0.105 + 0.35 * Math.sin(x * 9 + ph[0]) + 0.2 * Math.sin(x * 23 + ph[1]);
    const amp = 0.026 + 0.012 * Math.sin(x * 5 + ph[2]) + v * 0.012;
    pos.setZ(i, Math.sin(pleat * Math.PI * 2) * amp + v * v * 0.035 * Math.sin(x * 3 + ph[3]));
    pos.setX(i, x * (1 + v * 0.05));
  }
  geo.computeVertexNormals();
  geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, M.sheer);
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ kuchyň */

/** Spodní linka po délce osy x, hloubka 0,62 m, bezúchytková dvířka se spárami 3 mm. */
export function kitchenBase(M: Materials, len: number, front: THREE.Material, opts: { sinkAt?: number; hobAt?: number } = {}) {
  const g = new THREE.Group();
  g.add(put(box(len, 0.1, 0.52, M.blackMatte, 0), 0, 0, -0.05));
  g.add(put(box(len, 0.78, 0.58, M.white, 0), 0, 0.1, -0.02));
  const n = Math.max(1, Math.round(len / 0.6));
  const fw = len / n;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + fw * (i + 0.5);
    const drawers = i % 3 === 1 ? [0.2, 0.27, 0.29] : [0.76];
    let y = 0.105;
    for (const dh of drawers) {
      g.add(put(box(fw - 0.003, dh - 0.003, 0.019, front, 0), x, y, 0.29));
      // Úchytová lišta (tenký tmavý profil pod horní hranou).
      g.add(put(box(fw * 0.62, 0.01, 0.016, M.black, 0), x, y + dh - 0.028, 0.305));
      y += dh;
    }
  }
  g.add(put(box(len + 0.02, 0.03, 0.635, M.counter, 0), 0, 0.885, 0));
  if (opts.sinkAt !== undefined) {
    const sx = opts.sinkAt;
    g.add(put(box(0.56, 0.003, 0.44, M.steel, 0), sx, 0.915, 0.02));
    g.add(put(box(0.5, 0.004, 0.38, std(0x6e7274, 0.35, 0.8), 0), sx, 0.916, 0.02));
    g.add(put(cyl(0.022, 0.024, 0.02, M.chrome, 20), sx, 0.915, -0.22));
    // Baterie: stojan a obloukový výtok.
    g.add(put(mesh(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.26, 0), new THREE.Vector3(0, 0.33, 0.06), new THREE.Vector3(0, 0.3, 0.17), new THREE.Vector3(0, 0.25, 0.19)], 0.011, 12), M.chrome), sx, 0.93, -0.22));
    g.add(put(mesh(roundedBox(0.012, 0.01, 0.07, 0.004), M.chrome), sx + 0.02, 1.04, -0.22));
  }
  if (opts.hobAt !== undefined) {
    g.add(put(box(0.6, 0.005, 0.5, M.glassBlack, 0), opts.hobAt, 0.915, 0.02));
    for (const [dx, dz, r] of [[-0.15, -0.1, 0.09], [0.15, -0.1, 0.09], [-0.15, 0.12, 0.08], [0.15, 0.12, 0.1]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.004, r, 48).rotateX(-Math.PI / 2), std(0x3a3a3a, 0.3));
      g.add(put(ring, opts.hobAt + dx, 0.9205, 0.02 + dz));
    }
    // Rychlovarná konvice a prkénko.
    g.add(put(mesh(lathe([[0, 0], [0.075, 0], [0.085, 0.02], [0.088, 0.14], [0.07, 0.2], [0.03, 0.215], [0.03, 0.225], [0, 0.225]], 32), std(0xe9e6e0, 0.3)), opts.hobAt + 0.55, 0.9, -0.12));
  }
  // Doplňky na desce.
  g.add(put(mesh(roundedBox(0.42, 0.022, 0.28, 0.008), M.oak), -len / 2 + 0.45, 0.926, -0.16, 0.08));
  g.add(put(mesh(lathe([[0, 0], [0.032, 0], [0.034, 0.2], [0.012, 0.25], [0.012, 0.28], [0, 0.28]], 20), std(0x4d5c33, 0.12)), -len / 2 + 0.72, 0.915, -0.22));
  g.add(put(pot(M, 0.07, 0.12, M.potWhite), -len / 2 + 0.25, 0.915, -0.2));
  const R = rng(71);
  for (let i = 0; i < 10; i++) g.add(put(mesh(leafCard(0.07, 0.04, 1, 0.2, 0.2), M.leaf), -len / 2 + 0.25 + (R() - 0.5) * 0.08, 1.0 + R() * 0.05, -0.2 + (R() - 0.5) * 0.08, R() * 6));
  return g;
}

export function kitchenUpper(M: Materials, len: number, front: THREE.Material, stripShade: THREE.MeshStandardMaterial) {
  const g = new THREE.Group();
  g.add(put(box(len, 0.72, 0.33, M.white, 0), 0, 0, 0));
  const n = Math.max(1, Math.round(len / 0.5));
  const fw = len / n;
  for (let i = 0; i < n; i++) g.add(put(box(fw - 0.003, 0.716, 0.019, front, 0), -len / 2 + fw * (i + 0.5), 0.002, 0.175));
  g.add(put(box(len - 0.04, 0.008, 0.02, stripShade, 0), 0, -0.008, 0.12));
  return g;
}

export function tallUnit(M: Materials, w: number, h: number, front: THREE.Material, oven: boolean) {
  const g = new THREE.Group();
  g.add(put(box(w, 0.1, 0.52, M.blackMatte), 0, 0, -0.04));
  g.add(put(box(w, h - 0.1, 0.58, M.white), 0, 0.1, -0.02));
  if (oven) {
    g.add(put(box(w - 0.003, 0.5, 0.019, front, 0), 0, 0.103, 0.29));
    g.add(put(box(w - 0.02, 0.58, 0.02, M.glassBlack, 0), 0, 0.64, 0.292));
    g.add(put(box(w - 0.04, 0.05, 0.004, std(0x1d1d1d, 0.4), 0), 0, 1.17, 0.303));
    g.add(put(mesh(roundedBox(w * 0.62, 0.014, 0.022, 0.006), M.steel), 0, 1.13, 0.315));
    g.add(put(box(w - 0.003, h - 1.3, 0.019, front, 0), 0, 1.25, 0.29));
  } else {
    g.add(put(box(w - 0.003, 1.25, 0.019, front, 0), 0, 0.103, 0.29));
    g.add(put(box(w - 0.003, h - 1.37, 0.019, front, 0), 0, 1.36, 0.29));
    g.add(put(mesh(roundedBox(0.012, 0.7, 0.018, 0.005), M.black), w / 2 - 0.05, 0.55, 0.305));
  }
  return g;
}

export function hood(M: Materials) {
  // Plochá digestoř (spodní hrana y = 0) s komínem až ke stropu.
  return group(put(mesh(roundedBox(0.6, 0.05, 0.48, 0.008), M.steel), 0, 0.025, 0.05), put(mesh(roundedBox(0.26, 1.16, 0.24, 0.004), M.steel), 0, 0.05 + 0.58, -0.05));
}

/** Ostrůvek po ose x, sezení na straně +z (přesah desky). */
export function island(M: Materials, len: number, depth: number, front: THREE.Material) {
  const g = new THREE.Group();
  const body = depth - 0.28;
  g.add(put(box(len - 0.04, 0.1, body - 0.06, M.blackMatte), 0, 0, -0.14));
  g.add(put(box(len, 0.78, body, front, 0.008), 0, 0.1, -0.14));
  const n = Math.max(1, Math.round(len / 0.6));
  for (let i = 1; i < n; i++) g.add(put(box(0.003, 0.72, 0.003, M.blackMatte, 0), -len / 2 + (len / n) * i, 0.13, -0.14 - body / 2 - 0.001));
  g.add(put(box(len + 0.04, 0.04, depth, M.counter, 0), 0, 0.88, 0));
  // Na desce: mísa s citrony, váza s větvičkou.
  g.add(put(mesh(lathe([[0, 0], [0.05, 0], [0.13, 0.05], [0.15, 0.08], [0.142, 0.08], [0.12, 0.055], [0, 0.015]], 36), std(0xe7e1d6, 0.35)), -len * 0.22, 0.92, 0.05));
  for (let i = 0; i < 5; i++) g.add(put(ellipsoid(0.036, 0.032, 0.034, std(0xe0b83a, 0.45), 12), -len * 0.22 + Math.cos(i * 1.3) * 0.05, 0.965 + (i === 4 ? 0.035 : 0), 0.05 + Math.sin(i * 1.3) * 0.05, i));
  g.add(put(mesh(lathe([[0, 0], [0.045, 0], [0.05, 0.1], [0.03, 0.2], [0.028, 0.22], [0, 0.22]], 28), std(0x9aa393, 0.5)), len * 0.28, 0.92, -0.05));
  return g;
}

export function barStool(M: Materials) {
  const g = new THREE.Group();
  g.add(put(mesh(cylinder(0.19, 0.18, 0.045, 36, 0.015), M.oak), 0, 0.66, 0));
  for (const [x, z] of corners(0.13, 0.13)) {
    const l = put(cyl(0.011, 0.013, 0.67, M.black, 10), x, 0, z);
    l.rotation.set(z > 0 ? -0.1 : 0.1, 0, x > 0 ? 0.1 : -0.1);
    g.add(l);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.008, 8, 36), M.black);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.26;
  ring.castShadow = true;
  g.add(ring);
  return g;
}

export function pendant(M: Materials, drop: number, shade: THREE.MeshStandardMaterial) {
  const g = new THREE.Group();
  g.add(put(cyl(0.035, 0.035, 0.012, M.black, 20), 0, -0.012, 0));
  g.add(put(cyl(0.0025, 0.0025, drop, M.black, 5), 0, -drop, 0));
  g.add(put(mesh(lathe([[0.012, 0.16], [0.03, 0.155], [0.09, 0.13], [0.135, 0.07], [0.155, 0.0], [0.15, 0.0], [0.128, 0.065], [0.085, 0.12], [0.028, 0.145], [0.012, 0.15]], 40), M.black), 0, -drop - 0.16, 0));
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.145, 36), shade);
  inner.rotation.x = Math.PI / 2;
  inner.position.y = -drop - 0.155;
  g.add(inner);
  return g;
}

/* ------------------------------------------------------------------ ložnice */

export function bed(M: Materials, w = 1.8, l = 2.1) {
  const g = new THREE.Group();
  const fab = M.headboard;
  const frameH = 0.3, matH = 0.2;
  for (const [x, z] of corners(w / 2 - 0.1, l / 2 - 0.1)) g.add(at(leg(M, 0.06, 0.03, 0.026), x, 0, z));
  g.add(at(mesh(cushion(w + 0.08, frameH - 0.06, l + 0.02, 0.04, [0.006, 0.004, 0.006], 81), fab), 0, 0.06 + (frameH - 0.06) / 2, 0));
  // Čelo se svislými prošitými pruhy.
  const nCh = 6, chW = (w + 0.1) / nCh;
  for (let i = 0; i < nCh; i++) g.add(at(mesh(cushion(chW + 0.004, 0.95, 0.1, 0.045, [0.02, 0.006, 0.02], 90 + i), fab), -(w + 0.1) / 2 + chW * (i + 0.5), 0.2 + 0.475, -l / 2 - 0.02));
  g.add(at(mesh(cushion(w, matH, l - 0.04, 0.06, [0.006, 0.01, 0.006], 83), M.sheet), 0, frameH + matH / 2, 0.0));
  // Přikrývka: měkká vrstva přes spodní dvě třetiny, po stranách a u nohou splývá se záhyby.
  const top = frameH + matH;
  const dl = l * 0.72, z0 = l / 2 - dl;
  const R = rng(85);
  const ph = [R() * 6, R() * 6, R() * 6];
  const SIDE = 0.13, DROP = 0.27;
  g.add(mesh(cloth(52, 34, (u, v) => {
    // Napříč: [0, SIDE] levý převis, střed nahoře, [1 − SIDE, 1] pravý převis; podél: posledních 15 % převis u nohou.
    const ts = u < SIDE ? (SIDE - u) / SIDE : u > 1 - SIDE ? (u - (1 - SIDE)) / SIDE : 0;
    const sx = u < 0.5 ? -1 : 1;
    const tf = v > 0.85 ? (v - 0.85) / 0.15 : 0;
    const t = Math.max(ts, tf);
    const soft = 0.05 + 0.012 * Math.sin(u * 9 + ph[0]) * Math.sin(v * 7 + ph[1]) + 0.006 * Math.sin(u * 23 + v * 17 + ph[2]);
    const edge = (k: number) => Math.sin(Math.min(1, k * 2.2) * Math.PI / 2); // zaoblení přes hranu matrace
    const fold = (k: number, s: number) => Math.sin(s * 26 + ph[0]) * 0.014 * k;
    const x = ts > 0 ? sx * (w / 2 + 0.03 * edge(ts) + fold(ts, v)) : (u - 0.5) / (0.5 - SIDE) * (w / 2);
    const z = tf > 0 ? l / 2 + 0.02 + 0.03 * edge(tf) + fold(tf, u) : z0 + (v / 0.85) * (l / 2 + 0.02 - z0);
    return [x, top + soft * (1 - t * 0.6) - DROP * Math.max(0, t - 0.2) / 0.8 - 0.02 * edge(t), z];
  }), M.linen));
  // Přehnutý okraj přikrývky u polštářů.
  g.add(at(mesh(cushion(w + 0.02, 0.05, 0.3, 0.025, [0.004, 0.012, 0.01], 87), M.linen), 0, top + 0.06, z0 + 0.1));
  // Polštáře: dva velké bílé, dva lněné a malý válec.
  for (const s of [-1, 1]) {
    g.add(at(mesh(pillow(0.72, 0.48, 0.16, 88 + s), M.sheet), s * 0.42, top + 0.2, -l / 2 + 0.22, -1.05, s * 0.04, 0));
    g.add(at(mesh(pillow(0.55, 0.45, 0.15, 91 + s), s < 0 ? M.sage : M.ochre), s * 0.34, top + 0.22, -l / 2 + 0.38, -1.12, s * 0.12, s * 0.05));
  }
  // Pletený přehoz přes nohy postele: měkké vlny a splývání přes okraje se záhyby.
  g.add(mesh(cloth(48, 14, (u, v) => {
    const x = (u - 0.5) * (w + 0.5);
    const over = Math.max(0, Math.abs(x) - w / 2 - 0.02);
    const z = l / 2 - 0.62 + v * 0.5;
    const wave = 0.018 * Math.sin(u * 23 + v * 2.5) + 0.012 * Math.sin(u * 7 - v * 4);
    const hang = Math.min(1, over * 8);
    return [
      Math.sign(x) * Math.min(Math.abs(x), w / 2 + 0.07 + 0.015 * Math.sin(v * 17 + u * 5) * hang),
      top + 0.07 + wave * (1 - hang * 0.7) - Math.min(0.32, over * 2.4),
      z + Math.sin(u * 13) * 0.012 + 0.02 * Math.sin(v * Math.PI) * Math.sin(u * 9),
    ];
  }), M.knit));
  return g;
}

export function nightstand(M: Materials) {
  const g = group(put(mesh(roundedBox(0.46, 0.46, 0.4, 0.012), M.oak), 0, 0.29, 0));
  for (const [x, z] of corners(0.18, 0.14)) g.add(at(leg(M, 0.06, 0.012, 0.01, M.oak), x, 0, z));
  g.add(put(box(0.44, 0.003, 0.003, M.walnut, 0), 0, 0.4, 0.2));
  g.add(put(mesh(roundedBox(0.12, 0.012, 0.016, 0.005), M.brass), 0, 0.44, 0.205));
  g.add(at(book(M, 0.2, 0.03, 0.14, std(0x6f7d88, 0.8)), 0.08, 0.52, 0.06, 0, 0.3));
  return g;
}

export function tableLamp(M: Materials, mode: LampInfo["mode"] = "evening") {
  const shade = shadeMaterial(0xf3ece0);
  const g = group(
    mesh(lathe([[0, 0], [0.06, 0], [0.085, 0.05], [0.09, 0.12], [0.07, 0.2], [0.03, 0.25], [0.012, 0.26], [0, 0.26]], 32), std(0xb46c4b, 0.5)),
    at(mesh(cylinder(0.13, 0.16, 0.2, 40, 0, true), shade), 0, 0.26, 0),
  );
  g.add(lampMark(0, 0.35, 0, { color: 0xffc27f, intensity: 3.2, distance: 5, mode, shades: [shade], radius: 0.03 }));
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
    g.add(put(box(dw - 0.003, h - 0.083, 0.019, M.lacquer, 0), x, 0.081, depth / 2 - 0.01));
    const side = i % 2 === 0 ? 1 : -1;
    g.add(put(mesh(roundedBox(0.014, 0.42, 0.024, 0.006), M.oak), x + side * (dw / 2 - 0.04), 0.9, depth / 2 + 0.01));
  }
  return g;
}

export function bench(M: Materials, len = 1.2) {
  const g = new THREE.Group();
  for (const [x, z] of corners(len / 2 - 0.06, 0.13)) g.add(at(leg(M, 0.36, 0.02, 0.015), x, 0, z));
  g.add(at(mesh(cushion(len, 0.11, 0.4, 0.04, [0.006, 0.02, 0.01], 101), M.charcoalFabric), 0, 0.42, 0));
  return g;
}

/* ------------------------------------------------------------------ koupelna */

export function bathtub(M: Materials, l = 1.8, w = 0.75, h = 0.56) {
  const g = new THREE.Group();
  const t = 0.07;
  g.add(put(box(l, h, t, M.lacquer, 0.012), 0, 0, w / 2 - t / 2));
  g.add(put(box(l, h, t, M.lacquer, 0.012), 0, 0, -w / 2 + t / 2));
  for (const s of [-1, 1]) g.add(put(box(t, h, w - 2 * t, M.lacquer, 0.012), s * (l / 2 - t / 2), 0, 0));
  g.add(put(mesh(cushion(l - 2 * t, 0.12, w - 2 * t, 0.05, [0, -0.02, 0], 111), M.ceramic), 0, 0.3, 0));
  const tap = put(mesh(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0, 0.16, 0.05), new THREE.Vector3(0, 0.14, 0.12)], 0.011, 12), M.chrome), l / 2 - 0.28, h, -w / 2 + 0.035);
  g.add(tap);
  // Složený ručník na okraji.
  g.add(put(mesh(cushion(0.32, 0.05, 0.22, 0.02, [0.004, 0.01, 0.004], 113), M.sage), -l / 2 + 0.25, h + 0.025, w / 2 - 0.04));
  return g;
}

export function vanity(M: Materials, w = 0.9, d = 0.48) {
  const g = new THREE.Group();
  g.add(put(mesh(roundedBox(w, 0.42, d, 0.008), M.oak), 0, 0.63, 0));
  g.add(put(box(w - 0.02, 0.003, 0.003, M.walnut, 0), 0, 0.63, d / 2));
  g.add(put(box(w + 0.02, 0.025, d + 0.01, M.counter, 0), 0, 0.84, 0));
  g.add(put(mesh(lathe([[0, 0], [0.12, 0], [0.18, 0.03], [0.2, 0.08], [0.2, 0.13], [0.19, 0.13], [0.185, 0.085], [0.165, 0.045], [0.1, 0.03], [0, 0.03]], 48), M.ceramic), 0, 0.865, 0.02));
  g.add(put(mesh(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.26, 0), new THREE.Vector3(0, 0.3, 0.05), new THREE.Vector3(0, 0.28, 0.13)], 0.011, 12), M.chrome), 0, 0.865, -d / 2 + 0.06));
  // Dávkovač mýdla a lahvička.
  g.add(put(mesh(lathe([[0, 0], [0.03, 0], [0.032, 0.12], [0.012, 0.14], [0.012, 0.17], [0, 0.17]], 20), std(0x8c9b8a, 0.35)), -w / 2 + 0.12, 0.865, -0.1));
  g.add(put(mesh(lathe([[0, 0], [0.025, 0], [0.026, 0.09], [0.01, 0.11], [0, 0.11]], 20), std(0xe6ddd0, 0.4)), -w / 2 + 0.2, 0.865, -0.14));
  return g;
}

export function toilet(M: Materials) {
  const g = new THREE.Group();
  g.add(put(mesh(cushion(0.36, 0.3, 0.52, 0.12, [0.01, 0, 0.01], 121), M.ceramic), 0, 0.3, 0.27));
  g.add(put(mesh(roundedBox(0.37, 0.03, 0.48, 0.014), M.ceramic), 0, 0.46, 0.28));
  g.add(put(mesh(roundedBox(0.24, 0.16, 0.012, 0.005), M.chrome), 0, 0.95, 0.006));
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
  // Ručník přehozený přes horní tyče (měkce splývá).
  g.add(mesh(cloth(14, 20, (u, v) => {
    const x = (u - 0.5) * (w - 0.06);
    const y = 1.2 - v * 0.62;
    const z = 0.075 + Math.sin(u * Math.PI) * 0.012 + v * 0.01 + Math.sin(u * 11) * 0.004;
    return [x, y, z];
  }), towel));
  return g;
}

/* ------------------------------------------------------------------ předsíň */

export function shoeCabinet(M: Materials, len = 1.0, h = 0.86, d = 0.32) {
  const g = new THREE.Group();
  g.add(put(box(len, h - 0.02, d, M.lacquer, 0.006), 0, 0.02, 0));
  g.add(put(mesh(roundedBox(len + 0.02, 0.025, d + 0.01, 0.006), M.oak), 0, h + 0.0125, 0));
  for (let i = 1; i < 3; i++) g.add(put(box(len - 0.02, 0.003, 0.003, M.whiteMatte, 0), 0, (h / 3) * i, d / 2));
  g.add(put(mesh(lathe([[0, 0], [0.05, 0], [0.065, 0.06], [0.06, 0.14], [0.055, 0.14], [0, 0.13]], 28), M.terracotta), len / 2 - 0.15, h + 0.025, 0));
  g.add(put(mesh(roundedBox(0.2, 0.05, 0.12, 0.01), M.walnut), -len / 2 + 0.2, h + 0.05, 0));
  return g;
}

export function roundMirror(M: Materials, r = 0.36) {
  const geo = new THREE.TorusGeometry(r - 0.01, 0.012, 10, 64);
  const g = group(new THREE.Mesh(geo, M.brass));
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r - 0.012, 48), M.mirror);
  glass.position.z = 0.002;
  g.add(glass);
  return g;
}

export function coatRack(M: Materials, len = 0.9) {
  const g = new THREE.Group();
  g.add(put(mesh(roundedBox(len, 0.08, 0.025, 0.006), M.oak), 0, 1.72, 0.0125));
  for (let i = 0; i < 4; i++) {
    const peg = put(cyl(0.012, 0.012, 0.08, M.oak, 10), -len / 2 + 0.12 + i * ((len - 0.24) / 3), 1.76, 0.06);
    peg.rotation.x = Math.PI / 2;
    g.add(peg);
  }
  // Kabáty: měkké objemné tvary zavěšené na věšácích (ramena užší, dole se rozšiřují).
  const coat = (x: number, wid: number, len2: number, color: number, seed: number) => {
    const c = mesh(cushion(wid, len2, 0.13, 0.06, [0.03, 0.01, 0.04], seed), meta(std(color, 0.95), {}));
    const p = c.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = 0.5 - p.getY(i) / len2; // 0 nahoře, 1 dole
      p.setX(i, p.getX(i) * (0.62 + 0.38 * Math.min(1, t * 1.6)));
      p.setZ(i, p.getZ(i) * (0.7 + 0.3 * t));
    }
    c.geometry.computeVertexNormals();
    g.add(at(c, x, 1.74 - len2 / 2, 0.085, 0.03, 0, (seed % 2 ? 1 : -1) * 0.02));
  };
  coat(-len / 2 + 0.16, 0.46, 0.95, 0x6b5a48, 131);
  coat(len / 2 - 0.25, 0.4, 0.82, 0x3f4a52, 133);
  return g;
}

/* ------------------------------------------------------------------ architektura */

export function doorLeaf(M: Materials, w: number, h: number, mat: THREE.Material = M.door) {
  const g = group(put(box(w, h, 0.04, mat, 0), 0, 0, 0));
  for (const s of [-1, 1]) {
    g.add(put(mesh(roundedBox(0.14, 0.018, 0.018, 0.008), M.black), w / 2 - 0.13, 1.02, s * 0.045));
    g.add(put(cyl(0.025, 0.025, 0.01, M.black, 16), w / 2 - 0.07, 1.02, s * 0.025).rotateX(Math.PI / 2));
  }
  return g;
}

/** Zárubeň/obložka otvoru: šířka po ose x, tloušťka stěny po ose z. */
export function doorCasing(M: Materials, w: number, h: number, t: number) {
  const g = new THREE.Group();
  const d = t + 0.024;
  for (const s of [-1, 1]) g.add(put(box(0.055, h + 0.055, d, M.door, 0), s * (w / 2 + 0.0275), 0, 0));
  g.add(put(box(w + 0.11, 0.055, d, M.door, 0), 0, h, 0));
  return g;
}

/** Okno v otvoru w × h (šířka po ose x): rám, křídla s kličkou, sklo a vnitřní parapet. */
export function windowUnit(M: Materials, w: number, h: number, t: number, sill: boolean) {
  const g = new THREE.Group();
  const f = 0.07, fd = 0.08, s = 0.055;
  const frame = M.white;
  g.add(put(box(w, f, fd, frame, 0), 0, 0, 0));
  g.add(put(box(w, f, fd, frame, 0), 0, h - f, 0));
  for (const sd of [-1, 1]) g.add(put(box(f, h, fd, frame, 0), sd * (w / 2 - f / 2), 0, 0));
  const leaves = w > 1.1 ? 2 : 1;
  const lw = (w - 2 * f) / leaves;
  for (let i = 0; i < leaves; i++) {
    const cx = -w / 2 + f + lw * (i + 0.5);
    // Křídlo: rám kolem skla, mírně předsazený do místnosti.
    g.add(put(box(lw, s, 0.068, frame, 0), cx, f, 0.012));
    g.add(put(box(lw, s, 0.068, frame, 0), cx, h - f - s, 0.012));
    for (const sd of [-1, 1]) g.add(put(box(s, h - 2 * f, 0.068, frame, 0), cx + sd * (lw / 2 - s / 2), f, 0.012));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(lw - 2 * s, h - 2 * f - 2 * s), M.glass);
    glass.position.set(cx, h / 2, 0.01);
    g.add(glass);
    // Klička na vnitřní straně křídla.
    const hx = cx + (i === 0 && leaves === 2 ? lw / 2 - s / 2 : -lw / 2 + s / 2);
    g.add(put(mesh(roundedBox(0.022, 0.035, 0.012, 0.005), M.whiteMatte), hx, Math.min(1.1, h * 0.5), 0.052));
    g.add(put(mesh(roundedBox(0.016, 0.12, 0.016, 0.007), M.whiteMatte), hx, Math.min(1.1, h * 0.5) - 0.11, 0.065));
  }
  if (sill) g.add(put(mesh(roundedBox(w + 0.08, 0.025, t * 0.5 + 0.13, 0.004), M.whiteMatte), 0, -0.025, t * 0.25 + 0.065));
  return g;
}

/** Deskový radiátor pod oknem (s ventily). */
export function radiator(M: Materials, w: number, h: number) {
  const g = new THREE.Group();
  const n = Math.round(w / 0.05);
  for (let i = 0; i < n; i++) g.add(put(mesh(roundedBox(w / n - 0.006, h, 0.022, 0.009), M.whiteMatte), -w / 2 + (w / n) * (i + 0.5), 0, 0.05));
  g.add(put(box(w, h - 0.04, 0.02, M.whiteMatte, 0), 0, 0.02, 0.025));
  for (const s of [-1, 1]) g.add(put(cyl(0.012, 0.012, 0.1, M.chrome, 10), s * (w / 2 + 0.02), -0.12, 0.05));
  return g;
}

/** Zásuvka nebo vypínač (bílý rámeček), líc +z. */
export function wallPlate(M: Materials, kind: "socket" | "switch") {
  const g = group(mesh(roundedBox(0.085, 0.085, 0.01, 0.004), M.whiteMatte, false));
  if (kind === "socket") g.add(put(cyl(0.022, 0.022, 0.006, std(0xe4e2dc, 0.6), 24, false), 0, -0.003, 0.005).rotateX(Math.PI / 2));
  else g.add(put(mesh(roundedBox(0.05, 0.05, 0.008, 0.003), M.whiteMatte, false), 0, 0, 0.007));
  return g;
}
