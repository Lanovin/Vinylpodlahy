import * as THREE from "three";
import { blob, blobTexture, box, createMaterials, put, skyTexture, std, tileTexture, wallQuad, type Materials } from "./kit";
import * as F from "./furniture";
import type { ViewId } from "./views";

/**
 * Modelový byt 2+kk (≈ 63 m²): obývák s kuchyní, ložnice, předsíň, koupelna.
 * Souřadnice v metrech, podlaha y = 0, osa x doprava, z „dopředu“ (fasáda s okny je z = 0).
 * Podlaha je jedna souvislá plocha — stejný dekor prochází celým bytem jako při skutečné pokládce.
 */

export type { ViewId };

export interface CameraPreset { pos: THREE.Vector3; target: THREE.Vector3; hfov: number; mode: "look" | "orbit" }

export interface RoomInfo { id: ViewId; label: string; area: number; center: THREE.Vector3 }

export interface Apartment {
  root: THREE.Group;
  M: Materials;
  floorMaterial: THREE.MeshStandardMaterial;
  wallMaterial: THREE.MeshStandardMaterial;
  skirtingMaterial: THREE.MeshStandardMaterial;
  views: Record<ViewId, CameraPreset>;
  rooms: RoomInfo[];
  lamps: { light: THREE.PointLight; info: F.LampInfo }[];
  glowing: { mat: THREE.MeshStandardMaterial; mode: F.LampInfo["mode"]; strength: number }[];
  hideInOverview: THREE.Object3D[];
  showInOverview: THREE.Object3D[];
  sky: THREE.MeshBasicMaterial;
  center: THREE.Vector3;
  dispose(): void;
}

export const WALL_H = 2.7;
const H = WALL_H;

interface Rect { x0: number; x1: number; z0: number; z1: number }
interface Opening { a: number; b: number; y0: number; y1: number }

const ROOMS: Record<Exclude<ViewId, "kitchen" | "overview">, Rect & { label: string }> = {
  living: { x0: 0, x1: 6.4, z0: 0, z1: 5.4, label: "Obývák s kuchyní" },
  bedroom: { x0: 6.5, x1: 10.4, z0: 0, z1: 4.0, label: "Ložnice" },
  hallway: { x0: 6.5, x1: 10.4, z0: 4.1, z1: 5.8, label: "Předsíň" },
  bathroom: { x0: 6.5, x1: 9.2, z0: 5.9, z1: 8.3, label: "Koupelna" },
};

// Otvory (okna, dveře) — sdílené mezi stěnami, obklady a lištami.
const W1: Opening = { a: 0.8, b: 2.4, y0: 0.04, y1: 2.42 };
const W2: Opening = { a: 3.0, b: 4.6, y0: 0.04, y1: 2.42 };
const W3: Opening = { a: 7.6, b: 9.4, y0: 0.55, y1: 2.35 };
const W4: Opening = { a: 3.9, b: 5.0, y0: 0.85, y1: 2.35 };
const D1: Opening = { a: 4.35, b: 5.15, y0: 0, y1: 2.05 }; // obývák ↔ předsíň (stěna x = 6,4–6,5)
const D2: Opening = { a: 7.0, b: 7.8, y0: 0, y1: 2.05 }; // ložnice ↔ předsíň (stěna z = 4,0–4,1)
const D3: Opening = { a: 6.75, b: 7.55, y0: 0, y1: 2.05 }; // koupelna ↔ předsíň (stěna z = 5,8–5,9)
const D4: Opening = { a: 4.55, b: 5.45, y0: 0, y1: 2.1 }; // vchodové dveře (stěna x = 10,4)

