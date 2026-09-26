import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { rng } from "./noise";

/** Stavebnice scény: materiály, primitiva (osa y = podlaha), měkké stíny a procedurální textury. */

export function std(color: THREE.ColorRepresentation, roughness = 0.8, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

export function createMaterials() {
  return {
    white: std(0xf2f0eb, 0.55),
    whiteMatte: std(0xefece6, 0.85),
    ceiling: std(0xf7f6f3, 0.95),
    lacquer: std(0xf4f2ee, 0.32),
    ceramic: std(0xf8f8f6, 0.12),
    black: std(0x23211f, 0.45, 0.3),
    blackMatte: std(0x2a2826, 0.7),
    steel: std(0xc9ccce, 0.28, 1),
    brass: std(0xb99a62, 0.32, 1),
    chrome: std(0xe8e8e8, 0.08, 1),
    oak: std(0xb88c5e, 0.62),
    oakLight: std(0xd2b38a, 0.6),
    walnut: std(0x6a4a34, 0.55),
    linen: std(0xe7e1d6, 0.95),
    sofa: std(0xb7aea2, 0.97),
    sage: std(0x8f9d86, 0.96),
    ochre: std(0xc49a62, 0.96),
    rust: std(0xa9674a, 0.96),
    charcoalFabric: std(0x55555a, 0.97),
    cream: std(0xefe8dc, 0.96),
    kitchenFront: std(0xdcd6cc, 0.5),
    kitchenDark: std(0x3f4441, 0.55),
    counter: std(0xe9e6e0, 0.28),
    stoneDark: std(0x2b2b2d, 0.2),
    glassBlack: std(0x141414, 0.08, 0.2),
    glass: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false }),
    // Bez skutečného odrazu by kovové zrcadlo odráželo jen obecné okolí (černá plocha) — světlé polomatné sklo působí věrněji.
    mirror: std(0xd7dee2, 0.16, 0.35),
    leaf: std(0x4b6a3a, 0.62, 0, { side: THREE.DoubleSide }),
    leaf2: std(0x5f7f45, 0.62, 0, { side: THREE.DoubleSide }),
    terracotta: std(0xb87252, 0.85),
    potWhite: std(0xe9e6df, 0.6),
    soil: std(0x3b2d22, 1),
    frameDark: std(0x3b3d3f, 0.5, 0.4),
    sheer: new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 1, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
    door: std(0xf1efea, 0.42),
    frontDoor: std(0x3c3e40, 0.5, 0.2),
  };
}
export type Materials = ReturnType<typeof createMaterials>;

function shadowed<T extends THREE.Mesh>(m: T, cast = true): T { m.castShadow = cast; m.receiveShadow = true; return m; }

/** Kvádr s dnem na y=0 (volitelně se zaoblením). */
export function box(w: number, h: number, d: number, mat: THREE.Material, r = 0, cast = true) {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const g = rr > 0.002 ? new RoundedBoxGeometry(w, h, d, 3, rr) : new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return shadowed(new THREE.Mesh(g, mat), cast);
}

export function cyl(rt: number, rb: number, h: number, mat: THREE.Material, seg = 28, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  g.translate(0, h / 2, 0);
  return shadowed(new THREE.Mesh(g, mat));
}

export function ellipsoid(rx: number, ry: number, rz: number, mat: THREE.Material, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7)));
  g.scale(rx, ry, rz);
  return shadowed(new THREE.Mesh(g, mat));
}

export function put<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0): T {
  o.position.set(x, y, z);
  o.rotation.y = ry;
  return o;
}

export function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

/** Obdélník ve svislé rovině s UV ve světových metrech (pro obklady s navazující spárořezem). */
export function wallQuad(w: number, h: number, mat: THREE.Material, uvScale: number, u0 = 0, v0 = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (u0 + uv.getX(i) * w) / uvScale, (v0 + uv.getY(i) * h) / uvScale);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!] as const;
}

/** Měkký stín pod nábytkem (kontaktní „ambient occlusion“). */
export function blobTexture() {
  // alphaMap čte zelený kanál: bílý rozmazaný obdélník na černém pozadí.
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 128, 128);
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetX = 1000;
  ctx.fillStyle = "#fff";
  ctx.fillRect(28 - 1000, 28, 72, 72);
  return new THREE.CanvasTexture(c);
}

export function blob(tex: THREE.Texture, w: number, d: number, opacity = 0.45) {
  const g = new THREE.PlaneGeometry(w * 1.75, d * 1.75);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.position.y = 0.002;
  m.renderOrder = 1;
  return m;
}

export function skyTexture() {
  const [c, ctx] = canvas(8, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#cfdcea");
  g.addColorStop(0.55, "#e8eef3");
  g.addColorStop(0.72, "#f2f1ea");
  g.addColorStop(0.78, "#b7bfa5");
  g.addColorStop(1, "#9aa58a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Velkoformátový obklad 60 × 120 cm se spárou. */
export function tileTexture(color: string, grout: string) {
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const R = rng(7);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, S, S);
  const tw = S / 2, th = S; // 2 × (0,6 × 1,2 m) na 1,2 m
  for (let i = 0; i < 2; i++) {
    const k = 0.97 + R() * 0.06;
    ctx.fillStyle = color;
    ctx.globalAlpha = 1;
    ctx.fillRect(i * tw + 1.5, 1.5, tw - 3, th - 3);
    ctx.fillStyle = k > 1 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
    ctx.fillRect(i * tw + 1.5, 1.5, tw - 3, th - 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Abstraktní obraz na stěnu (tlumené tvary, žádná reálná díla). */
export function artTexture(seed: number, colors: string[]) {
  const [c, ctx] = canvas(300, 400);
  const R = rng(seed);
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, 300, 400);
  const kind = seed % 3;
  if (kind === 0) {
    ctx.fillStyle = colors[1];
    ctx.beginPath(); ctx.arc(150, 250, 110, Math.PI, 0); ctx.lineTo(260, 400); ctx.lineTo(40, 400); ctx.fill();
    ctx.fillStyle = colors[2];
    ctx.beginPath(); ctx.arc(200 + R() * 40, 110, 42, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 1) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = colors[1 + (i % (colors.length - 1))];
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(60 + R() * 180, 60 + R() * 280, 30 + R() * 70, 20 + R() * 60, R() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.strokeStyle = colors[1];
    ctx.lineWidth = 7;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(30, 90 + i * 70); ctx.bezierCurveTo(110, 40 + i * 70 + R() * 60, 190, 140 + i * 60, 270, 80 + i * 75); ctx.stroke(); }
    ctx.fillStyle = colors[2];
    ctx.fillRect(40, 300, 220, 60);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
