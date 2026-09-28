import * as THREE from "three";
import { cylinder, roundedBox } from "./geometry";
import { rng } from "./noise";
import { FABRIC_MEAN, fabric, leafAtlas, plaster, quartz, wood, woodAlbedo, type FabricKind, type WoodTone } from "./textures";

/**
 * Stavebnice scény: materiály, primitiva (osa y = podlaha) a procedurální textury.
 * Scéna se staví i v Node (výpočet světla, scripts/visualizer/bake.ts) — tam nejsou canvas textury.
 */

export const HEADLESS = typeof document === "undefined";

/**
 * Údaje pro výpočet světla v `material.userData`:
 * - bake: "lm" = lightmapa (rovné plochy stavby), "vtx" = světlo ve vrcholech (nábytek), "none" = nepočítá se ani nestíní
 * - albedo: lineární odrazivost, když barvu mění textura
 * - group: podlaha / stěny — jejich odražené světlo se přepočítává podle zvoleného dekoru a barvy stěn
 * - transmit: propustnost pro světlo (záclony, stínidla)
 * - texel: velikost texelu lightmapy v metrech
 */
export interface BakeMeta { bake?: "lm" | "vtx" | "none"; albedo?: [number, number, number]; group?: "floor" | "wall"; transmit?: number; texel?: number }

export function meta<T extends THREE.Material>(m: T, b: BakeMeta): T { Object.assign(m.userData, b); return m; }

export function std(color: THREE.ColorRepresentation, roughness = 0.8, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

const lin = (hex: number) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b] as [number, number, number]; };
const scaleLin = (c: [number, number, number], k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];

/** Látka: jemná vazba v normálové mapě, sametový lesk na hranách (sheen). */
function fabricMat(hex: number, kind: FabricKind, rough = 0.92, sheen = 0.55) {
  const { map, normal } = fabric(kind);
  const c = new THREE.Color(hex);
  const m = new THREE.MeshPhysicalMaterial({
    color: hex, roughness: rough, map, normalMap: normal, normalScale: new THREE.Vector2(0.45, 0.45),
    sheen, sheenRoughness: 0.7, sheenColor: c.clone().lerp(new THREE.Color(0xffffff), 0.35),
  });
  if (map) { map.repeat.setScalar(4); normal!.repeat.setScalar(4); }
  return meta(m, { albedo: scaleLin(lin(hex), FABRIC_MEAN) });
}

/** Dřevo (dýha, masiv): barva z textury, póry matnější. */
function woodMat(tone: WoodTone, rough = 0.62) {
  const { map, normal, rough: rm } = wood(tone);
  const base = woodAlbedo(tone);
  const m = std(map ? 0xffffff : new THREE.Color().setRGB(base[0] / 255, base[1] / 255, base[2] / 255, THREE.SRGBColorSpace), rough, 0, {
    map, normalMap: normal, roughnessMap: rm, normalScale: new THREE.Vector2(0.3, 0.3),
  });
  if (map) for (const t of [map, normal!, rm!]) t.repeat.set(1, 2);
  const c = new THREE.Color().setRGB(base[0] / 255, base[1] / 255, base[2] / 255, THREE.SRGBColorSpace);
  return meta(m, { albedo: [c.r, c.g, c.b] });
}

export function createMaterials() {
  const pl = plaster();
  if (pl.map) { pl.map.repeat.setScalar(1.25); pl.normal!.repeat.setScalar(1.25); }
  const qz = quartz();
  if (qz) qz.repeat.setScalar(1.6);
  const leaves = leafAtlas();
  return {
    white: std(0xf2f0eb, 0.55),
    whiteMatte: std(0xefece6, 0.85),
    ceiling: meta(std(0xf7f6f3, 0.95, 0, { map: pl.map, normalMap: pl.normal, normalScale: new THREE.Vector2(0.15, 0.15) }), { bake: "lm", albedo: lin(0xf5f4f1) }),
    lacquer: std(0xf4f2ee, 0.32),
    ceramic: std(0xf8f8f6, 0.08),
    black: std(0x23211f, 0.45, 0.3),
    blackMatte: std(0x2a2826, 0.7),
    steel: std(0xc9ccce, 0.32, 1),
    brass: std(0xb99a62, 0.3, 1),
    chrome: std(0xe8e8e8, 0.06, 1),
    oak: woodMat("oak"),
    oakLight: woodMat("oakLight"),
    walnut: woodMat("walnut", 0.5),
    linen: fabricMat(0xebe6dc, "linen", 0.95, 0.25),
    sheet: fabricMat(0xf3f1ec, "weave", 0.9, 0.3),
    sofa: fabricMat(0xbcb2a4, "weave", 0.92, 0.35),
    boucle: fabricMat(0xe6dfd2, "boucle", 0.98, 0.35),
    sage: fabricMat(0x8a9a80, "linen", 0.95, 0.25),
    ochre: fabricMat(0xc2934f, "velvet", 0.75, 0.9),
    rust: fabricMat(0xa5633f, "velvet", 0.75, 0.9),
    charcoalFabric: fabricMat(0x55524e, "boucle"),
    cream: fabricMat(0xeee6d8, "weave"),
    knit: fabricMat(0xb9a58a, "knit", 0.98, 0.35),
    headboard: fabricMat(0xb5a998, "weave"),
    kitchenFront: std(0xe0dbd2, 0.42),
    kitchenDark: std(0x3b423f, 0.5),
    counter: meta(std(qz ? 0xffffff : 0xe9e6e0, 0.2, 0, { map: qz }), { albedo: lin(0xe6e3dc) }),
    stoneDark: std(0x2b2b2d, 0.2),
    glassBlack: std(0x111111, 0.05, 0.1),
    // Sklo: jen odlesk (Fresnel) přes výhled — večer se v oknech zrcadlí rozsvícený pokoj.
    glass: meta(new THREE.MeshStandardMaterial({
      color: 0x000000, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.07, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }), { bake: "none" }),
    // Zrcadlo odráží prostředí nasnímané v místnosti (s korekcí na její tvar).
    mirror: meta(std(0xf2f4f5, 0.015, 1), { albedo: [0.08, 0.08, 0.08] }),
    leaf: meta(std(leaves ? 0xffffff : 0x4b6a3a, 0.55, 0, { map: leaves, side: THREE.DoubleSide, alphaTest: 0.5 }), { albedo: lin(0x3f5a32) }),
    leafSolid: std(0x4b6a3a, 0.62, 0, { side: THREE.DoubleSide }),
    leaf2: std(0x5f7f45, 0.62, 0, { side: THREE.DoubleSide }),
    terracotta: std(0xb56f4f, 0.85),
    potWhite: std(0xe9e6df, 0.45),
    potDark: std(0x3c3b38, 0.7),
    soil: std(0x3b2d22, 1),
    frameDark: std(0x2f3133, 0.5, 0.3),
    paper: std(0xf2efe8, 0.9),
    sheer: meta(new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 1, transparent: true, opacity: 0.8, side: THREE.DoubleSide, ...(() => { const f = fabric("linen"); if (f.map) { f.map.repeat.setScalar(4); } return { map: f.map }; })() }), { transmit: 0.55, albedo: scaleLin(lin(0xf6f3ec), FABRIC_MEAN) }),
    door: std(0xf1efea, 0.4),
    frontDoor: std(0x3a3c3e, 0.5, 0.2),
  };
}
export type Materials = ReturnType<typeof createMaterials>;

