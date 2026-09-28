import * as THREE from "three";

/**
 * Generátory geometrie. Plochy jsou jemně a rovnoměrně rozdělené (výchozí krok 6 cm), protože
 * předpočítané světlo nábytku je uložené ve vrcholech — velký trojúhelník by měl jen tři vzorky.
 * UV souřadnice jsou v metrech (projekce podle převládající normály), textury látek a dřeva
 * tak mají na všech kusech stejné měřítko.
 */

export const STEP = 0.06;

const span = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/** Souřadnice podél osy: zaoblení se dělí po úhlu, rovná část rovnoměrně. */
function axisCoords(half: number, r: number, step: number, arcSeg: number): number[] {
  const flat = half - r;
  const inner = span(-flat, flat, Math.max(1, Math.ceil((2 * flat) / step)));
  if (r <= 0) return inner;
  const arc: number[] = [];
  for (let k = 1; k <= arcSeg; k++) arc.push(flat + r * Math.tan((k / arcSeg) * (Math.PI / 4)));
  return [...arc.map((v) => -v).reverse(), ...inner, ...arc];
}

/** Doplní UV v metrech podle převládající osy normály (lokální souřadnice). */
export function metricUV(g: THREE.BufferGeometry, scale = 1) {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/**
 * Kvádr w × h × d se zaoblenými hranami o poloměru r, střed v počátku. Každá stěna je mřížka;
 * body v pásmu zaoblení se promítnou na kouli/válec kolem vnitřního kvádru.
 */
export function roundedBox(w: number, h: number, d: number, r = 0, step = STEP): THREE.BufferGeometry {
  const half = [w / 2, h / 2, d / 2];
  // Zaoblení pod 6 mm není na vzdálenost pohledu vidět — hrana zůstane ostrá (méně vrcholů).
  const r0 = r < 0.006 ? 0 : r;
  const rr = Math.max(0, Math.min(r0, half[0] - 1e-4, half[1] - 1e-4, half[2] - 1e-4));
  const arcSeg = rr > 0 ? Math.max(2, Math.min(3, Math.ceil(rr / 0.015))) : 0;
  const coords = half.map((hs) => axisCoords(hs, rr, step, arcSeg));
  const inner = half.map((hs) => hs - rr);
  // Stěna: osa normály a, směr s, osy mřížky b, c (pořadí volí orientaci trojúhelníků ven).
  const faces: [number, 1 | -1, number, number][] = [[0, 1, 1, 2], [0, -1, 2, 1], [1, 1, 2, 0], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 1, 0]];
  let nv = 0, ni = 0;
  for (const [, , b, c] of faces) { nv += coords[b].length * coords[c].length; ni += (coords[b].length - 1) * (coords[c].length - 1) * 6; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  const v = [0, 0, 0];
  for (const [a, s, b, c] of faces) {
    const base = vo;
    const cb = coords[b], cc = coords[c];
    for (let j = 0; j < cc.length; j++) {
      for (let i = 0; i < cb.length; i++) {
        v[a] = s * half[a]; v[b] = cb[i]; v[c] = cc[j];
        let px = v[0], py = v[1], pz = v[2], nx = 0, ny = 0, nz = 0;
        if (rr > 0) {
          const qx = Math.max(-inner[0], Math.min(inner[0], px)), qy = Math.max(-inner[1], Math.min(inner[1], py)), qz = Math.max(-inner[2], Math.min(inner[2], pz));
          nx = px - qx; ny = py - qy; nz = pz - qz;
          let l = Math.hypot(nx, ny, nz);
          if (l < 1e-6) { nx = a === 0 ? s : 0; ny = a === 1 ? s : 0; nz = a === 2 ? s : 0; l = 1; }
          nx /= l; ny /= l; nz /= l;
          px = qx + nx * rr; py = qy + ny * rr; pz = qz + nz * rr;
        } else { nx = a === 0 ? s : 0; ny = a === 1 ? s : 0; nz = a === 2 ? s : 0; }
        pos[vo * 3] = px; pos[vo * 3 + 1] = py; pos[vo * 3 + 2] = pz;
        nor[vo * 3] = nx; nor[vo * 3 + 1] = ny; nor[vo * 3 + 2] = nz;
        vo++;
      }
    }
    const nb = cb.length;
    for (let j = 0; j < cc.length - 1; j++) {
      for (let i = 0; i < nb - 1; i++) {
        const k = base + j * nb + i;
        idx[io++] = k; idx[io++] = k + 1; idx[io++] = k + nb; idx[io++] = k + 1; idx[io++] = k + nb + 1; idx[io++] = k + nb;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return metricUV(g);
}

/**
 * Rotační těleso z profilu [poloměr, výška] (od osy dolů, přes obvod, nahoru). Profil se dělí
 * na úseky ≤ step, normály se počítají z tečny profilu (ostré zlomy zadejte zdvojeným bodem).
 */
export function lathe(profile: [number, number][], seg = 32, step = STEP): THREE.BufferGeometry {
  // Zjemnění profilu.
  const pts: [number, number][] = [];
  for (let i = 0; i < profile.length; i++) {
    const [r, y] = profile[i];
    if (i > 0) {
      const [r0, y0] = profile[i - 1];
      const n = Math.ceil(Math.hypot(r - r0, y - y0) / step);
      for (let k = 1; k < n; k++) pts.push([r0 + ((r - r0) * k) / n, y0 + ((y - y0) * k) / n]);
    }
    pts.push([r, y]);
  }
  // Normály profilu (2D), zdvojený bod = ostrá hrana.
  const normals: [number, number][] = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const same = (u: [number, number], v: [number, number]) => Math.abs(u[0] - v[0]) + Math.abs(u[1] - v[1]) < 1e-7;
    let t: [number, number];
    if (i > 0 && same(pts[i - 1], pts[i])) t = [b[0] - pts[i][0], b[1] - pts[i][1]];
    else if (i < pts.length - 1 && same(pts[i + 1], pts[i])) t = [pts[i][0] - a[0], pts[i][1] - a[1]];
    else t = [b[0] - a[0], b[1] - a[1]];
    const l = Math.hypot(t[0], t[1]) || 1;
    return [t[1] / l, -t[0] / l];
  });
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  const cols = seg + 1;
  for (let i = 0; i < pts.length; i++) {
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      pos.push(pts[i][0] * sn, pts[i][1], pts[i][0] * c);
      nor.push(normals[i][0] * sn, normals[i][1], normals[i][0] * c);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    for (let s = 0; s < seg; s++) {
      const k = i * cols + s;
      idx.push(k, k + 1, k + cols, k + 1, k + cols + 1, k + cols);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return metricUV(g);
}

/** Válec / komolý kužel s dnem na y = 0, volitelně se zaoblenými hranami (e) a bez podstav. */
export function cylinder(rt: number, rb: number, h: number, seg = 32, e = 0, open = false, step = STEP) {
  const prof: [number, number][] = [];
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    const n = Math.max(2, Math.ceil(r / 0.008));
    for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; prof.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  };
  const ee = Math.min(e, rb * 0.9, rt * 0.9, h / 2);
  if (!open) prof.push([0, 0]);
  if (ee > 0 && !open) arc(rb - ee, ee, ee, -Math.PI / 2, 0);
  else { if (!open) prof.push([rb, 0]); prof.push([rb, 0]); }
  if (ee > 0 && !open) arc(rt - ee, h - ee, ee, 0, Math.PI / 2);
  else { prof.push([rt, h]); if (!open) prof.push([rt, h]); }
  if (!open) prof.push([0, h]);
  return lathe(prof, seg, step);
}

/** Obdélník w × h ve svislé rovině (normála +z), jemně rozdělený; dolní hrana na y = 0. */
export function plane(w: number, h: number, step = STEP) {
  const g = new THREE.PlaneGeometry(w, h, Math.max(1, Math.ceil(w / step)), Math.max(1, Math.ceil(h / step)));
  g.translate(0, h / 2, 0);
  return metricUV(g);
}

/** Posun vrcholů podél normály funkcí f(x, y, z) (lokální souřadnice) + přepočet normál. */
export function displace(g: THREE.BufferGeometry, f: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => number) {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    const d = f(x, y, z, nx, ny, nz);
    p.setXYZ(i, x + nx * d, y + ny * d, z + nz * d);
  }
  smoothNormals(g);
  return g;
}

/** Přepočet normál s ohledem na zdvojené vrcholy na švech (stejná poloha = společná normála, pokud svírají < 60°). */
export function smoothNormals(g: THREE.BufferGeometry) {
  const old = (g.getAttribute("normal") as THREE.BufferAttribute).clone();
  g.computeVertexNormals();
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  const key = (i: number) => `${Math.round(p.getX(i) * 2e4)},${Math.round(p.getY(i) * 2e4)},${Math.round(p.getZ(i) * 2e4)}`;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < p.count; i++) { const k = key(i); const a = groups.get(k); if (a) a.push(i); else groups.set(k, [i]); }
  const acc = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    for (const i of ids) {
      a.fromBufferAttribute(old, i);
      acc.set(0, 0, 0);
      for (const j of ids) { b.fromBufferAttribute(old, j); if (a.dot(b) > 0.5) acc.add(b.fromBufferAttribute(n, j)); }
      if (acc.lengthSq() > 0) { acc.normalize(); n.setXYZ(i, acc.x, acc.y, acc.z); }
    }
  }
  n.needsUpdate = true;
  return g;
}