export function buildApartment(): Apartment {
  const M = createMaterials();
  const root = new THREE.Group();
  const blobTex = blobTexture();
  const skyTex = skyTexture();
  const hideInOverview: THREE.Object3D[] = [];
  const showInOverview: THREE.Object3D[] = [];
  const wallMaterial = std(0xf1eee8, 0.93);
  const skirtingMaterial = std(0xf4f2ee, 0.45);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
  const capMaterial = std(0x3a3835, 0.9);
  const glowing: Apartment["glowing"] = [];
  const add = (o: THREE.Object3D) => { root.add(o); return o; };

  /* ---------------- stěny */
  const wall = (x0: number, x1: number, z0: number, z1: number, openings: Opening[] = []) => {
    const alongX = x1 - x0 >= z1 - z0;
    const lo = alongX ? x0 : z0, hi = alongX ? x1 : z1;
    const tc = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2, th = alongX ? z1 - z0 : x1 - x0;
    const seg = (a: number, b: number, y0: number, y1: number) => {
      if (b - a < 1e-3 || y1 - y0 < 1e-3) return;
      // Díly se o 2 mm překrývají, jinak na styku prosvítají vlasové škvíry.
      const e = 0.002, len = b - a + 2 * e;
      const m = alongX ? box(len, y1 - y0 + (y0 > 0 ? e : 0), th, wallMaterial) : box(th, y1 - y0 + (y0 > 0 ? e : 0), len, wallMaterial);
      m.position.set(alongX ? (a + b) / 2 : tc, y0 > 0 ? y0 - e : y0, alongX ? tc : (a + b) / 2);
      add(m);
    };
    let cur = lo;
    for (const o of [...openings].sort((p, q) => p.a - q.a)) { seg(cur, o.a, 0, H); seg(o.a, o.b, 0, o.y0); seg(o.a, o.b, o.y1, H); cur = o.b; }
    seg(cur, hi, 0, H);
    // Řez stěny pro pohled „celý byt“ (tmavé víčko ve výšce řezu).
    const cap = box(x1 - x0, 0.004, z1 - z0, capMaterial, 0, false);
    cap.position.set((x0 + x1) / 2, 1.238, (z0 + z1) / 2);
    cap.visible = false;
    showInOverview.push(add(cap));
  };
  wall(-0.25, 10.65, -0.25, 0, [W1, W2, W3]);
  wall(-0.25, 0, 0, 5.65, [W4]);
  wall(-0.25, 6.4, 5.4, 5.65);
  wall(6.4, 6.5, 0, 5.8, [D1]);
  wall(6.5, 10.4, 4.0, 4.1, [D2]);
  wall(10.4, 10.65, 0, 6.05, [D4]);
  wall(6.5, 9.2, 5.8, 5.9, [D3]);
  wall(9.2, 10.65, 5.8, 6.05);
  wall(9.2, 9.45, 5.9, 8.55);
  wall(6.25, 9.45, 8.3, 8.55);
  wall(6.25, 6.5, 5.8, 8.3);

  /* ---------------- podlaha, strop */
  const floorRects: Rect[] = [
    ...Object.values(ROOMS),
    { x0: 6.4, x1: 6.5, z0: D1.a, z1: D1.b },
    { x0: D2.a, x1: D2.b, z0: 4.0, z1: 4.1 },
    { x0: D3.a, x1: D3.b, z0: 5.8, z1: 5.9 },
  ];
  for (const r of floorRects) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    // UV = světové metry; měřítko a natočení dekoru řeší transformace textury.
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
    const m = new THREE.Mesh(g, floorMaterial);
    m.receiveShadow = true;
    add(m);
  }
  for (const r of Object.values(ROOMS)) {
    const g = new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0);
    g.rotateX(Math.PI / 2);
    g.translate((r.x0 + r.x1) / 2, H, (r.z0 + r.z1) / 2);
    const m = new THREE.Mesh(g, M.ceiling);
    m.castShadow = true;
    hideInOverview.push(add(m));
  }

  /* ---------------- soklové lišty (mimo dveře a francouzská okna) */
  const skirt = (x0: number, x1: number, z0: number, z1: number, gaps: Opening[] = []) => {
    const alongX = z0 === z1;
    const lo = alongX ? x0 : z0, hi = alongX ? x1 : z1;
    let cur = lo;
    const piece = (a: number, b: number) => {
      if (b - a < 0.02) return;
      const m = alongX ? box(b - a, 0.07, 0.014, skirtingMaterial) : box(0.014, 0.07, b - a, skirtingMaterial);
      const off = 0.007;
      if (alongX) m.position.set((a + b) / 2, 0, z0 + (z0 < 0.5 || z0 === 4.1 || z0 === 5.9 ? off : -off));
      else m.position.set(x0 + (x0 === 0 || x0 === 6.5 ? off : -off), 0, (a + b) / 2);
      m.castShadow = false;
      add(m);
    };
    for (const o of [...gaps].sort((p, q) => p.a - q.a)) { piece(cur, o.a); cur = o.b; }
    piece(cur, hi);
  };
  skirt(0, 6.4, 0, 0, [W1, W2]);
  skirt(0, 0, 0, 5.4);
  skirt(0, 6.4, 5.4, 5.4);
  skirt(6.4, 6.4, 0, 5.4, [D1]);
  skirt(6.5, 10.4, 0, 0);
  skirt(6.5, 6.5, 0, 4.0);
  skirt(10.4, 10.4, 0, 4.0);
  skirt(6.5, 10.4, 4.0, 4.0, [D2]);
  skirt(6.5, 10.4, 4.1, 4.1, [D2]);
  skirt(6.5, 10.4, 5.8, 5.8, [D3]);
  skirt(6.5, 6.5, 4.1, 5.8, [D1]);
  skirt(10.4, 10.4, 4.1, 5.8, [D4]);

  /* ---------------- obklad koupelny */
  const tileMat = std(0xffffff, 0.3, 0, { map: tileTexture("#dedad3", "#c8c3ba") });
  const clad = (x: number, z: number, ry: number, a: number, b: number, y0: number, y1: number) => {
    const q = wallQuad(b - a, y1 - y0, tileMat, 1.2, a, y0);
    q.position.set(x, y0, z);
    q.rotation.y = ry;
    add(q);
  };
  const bz = 5.9 + 0.004, bx0 = 6.5 + 0.004, bx1 = 9.2 - 0.004, bz1 = 8.3 - 0.004;
  clad((6.5 + D3.a) / 2, bz, 0, 0, D3.a - 6.5, 0, H);
  clad((D3.b + 9.2) / 2, bz, 0, D3.b - 6.5, 9.2 - 6.5, 0, H);
  clad((D3.a + D3.b) / 2, bz, 0, D3.a - 6.5, D3.b - 6.5, D3.y1, H);
  clad(7.85, bz1, Math.PI, 0, 2.7, 0, H);
  clad(bx0, 7.1, Math.PI / 2, 0, 2.4, 0, H);
  clad(bx1, 7.1, -Math.PI / 2, 0, 2.4, 0, H);

  /* ---------------- okna, obloha, dveře */
  const winBack = (o: Opening, sill: boolean) => add(put(F.windowUnit(M, o.b - o.a, o.y1 - o.y0, 0.25, sill), (o.a + o.b) / 2, o.y0, -0.07));
  winBack(W1, false); winBack(W2, false); winBack(W3, true);
  add(put(F.windowUnit(M, W4.b - W4.a, W4.y1 - W4.y0, 0.25, true), -0.07, W4.y0, (W4.a + W4.b) / 2, Math.PI / 2));
  const sky = new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false });
  const skyBack = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), sky);
  skyBack.position.set(5, 1.6, -2.2);
  const skyLeft = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), sky);
  skyLeft.position.set(-2.2, 1.6, 3);
  skyLeft.rotation.y = Math.PI / 2;
  hideInOverview.push(add(skyBack), add(skyLeft));

  const casingX = (o: Opening, xWall: number, t: number) => add(put(F.doorCasing(M, o.b - o.a, o.y1, t), xWall, 0, (o.a + o.b) / 2, Math.PI / 2));
  const casingZ = (o: Opening, zWall: number, t: number) => add(put(F.doorCasing(M, o.b - o.a, o.y1, t), (o.a + o.b) / 2, 0, zWall));
  casingX(D1, 6.45, 0.1);
  casingZ(D2, 4.05, 0.1);
  casingZ(D3, 5.85, 0.1);
  casingX(D4, 10.525, 0.25);
  // Vchodové dveře zavřené, pokojové otevřené.
  add(put(F.doorLeaf(M, D4.b - D4.a - 0.02, D4.y1 - 0.01, M.frontDoor), 10.44, 0, (D4.a + D4.b) / 2, Math.PI / 2));
  add(put(F.doorLeaf(M, 0.78, 2.03), D2.a + 0.02, 0, 4.0 - 0.39, -Math.PI / 2 + 0.08));
  add(put(F.doorLeaf(M, 0.78, 2.03), D3.a + 0.02, 0, 5.9 + 0.39, Math.PI / 2 - 0.08));

  /* ---------------- nábytek: obývák */
  const shadowBlob = (x: number, z: number, w: number, d: number, ry = 0, o = 0.42) => { const b = blob(blobTex, w, d, o); b.position.x = x; b.position.z = z; b.rotation.y = ry; add(b); };
  add(put(F.sofa(M, 2.3, 0.95), 0.53, 0, 2.55, Math.PI / 2));
  shadowBlob(0.53, 2.55, 0.95, 2.3, 0, 0.5);
  add(put(F.artFrame(M, 0.56, 0.74, 3, ["#e9e2d6", "#b86f50", "#6c7a60"]), 0.02, 1.28, 2.12, Math.PI / 2));
  add(put(F.artFrame(M, 0.56, 0.74, 4, ["#dfe3e0", "#3d5a6c", "#c49a62", "#8f9d86"]), 0.02, 1.28, 2.98, Math.PI / 2));
  add(put(F.coffeeTable(M), 1.72, 0, 2.55));
  shadowBlob(1.72, 2.55, 0.8, 0.8, 0, 0.28);
  add(put(F.armchair(M), 3.35, 0, 0.95, -Math.PI / 2 + 0.62));
  shadowBlob(3.35, 0.95, 0.74, 0.78, -Math.PI / 2 + 0.62, 0.4);
  add(put(F.floorLamp(M), 0.42, 0, 4.08));
  add(put(F.plant(M, 1.65, 1, M.terracotta, "fig"), 0.42, 0, 0.45));
  shadowBlob(0.42, 0.45, 0.4, 0.4, 0, 0.35);
  add(put(F.plant(M, 1.0, 2, M.potWhite, "snake"), 2.7, 0, 0.3));
  for (const [x, w] of [[0.62, 0.34], [4.78, 0.34]] as const) add(put(F.curtain(M, w, H - 0.05), x, 0, 0.09));

  /* ---------------- nábytek: kuchyň (pravá stěna obýváku, x = 6,4) */
  const front = M.kitchenFront;
  const stripShade = std(0xffffff, 1, 0, { emissive: 0xffd9a8, emissiveIntensity: 0 });
  glowing.push({ mat: stripShade, mode: "evening", strength: 2.2 });
  add(put(F.tallUnit(M, 0.6, 2.25, front, false), 6.1, 0, 0.6, -Math.PI / 2));
  add(put(F.tallUnit(M, 0.6, 2.25, front, true), 6.1, 0, 1.2, -Math.PI / 2));
  add(put(F.kitchenBase(M, 2.4, front, { sinkAt: -0.55, hobAt: 0.65 }), 6.09, 0, 2.7, -Math.PI / 2));
  add(put(box(0.012, 0.55, 2.4, M.counter), 6.394, 0.92, 2.7));
  add(put(F.kitchenUpper(M, 1.3, front, stripShade), 6.23, 1.47, 2.15, -Math.PI / 2));
  add(put(F.hood(M), 6.2, 1.5, 3.35, -Math.PI / 2));
  shadowBlob(6.1, 2.1, 0.62, 3.6, 0, 0.3);
  add(put(F.island(M, 2.0, 0.85, M.kitchenDark), 4.4, 0, 2.4, -Math.PI / 2));
  shadowBlob(4.52, 2.4, 0.6, 2.0, 0, 0.45);
  for (const z of [1.78, 2.4, 3.02]) { add(put(F.barStool(M), 3.72, 0, z)); shadowBlob(3.72, z, 0.36, 0.36, 0, 0.25); }
  const pendantShade = F.shadeMaterial(0xfff4e2);
  for (const z of [1.75, 2.4, 3.05]) add(put(F.pendant(M, 0.62, pendantShade), 4.4, H, z));
  add(F.lampMark(4.4, 1.8, 2.4, { color: 0xffcf96, intensity: 6, distance: 6, mode: "evening", shades: [pendantShade] }));

  /* ---------------- nábytek: ložnice */
  add(put(F.bed(M, 1.8, 2.1), 9.25, 0, 1.9, -Math.PI / 2));
  shadowBlob(9.25, 1.9, 2.2, 1.9, 0, 0.5);
  for (const z of [0.6, 3.2]) {
    add(put(F.nightstand(M), 10.12, 0, z, -Math.PI / 2));
    add(put(F.tableLamp(M), 10.12, 0.52, z));
    shadowBlob(10.12, z, 0.4, 0.46, 0, 0.3);
  }
  add(put(F.artFrame(M, 1.1, 0.62, 5, ["#ece6db", "#8f9d86", "#c9a27a"]), 10.38, 1.32, 1.9, -Math.PI / 2));
  add(put(F.wardrobe(M, 2.0), 6.8, 0, 1.3, Math.PI / 2));
  shadowBlob(6.8, 1.3, 0.6, 2.0, 0, 0.35);
  add(put(F.bench(M, 1.2), 7.95, 0, 1.9, -Math.PI / 2));
  shadowBlob(7.95, 1.9, 0.38, 1.2, 0, 0.3);
  add(put(F.plant(M, 0.9, 3, M.potWhite, "bush"), 7.32, 0, 0.36));
  for (const x of [7.45, 9.55]) add(put(F.curtain(M, 0.3, H - 0.05), x, 0, 0.09));

  /* ---------------- nábytek: koupelna */
  add(put(F.bathtub(M), 8.25, 0, 7.93, Math.PI));
  shadowBlob(8.25, 7.93, 1.8, 0.75, 0, 0.3);
  add(put(F.vanity(M), 8.96, 0, 6.75, -Math.PI / 2));
  shadowBlob(8.96, 6.75, 0.5, 0.9, 0, 0.18);
  const mirror = put(box(0.8, 0.8, 0.02, M.mirror, 0.01), 9.19, 1.1, 6.75, -Math.PI / 2);
  add(mirror);
  const ledMat = std(0xffffff, 1, 0, { emissive: 0xfff1dc, emissiveIntensity: 0 });
  glowing.push({ mat: ledMat, mode: "always", strength: 2.6 });
  add(put(box(0.82, 0.012, 0.03, ledMat, 0), 9.18, 1.9, 6.75, -Math.PI / 2));
  add(put(F.toilet(M), 6.5, 0, 7.0, Math.PI / 2));
  shadowBlob(6.77, 7.0, 0.5, 0.4, 0, 0.18);
  add(put(F.towelRadiator(M), 6.5, 0, 7.95, Math.PI / 2));
  add(F.lampMark(7.85, 2.5, 7.1, { color: 0xfff0dc, intensity: 5, distance: 5, mode: "always", shades: [] }));

  /* ---------------- nábytek: předsíň */
  add(put(F.shoeCabinet(M), 9.8, 0, 5.8 - 0.165, Math.PI));
  shadowBlob(9.8, 5.64, 1.0, 0.32, 0, 0.35);
  add(put(F.roundMirror(M), 9.8, 1.55, 5.79, Math.PI));
  add(put(F.coatRack(M), 9.45, 0, 4.1));
  add(put(F.plant(M, 1.05, 4, M.terracotta, "snake"), 8.65, 0, 5.52));
  add(F.lampMark(7.6, 2.55, 4.95, { color: 0xfff0dc, intensity: 3.2, distance: 5, mode: "always", shades: [] }));
  add(F.lampMark(9.6, 2.55, 4.95, { color: 0xfff0dc, intensity: 3.2, distance: 5, mode: "always", shades: [] }));

  /* ---------------- bodová světla ve stropě */
  const spotMat = std(0xffffff, 1, 0, { emissive: 0xfff3e2, emissiveIntensity: 0 });
  glowing.push({ mat: spotMat, mode: "evening", strength: 2.4 });
  const spotAlways = std(0xffffff, 1, 0, { emissive: 0xfff3e2, emissiveIntensity: 0 });
  glowing.push({ mat: spotAlways, mode: "always", strength: 2.4 });
  const spot = (x: number, z: number, mat: THREE.Material) => {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), mat);
    s.rotation.x = Math.PI / 2;
    s.position.set(x, H - 0.002, z);
    hideInOverview.push(add(s));
  };
  for (const [x, z] of [[1.4, 1.4], [1.4, 3.6], [3.2, 3.6], [5.1, 0.9], [5.1, 4.2], [7.6, 1.2], [9.2, 3.0]]) spot(x, z, spotMat);
  for (const [x, z] of [[7.6, 4.95], [9.6, 4.95], [7.3, 6.6], [8.4, 7.5]]) spot(x, z, spotAlways);

  /* ---------------- světla ze značek svítidel */
  const lamps: Apartment["lamps"] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const info = o.userData.lamp as F.LampInfo | undefined;
    if (!info) return;
    const l = new THREE.PointLight(info.color, 0, info.distance, 2);
    o.getWorldPosition(l.position);
    lamps.push({ light: l, info });
  });
  for (const l of lamps) root.add(l.light);

  const r = (id: ViewId, rect: Rect, label: string): RoomInfo => ({ id, label, area: (rect.x1 - rect.x0) * (rect.z1 - rect.z0), center: new THREE.Vector3((rect.x0 + rect.x1) / 2, 1.3, (rect.z0 + rect.z1) / 2) });
  const rooms: RoomInfo[] = [
    r("living", ROOMS.living, ROOMS.living.label),
    r("bedroom", ROOMS.bedroom, ROOMS.bedroom.label),
    r("hallway", ROOMS.hallway, ROOMS.hallway.label),
    r("bathroom", ROOMS.bathroom, ROOMS.bathroom.label),
  ];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const center = v(5.2, 0, 4.1);
  const views: Record<ViewId, CameraPreset> = {
    living: { pos: v(3.0, 1.45, 5.15), target: v(0.7, 0.36, 1.6), hfov: 76, mode: "look" },
    kitchen: { pos: v(0.75, 1.5, 4.95), target: v(5.2, 0.72, 1.6), hfov: 78, mode: "look" },
    bedroom: { pos: v(7.15, 1.5, 3.72), target: v(9.5, 0.45, 1.35), hfov: 82, mode: "look" },
    bathroom: { pos: v(7.05, 1.62, 6.0), target: v(8.05, 0.42, 8.0), hfov: 88, mode: "look" },
    hallway: { pos: v(6.72, 1.55, 4.95), target: v(10.1, 0.45, 4.95), hfov: 78, mode: "look" },
    overview: { pos: v(3.4, 11.4, 14.2), target: center.clone(), hfov: 46, mode: "orbit" },
  };

  return {
    root, M, floorMaterial, wallMaterial, skirtingMaterial, views, rooms, lamps, glowing, hideInOverview, showInOverview, sky, center,
    dispose() {
      const mats = new Set<THREE.Material>();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x));
      });
      for (const m of mats) {
        for (const k of ["map", "alphaMap", "bumpMap"] as const) { const t = (m as THREE.MeshStandardMaterial)[k]; if (t && m !== floorMaterial) t.dispose(); }
        m.dispose();
      }
      blobTex.dispose(); skyTex.dispose();
    },
  };
}