export { lin as linearOf };

function shadowed<T extends THREE.Mesh>(m: T, cast = true): T { m.castShadow = cast; m.receiveShadow = true; return m; }

/** Kvádr s dnem na y=0 (volitelně se zaoblením), jemně rozdělený kvůli světlu ve vrcholech. */
export function box(w: number, h: number, d: number, mat: THREE.Material, r = 0, cast = true) {
  const g = roundedBox(w, h, d, r);
  g.translate(0, h / 2, 0);
  return shadowed(new THREE.Mesh(g, mat), cast);
}

export function cyl(rt: number, rb: number, h: number, mat: THREE.Material, seg = 28, open = false) {
  return shadowed(new THREE.Mesh(cylinder(rt, rb, h, seg, 0, open), mat));
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

/** Zapamatuje si UV 0–1 každého čtyřúhelníku (atribut lmq) — z nich se staví lightmapa. */
function keepQuadUV(g: THREE.BufferGeometry) {
  g.setAttribute("lmq", (g.getAttribute("uv") as THREE.BufferAttribute).clone());
  return g;
}

/** Kvádr stavby (stěna, překlad) pro lightmapu: 6 čtyřúhelníků, střed dna v počátku. */
export function lmBox(w: number, h: number, d: number, mat: THREE.Material) {
  const g = keepQuadUV(new THREE.BoxGeometry(w, h, d));
  g.translate(0, h / 2, 0);
  return shadowed(new THREE.Mesh(g, mat));
}

/** Vodorovný obdélník pro lightmapu (podlaha / strop), UV textury ve světových metrech. */
export function lmPlane(x0: number, x1: number, z0: number, z1: number, y: number, mat: THREE.Material, up: boolean) {
  const g = keepQuadUV(new THREE.PlaneGeometry(x1 - x0, z1 - z0));
  g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
  return shadowed(new THREE.Mesh(g, mat), !up);
}

/** Obdélník ve svislé rovině s UV ve světových metrech (obklad s navazující spárořezem), pro lightmapu. */
export function wallQuad(w: number, h: number, mat: THREE.Material, uvScale: number, u0 = 0, v0 = 0) {
  const g = keepQuadUV(new THREE.PlaneGeometry(w, h));
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (u0 + uv.getX(i) * w) / uvScale, (v0 + uv.getY(i) * h) / uvScale);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

function canvas(w: number, h: number) {
  if (HEADLESS) return null;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!] as const;
}

/** Měkký stín pod nábytkem (jen pohled „celý byt“, kde se nepoužívá předpočítané světlo). */
export function blobTexture() {
  const cc = canvas(128, 128);
  if (!cc) return null;
  const [c, ctx] = cc;
  // alphaMap čte zelený kanál: bílý rozmazaný obdélník na černém pozadí.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 128, 128);
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetX = 1000;
  ctx.fillStyle = "#fff";
  ctx.fillRect(28 - 1000, 28, 72, 72);
  return new THREE.CanvasTexture(c);
}

export function blob(tex: THREE.Texture | null, w: number, d: number, opacity = 0.45) {
  const g = new THREE.PlaneGeometry(w * 1.75, d * 1.75);
  g.rotateX(-Math.PI / 2);
  const mat = meta(new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { bake: "none" });
  const m = new THREE.Mesh(g, mat);
  m.position.y = 0.002;
  m.renderOrder = 1;
  m.userData.overview = "show";
  m.userData.blob = true;
  return m;
}

/** Abstraktní obraz na stěnu (tlumené tvary, žádná reálná díla). */
export function artTexture(seed: number, colors: string[]) {
  const cc = canvas(300, 400);
  if (!cc) return null;
  const [c, ctx] = cc;
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
