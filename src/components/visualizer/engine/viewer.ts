import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildApartment, type CameraPreset, type RoomInfo, type ViewId } from "./apartment";
import { buildFloorTile, type DecorSpec, type FloorTile } from "./floorTile";

export type { ViewId } from "./apartment";
export type Lighting = "day" | "evening";
export interface FloorInput extends DecorSpec { diagonal: boolean }

export interface ViewerOptions {
  /** Kolečko myši přibližuje (v celoobrazovkovém dialogu ano, v obsahu stránky ne — neblokuje scroll). */
  wheelZoom?: boolean;
  /** Klik na štítek místnosti v pohledu „celý byt“. */
  onViewChange?: (v: ViewId) => void;
  onReady?: () => void;
  formatLabel?: (room: RoomInfo) => { title: string; sub: string };
}

export interface Viewer {
  setView(v: ViewId, instant?: boolean): void;
  setFloor(f: FloorInput): void;
  setWallColor(hex: string): void;
  setSkirtingColor(hex: string): void;
  setLighting(l: Lighting): void;
  zoom(factor: number): void;
  resetView(): void;
  snapshot(): string;
  dispose(): void;
}

interface CamState { pos: THREE.Vector3; target: THREE.Vector3; fov: number }

const SUN_DIR = new THREE.Vector3(-0.45, 0.72, -0.53).normalize();
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createViewer(canvas: HTMLCanvasElement, overlay: HTMLElement, opts: ViewerOptions = {}): Viewer {
  const small = Math.min(window.screen.width, window.screen.height) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 2 : 1.75));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const maxSide = Math.min(renderer.capabilities.maxTextureSize, small ? 2048 : 2560);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6f3ee);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const apt = buildApartment();
  scene.add(apt.root);

  const sun = new THREE.DirectionalLight(0xfff0dc, 3);
  sun.position.copy(apt.center).addScaledVector(SUN_DIR, 22);
  sun.target.position.copy(apt.center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1536 : 2048, small ? 1536 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -8.5; sc.right = 8.5; sc.top = 8.5; sc.bottom = -8.5; sc.near = 8; sc.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  // Odražené světlo: podlaha a stěny prosvětlí strop a stinné strany (náhrada globálního osvětlení).
  const bounce = new THREE.HemisphereLight(0xffffff, 0xd9c7ae, 0.9);
  scene.add(bounce);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 90);
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.25);

  let view: ViewId = "living";
  let yaw = 0, pitch = 0, zoomK = 1;
  let anim: { from: CamState; to: CamState; t0: number; dur: number; next: ViewId } | null = null;
  let dirty = true;
  let ready = false;
  let raf = 0;
  let visible = true;
  let cur: CamState = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50 };

  const vfov = (hfov: number) => clamp((2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / camera.aspect) * 180) / Math.PI, 36, 80);

  function camFor(p: CameraPreset, y: number, pt: number, z: number): CamState {
    if (p.mode === "look") {
      const d = p.target.clone().sub(p.pos);
      const dist = d.length();
      const yawF = Math.atan2(d.x, d.z) + y;
      const pitchF = clamp(Math.asin(d.y / dist) + pt, -1.25, 0.25);
      const dir = new THREE.Vector3(Math.sin(yawF) * Math.cos(pitchF), Math.sin(pitchF), Math.cos(yawF) * Math.cos(pitchF));
      return { pos: p.pos.clone(), target: p.pos.clone().addScaledVector(dir, dist), fov: clamp(vfov(p.hfov) / z, 18, 80) };
    }
    const off = p.pos.clone().sub(p.target);
    const r = off.length() / z;
    const az = Math.atan2(off.x, off.z) + y;
    const pol = clamp(Math.acos(off.y / off.length()) + pt, 0.12, 1.2);
    const pos = p.target.clone().add(new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)).multiplyScalar(r));
    return { pos, target: p.target.clone(), fov: vfov(p.hfov) };
  }

  function apply(s: CamState) {
    camera.position.copy(s.pos);
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(s.target);
    cur = { pos: s.pos.clone(), target: s.target.clone(), fov: s.fov };
    dirty = true;
  }

  function setOverviewMode(on: boolean) {
    renderer.clippingPlanes = on ? [cutPlane] : [];
    for (const o of apt.hideInOverview) o.visible = !on;
    for (const o of apt.showInOverview) o.visible = on;
    renderer.shadowMap.needsUpdate = true;
  }

  /* ---------------- štítky místností (pohled „celý byt“) */
  const labels = apt.rooms.map((room) => {
    const el = document.createElement("button");
    el.type = "button";
    const f = opts.formatLabel?.(room) ?? { title: room.label, sub: `${room.area.toFixed(1).replace(".", ",")} m²` };
    el.innerHTML = `<span style="display:block;font-size:13px;line-height:1.1">${f.title}</span><span style="display:block;font-size:11px;opacity:.7;margin-top:2px">${f.sub}</span>`;
    el.style.cssText = "position:absolute;left:0;top:0;display:none;pointer-events:auto;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.92);color:#17150f;border:1px solid rgba(23,21,15,.12);box-shadow:0 4px 14px -6px rgba(0,0,0,.35);cursor:pointer;white-space:nowrap;text-align:center;font:inherit;";
    el.addEventListener("click", (e) => { e.stopPropagation(); setView(room.id); opts.onViewChange?.(room.id); });
    overlay.appendChild(el);
    return { el, room };
  });
  function updateLabels() {
    const show = view === "overview" && !anim;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const { el, room } of labels) {
      if (!show) { el.style.display = "none"; continue; }
      const v = room.center.clone().project(camera);
      el.style.display = "block";
      el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    }
  }

  /* ---------------- smyčka */
  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    if (anim) {
      const t = clamp((now - anim.t0) / anim.dur, 0, 1);
      const e = ease(t);
      apply({ pos: anim.from.pos.clone().lerp(anim.to.pos, e), target: anim.from.target.clone().lerp(anim.to.target, e), fov: anim.from.fov + (anim.to.fov - anim.from.fov) * e });
      if (t >= 1) {
        const next = anim.next;
        anim = null;
        if (next !== "overview") setOverviewMode(false);
      }
    }
    if (!dirty || !visible) return;
    dirty = false;
    renderer.render(scene, camera);
    updateLabels();
    if (!ready) { ready = true; opts.onReady?.(); }
  }

  function setView(v: ViewId, instant = false) {
    if (v === view && !instant) return;
    const target = camFor(apt.views[v], 0, 0, 1);
    const prev = view;
    view = v;
    yaw = 0; pitch = 0; zoomK = 1;
    if (v === "overview") setOverviewMode(true);
    if (instant || !ready || prev === v) {
      anim = null;
      if (v !== "overview") setOverviewMode(false);
      apply(target);
      return;
    }
    anim = { from: { ...cur, pos: cur.pos.clone(), target: cur.target.clone() }, to: target, t0: performance.now(), dur: prev === "overview" || v === "overview" ? 1100 : 850, next: v };
  }

  const refresh = () => { if (!anim) apply(camFor(apt.views[view], yaw, pitch, zoomK)); };

  /* ---------------- ovládání: tažení = rozhlížení / otáčení, kolečko a dva prsty = přiblížení */
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  };
  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p || anim) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) zoom(d / pinch);
      pinch = d;
      return;
    }
    const k = 2.4 / Math.max(300, canvas.clientHeight);
    if (apt.views[view].mode === "look") {
      yaw = clamp(yaw + dx * k, -0.8, 0.8);
      pitch = clamp(pitch + dy * k, -0.45, 0.55);
    } else {
      yaw -= dx * k * 1.3;
      pitch = clamp(pitch - dy * k, -0.6, 0.45);
    }
    refresh();
  };
  const onUp = (e: PointerEvent) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; };
  const onWheel = (e: WheelEvent) => { if (!opts.wheelZoom) return; e.preventDefault(); zoom(Math.exp(-e.deltaY * 0.0012)); };
  const onDbl = () => resetView();
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("dblclick", onDbl);

  function zoom(f: number) {
    const [lo, hi] = apt.views[view].mode === "look" ? [0.9, 2.4] : [0.75, 2.2];
    zoomK = clamp(zoomK * f, lo, hi);
    refresh();
  }
  function resetView() { yaw = 0; pitch = 0; zoomK = 1; refresh(); }

  const ro = new ResizeObserver(() => {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (anim) anim.to = camFor(apt.views[anim.next], 0, 0, 1);
    else apply(camFor(apt.views[view], yaw, pitch, zoomK));
  });
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); if (visible) dirty = true; });
  io.observe(canvas);

  /* ---------------- podlaha */
  const tiles = new Map<string, { tile: FloorTile; map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();
  function setFloor(f: FloorInput) {
    const p = f.palette;
    const key = [f.seedKey, f.kind, f.pattern, f.plankL, f.plankW, f.bevel, ...p.dark, ...p.base, ...p.light].map((x) => (typeof x === "number" ? x.toFixed(3) : String(x))).join("|");
    let e = tiles.get(key);
    if (!e) {
      const tile = buildFloorTile(f, maxSide);
      const map = new THREE.CanvasTexture(tile.map);
      map.colorSpace = THREE.SRGBColorSpace;
      const bump = new THREE.CanvasTexture(tile.bump);
      for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }
      e = { tile, map, bump };
      tiles.set(key, e);
      // Drží se jen pár posledních dekorů (paměť GPU na mobilech).
      while (tiles.size > 3) {
        const [oldKey, old] = tiles.entries().next().value as [string, { map: THREE.Texture; bump: THREE.Texture }];
        if (old.map === apt.floorMaterial.map) break;
        old.map.dispose(); old.bump.dispose();
        tiles.delete(oldKey);
      }
    } else {
      tiles.delete(key);
      tiles.set(key, e);
    }
    const rot = f.diagonal ? Math.PI / 4 : 0;
    for (const t of [e.map, e.bump]) { t.repeat.set(1 / e.tile.tileW, 1 / e.tile.tileH); t.rotation = rot; t.center.set(0, 0); }
    const first = !apt.floorMaterial.map;
    apt.floorMaterial.map = e.map;
    apt.floorMaterial.bumpMap = e.bump;
    apt.floorMaterial.bumpScale = f.bevel ? 1.6 : 0.7;
    if (first) apt.floorMaterial.needsUpdate = true;
    dirty = true;
  }

  function setLighting(l: Lighting) {
    const eve = l === "evening";
    sun.intensity = eve ? 0 : 3;
    bounce.intensity = eve ? 0.12 : 0.9;
    scene.environmentIntensity = eve ? 0.08 : 0.6;
    apt.sky.color.set(eve ? 0x273142 : 0xffffff);
    for (const { light, info } of apt.lamps) {
      const on = info.mode === "always" || eve;
      light.intensity = on ? info.intensity : 0;
      for (const s of info.shades) s.emissiveIntensity = on ? 1.3 : 0;
    }
    for (const g of apt.glowing) g.mat.emissiveIntensity = g.mode === "always" || eve ? g.strength : 0;
    renderer.toneMappingExposure = eve ? 1.2 : 1;
    dirty = true;
  }

  setLighting("day");
  setView("living", true);
  raf = requestAnimationFrame(tick);

  return {
    setView,
    setFloor,
    setWallColor(hex) { apt.wallMaterial.color.set(hex); dirty = true; },
    setSkirtingColor(hex) { apt.skirtingMaterial.color.set(hex); dirty = true; },
    setLighting,
    zoom,
    resetView,
    snapshot() { renderer.render(scene, camera); return canvas.toDataURL("image/jpeg", 0.92); },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDbl);
      for (const { el } of labels) el.remove();
      for (const e of tiles.values()) { e.map.dispose(); e.bump.dispose(); }
      tiles.clear();
      apt.dispose();
      envTex.dispose(); pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