/**
 * Měkký díl (sedák, opěradlo, matrace): zaoblený kvádr, jehož stěny se vydouvají ven —
 * nejvíc uprostřed, k hranám nula. `bulge` [x, y, z] = vydutí stěn kolmých na danou osu.
 */
export function cushion(w: number, h: number, d: number, r: number, bulge: [number, number, number], seed = 1, step = STEP) {
  const g = roundedBox(w, h, d, r, step);
  const half = [w / 2, h / 2, d / 2];
  const R = mulberry(seed);
  const ph = [R() * 6, R() * 6, R() * 6];
  displace(g, (x, y, z, nx, ny, nz) => {
    const p = [x / half[0], y / half[1], z / half[2]];
    const n = [Math.abs(nx), Math.abs(ny), Math.abs(nz)];
    let s = 0;
    for (let a = 0; a < 3; a++) {
      const b = (a + 1) % 3, c = (a + 2) % 3;
      const f = Math.max(0, 1 - p[b] * p[b]) * Math.max(0, 1 - p[c] * p[c]);
      s += bulge[a] * f * n[a] * n[a];
    }
    // Jemné nepravidelnosti (vrásky potahu).
    const wr = 0.0025 * Math.sin(x * 23 + ph[0]) * Math.sin(z * 19 + ph[1]) + 0.0015 * Math.sin(y * 31 + x * 17 + ph[2]);
    return s + wr;
  });
  return g;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Polštář w × h s tloušťkou t: dvě plochy sešité po obvodu, tloušťka ke švu klesá k nule, rohy
 * se „přiškrtí“. Leží v rovině xy (líc +z), střed v počátku.
 */
export function pillow(w: number, h: number, t: number, seed = 1, n = 18) {
  const R = mulberry(seed);
  const ph = [R() * 6, R() * 6, R() * 6, R() * 6];
  const pos: number[] = [], idx: number[] = [];
  const cols = n + 1;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const u = (i / n) * 2 - 1, v = (j / n) * 2 - 1;
      // Rohy se stahují dovnitř, okraj se mírně prohne.
      const pinch = 1 - 0.08 * Math.pow(Math.abs(u * v), 1.5);
      const x = u * (w / 2) * pinch * (1 - 0.04 * (1 - v * v));
      const y = v * (h / 2) * pinch * (1 - 0.04 * (1 - u * u));
      const th = t / 2 * Math.pow(Math.max(0, 1 - u * u), 0.45) * Math.pow(Math.max(0, 1 - v * v), 0.45);
      const wr = th > 0 ? 0.004 * Math.sin(u * 5 + ph[0]) * Math.sin(v * 4 + ph[1]) + 0.0025 * Math.sin(u * 11 + v * 7 + ph[2]) : 0;
      pos.push(x, y, side * (th + wr * side));
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = base + j * cols + i;
      if (side > 0) idx.push(k, k + 1, k + cols, k + 1, k + cols + 1, k + cols);
      else idx.push(k, k + cols, k + 1, k + 1, k + cols, k + cols + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  smoothNormals(g);
  return metricUV(g);
}

/**
 * Látka (deka, přehoz, ručník): mřížka nx × nz nad rovinou xz, výšku a posun určuje f(u, v) → [x, y, z]
 * v metrech (u, v ∈ 0–1). Oboustranná tenká plocha.
 */
export function cloth(nx: number, nz: number, f: (u: number, v: number) => [number, number, number]) {
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) pos.push(...f(i / nx, j / nz));
  const cols = nx + 1;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * cols + i;
    idx.push(k, k + cols, k + 1, k + 1, k + cols, k + cols + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return metricUV(g);
}

/**
 * List jako prohnutá ploška (délka len, šířka wid) s UV do atlasu listů (dlaždice tile 0–3).
 * Počátek u řapíku, list míří podél +y; prohnutí napříč (cup) i po délce (bend).
 */
export function leafCard(len: number, wid: number, tile: number, cup = 0.15, bend = 0.2) {
  const nx = 3, ny = 5;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const tu = (tile % 2) * 0.5, tv = tile < 2 ? 0.5 : 0;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx - 0.5, v = j / ny;
    const x = u * wid, y = v * len * (1 - bend * 0.3 * v);
    const z = -cup * wid * (u * u * 4 - 1) * 0.25 + bend * len * v * v * 0.5;
    pos.push(x, y, z);
    // Atlas: list je v dlaždici svisle, řapík dole.
    uv.push(tu + (u + 0.5) * 0.5, tv + 0.5 - v * 0.5 * 0.98 - 0.005);
  }
  const cols = nx + 1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * cols + i; idx.push(k, k + 1, k + cols, k + 1, k + cols + 1, k + cols); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Trubka podél křivky (kohoutek, rám, oblouk lampy): kruhový průřez o poloměru r. */
export function tube(points: THREE.Vector3[], r: number, radial = 12, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  const len = curve.getLength();
  const g = new THREE.TubeGeometry(curve, Math.max(8, Math.ceil(len / 0.03)), r, radial, closed);
  return metricUV(g);
}
