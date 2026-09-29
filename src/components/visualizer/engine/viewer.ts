import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildApartment, type CameraPreset, type RoomInfo, type ViewId } from "./apartment";
import { applyBake, createBakeUniforms, disposeBake, fetchBake, patchBakeMaterial, prepareBake, type BakeSet } from "./bake";
import { buildFloorTile, type DecorSpec, type FloorTile } from "./floorTile";
import { EXTERIOR, SUN_COLOR, SUN_DIR, SUN_E, SUN_RADIUS, type LightingMode } from "./lighting";
import { PhotoPipeline } from "./post";
import { detectQuality, QUALITY, type Detection, type Quality, type QualityChoice } from "./quality";
import { FloorReflection } from "./reflection";

export type { ViewId } from "./apartment";
export type Lighting = LightingMode;
export interface FloorInput extends DecorSpec { diagonal: boolean }

export interface ViewerOptions {
  /** Kolečko myši přibližuje (v celoobrazovkovém dialogu ano, v obsahu stránky ne — neblokuje scroll). */
  wheelZoom?: boolean;
  /** Klik na štítek místnosti v pohledu „celý byt“. */
  onViewChange?: (v: ViewId) => void;
  onReady?: () => void;
  /** Načítá se světlo pro jiný režim (den / večer). */
  onBusy?: (busy: boolean) => void;
  /** Obraz je doostřený (dokončené průměrování snímků). */
  onSettled?: () => void;
  formatLabel?: (room: RoomInfo) => { title: string; sub: string };
  /** Náročnost zobrazení: stupeň, „auto“ (podle zařízení), nebo přímo sada parametrů (testy). */
  quality?: QualityChoice | Quality;
  /** Zvolený stupeň a důvod (u „auto“ odhad podle zařízení). */
  onQuality?: (d: Detection) => void;
  /** Tažení je trvale pomalé — zařízení na tento stupeň nestačí. */
  onSlow?: () => void;
  /** Prohlížeč vzal grafický kontext (nedostatek paměti GPU, přepnutí grafiky). */
  onLost?: () => void;
}

export interface Viewer {
  setView(v: ViewId, instant?: boolean): void;
  /** Podlaha se generuje po částech, aby stránka během toho reagovala; vyřeší se po položení. */
  setFloor(f: FloorInput): Promise<void>;
  setWallColor(hex: string): void;
  setSkirtingColor(hex: string): void;
  setLighting(l: Lighting): void;
  zoom(factor: number): void;
  resetView(): void;
  snapshot(): string;
  dispose(): void;
}

interface CamState { pos: THREE.Vector3; target: THREE.Vector3; fov: number; level: number }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const halton = (i: number, b: number) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
/** Kolik po sobě jdoucích pomalých snímků při tažení znamená, že zařízení na daný stupeň nestačí. */
const SLOW_FRAMES = 10;
const SLOW_MS = 70;
const EXPOSURE: Record<LightingMode, number> = { day: 1, evening: 1.15 };

function backdropMaterial(tex: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tExt: { value: tex },
      uScale: { value: new THREE.Vector3().setScalar(EXTERIOR.display) },
      uRange: { value: new THREE.Vector4(EXTERIOR.thetaMin, EXTERIOR.thetaMax, EXTERIOR.elevMin, EXTERIOR.elevMax) },
    },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vDir = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tExt; uniform vec3 uScale; uniform vec4 uRange; varying vec3 vDir;
      void main() {
        vec3 d = normalize( vDir );
        float theta = mod( degrees( atan( d.z, d.x ) ) - uRange.x, 360.0 );
        float u = clamp( theta / ( uRange.y - uRange.x ), 0.0, 1.0 );
        float v = clamp( ( degrees( asin( clamp( d.y, -1.0, 1.0 ) ) ) - uRange.z ) / ( uRange.w - uRange.z ), 0.0, 1.0 );
        vec3 t = min( texture2D( tExt, vec2( u, v ) ).rgb, vec3( 0.985 ) );
        gl_FragColor = vec4( t / ( 1.0 - t ) * uScale, 1.0 );
      }`,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

export function createViewer(canvas: HTMLCanvasElement, overlay: HTMLElement, opts: ViewerOptions = {}): Viewer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  const chosen = opts.quality ?? "auto";
  const detection: Detection = typeof chosen === "object" ? { level: chosen.level, reason: "vlastní nastavení" } : chosen === "auto" ? detectQuality(renderer) : { level: chosen, reason: "ruční volba" };
  const Q: Quality = typeof chosen === "object" ? chosen : QUALITY[detection.level];
  opts.onQuality?.(detection);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const maxSide = Math.min(renderer.capabilities.maxTextureSize, Q.floorSide);
  const aniso = Math.min(Q.aniso, renderer.capabilities.getMaxAnisotropy());
  const post = new PhotoPipeline(renderer, { bloom: 0.07, vignette: 0.14, samples: Q.msaa });
  if (!post.hdr) renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6f3ee);
  const pmrem = new THREE.PMREMGenerator(renderer);
  // Stejná velikost jako u prostředí nasnímaného z pokoje (cubeRT níže): shadery se pak sdílejí a nekompilují dvakrát.
  const ENV_SIZE = 128;
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: ENV_SIZE }).texture;
  let capturedEnv: THREE.Texture | null = null;
  scene.environment = roomEnv;
  scene.environmentIntensity = 0.55;

  const apt = buildApartment();
  scene.add(apt.root);
  const bakeUniforms = createBakeUniforms();
  for (const m of apt.layout.lmMeshes) patchBakeMaterial(m.material as THREE.MeshStandardMaterial, "lm", bakeUniforms);
  for (const m of apt.layout.vtxMeshes) patchBakeMaterial(m.material as THREE.MeshStandardMaterial, "vtx", bakeUniforms);
  const refl = new FloorReflection(renderer, post.hdr, Q.reflDiv);
  refl.patch(apt.floorMaterial);
  // Podlaha se do vlastního odrazu nekreslí (jinak by četla texturu, do které se právě kreslí).
  const floorMeshes = apt.layout.lmMeshes.filter((m) => m.material === apt.floorMaterial);
  const overviewHide: THREE.Object3D[] = [], overviewShow: THREE.Object3D[] = [];
  apt.root.traverse((o) => { if (o.userData.overview === "hide") overviewHide.push(o); else if (o.userData.overview === "show") overviewShow.push(o); });

  // Výhled z oken: plochy těsně za okenními otvory, barvu počítá shader podle směru pohledu
  // (panorama v nekonečnu). Načte se spolu se světlem.
  const backdrop = new THREE.Group();
  let backdropMat: THREE.Material = new THREE.MeshBasicMaterial({ color: 0xdfe6ec, side: THREE.DoubleSide });
  for (const p of apt.portals) {
    const w = p.u.length() + 0.12, h = p.v.length() + 0.12;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), backdropMat);
    q.position.copy(p.o).addScaledVector(p.u, 0.5).addScaledVector(p.v, 0.5).addScaledVector(p.n, -0.01);
    q.lookAt(q.position.clone().add(p.n));
    q.frustumCulled = false;
    backdrop.add(q);
  }
  scene.add(backdrop);
  overviewHide.push(backdrop);
  const setBackdropMat = (m: THREE.Material) => { backdropMat.dispose(); backdropMat = m; backdrop.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = m; }); };

  const sunDir = new THREE.Vector3(...SUN_DIR).normalize();
  const sun = new THREE.DirectionalLight(new THREE.Color().setRGB(...SUN_COLOR), SUN_E);
  sun.position.copy(apt.center).addScaledVector(sunDir, 22);
  sun.target.position.copy(apt.center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
  const sc = sun.shadow.camera;
  sc.left = -8.5; sc.right = 8.5; sc.top = 8.5; sc.bottom = -8.5; sc.near = 8; sc.far = 40;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  // Náhradní osvětlení bez předpočítaného světla (pohled „celý byt“, nebo když se soubor nenačte).
  const bounce = new THREE.HemisphereLight(0xffffff, 0xd9c7ae, 0.9);
  scene.add(bounce);
  const lampLights = apt.emitters.map((e) => {
    const l = new THREE.PointLight(e.color, 0, 6, 2);
    l.position.copy(e.pos);
    scene.add(l);
    return { l, e };
  });

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 150);
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.25);

  let view: ViewId = "living";
  let lighting: LightingMode = "day";
  let overview = false;
  let yaw = 0, pitch = 0, zoomK = 1;
  let anim: { from: CamState; to: CamState; t0: number; dur: number; next: ViewId } | null = null;
  let dirty = true;
  let ready = false;
  let disposed = false;
  let raf = 0;
  let visible = true;
  let cur: CamState = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50, level: 1 };
  let jitter = [0, 0];
  let lastChange = 0;
  /** Probíhá kompilace shaderů — nekreslí se (jinak by se stránka zasekla). */
  let compiling = 0;
  let readyAt = 0;
  let slow = 0, slowFired = false, lastDragT = 0;
  let lost = false;

  const bakes: Partial<Record<LightingMode, BakeSet>> = {};
  const bakeLoads: Partial<Record<LightingMode, Promise<BakeSet | null>>> = {};
  let bakeActive: LightingMode | null = null;

  const vfov = (hfov: number) => clamp((2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / camera.aspect) * 180) / Math.PI, 36, 80);

  function camFor(p: CameraPreset, y: number, pt: number, z: number): CamState {
    if (p.mode === "look") {
      const d = p.target.clone().sub(p.pos);
      const dist = d.length();
      const yawF = Math.atan2(d.x, d.z) + y;
      const pitchF = clamp(Math.asin(d.y / dist) + pt, -0.7, 0.4);
      const dir = new THREE.Vector3(Math.sin(yawF) * Math.cos(pitchF), Math.sin(pitchF), Math.cos(yawF) * Math.cos(pitchF));
      return { pos: p.pos.clone(), target: p.pos.clone().addScaledVector(dir, dist), fov: clamp(vfov(p.hfov) / z, 18, 80), level: 1 };
    }
    const off = p.pos.clone().sub(p.target);
    const r = off.length() / z;
    const az = Math.atan2(off.x, off.z) + y;
    const pol = clamp(Math.acos(off.y / off.length()) + pt, 0.12, 1.2);
    const pos = p.target.clone().add(new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)).multiplyScalar(r));
    return { pos, target: p.target.clone(), fov: vfov(p.hfov), level: 0 };
  }

  /**
   * Kamera: u pohledů do místností vodorovná s posunem objektivu (shift) — svislé hrany zůstanou
   * svislé jako na architektonické fotografii. `level` plynule přechází mezi náklonem a posunem.
   */
  function apply(s: CamState) {
    camera.position.copy(s.pos);
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
    const d = s.target.clone().sub(s.pos);
    const horiz = Math.hypot(d.x, d.z);
    const pitchAll = Math.atan2(d.y, horiz);
    const shiftPart = pitchAll * s.level;
    const look = s.pos.clone().add(new THREE.Vector3(d.x, Math.tan(pitchAll - shiftPart) * horiz, d.z));
    camera.lookAt(look);
    const e = camera.projectionMatrix.elements;
    e[9] = Math.tan(shiftPart) / Math.tan((s.fov * Math.PI) / 360) + jitter[1];
    e[8] += jitter[0];
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    cur = { pos: s.pos.clone(), target: s.target.clone(), fov: s.fov, level: s.level };
  }

  let wb: [number, number, number] = [1, 1, 1];
  function lightState() {
    const baked = !overview && bakeActive !== null;
    // Vyvážení bílé patří k předpočítanému světlu; pohled „celý byt“ má náhradní neutrální osvětlení.
    if (baked) post.setWhiteBalance(...wb); else post.setWhiteBalance(1, 1, 1);
    bakeUniforms.uBakeOn.value = baked ? 1 : 0;
    if (!baked) bakeUniforms.uBoxOn.value = 0;
    const eve = lighting === "evening";
    bounce.intensity = baked ? 0 : eve ? 0.12 : 0.9;
    scene.environment = baked && capturedEnv ? capturedEnv : roomEnv;
    scene.environmentIntensity = baked ? (capturedEnv ? 1 : 0.35) : eve ? 0.08 : 0.55;
    for (const { l, e } of lampLights) l.intensity = !baked && (e.mode === "always" || eve) ? e.intensity : 0;
    for (const o of overviewHide) o.visible = !overview;
    // Řez stěn jen v pohledu „celý byt“; měkké stíny pod nábytkem všude, kde chybí předpočítané světlo.
    for (const o of overviewShow) o.visible = overview || (!!o.userData.blob && !baked);
    renderer.clippingPlanes = overview ? [cutPlane] : [];
    // Pozadí „celého bytu“ je o tónovou křivku světlejší, aby po ní vyšlo stejně jako stránka (#f6f3ee).
    const bg = scene.background as THREE.Color;
    if (overview) bg.set(0xf6f3ee).multiplyScalar(post.hdr ? 1.34 : 1); else bg.set(0x1d1c1a);
    post.setVignette(overview ? 0 : 0.14);
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
  }

  function setOverviewMode(on: boolean) {
    if (overview === on) return;
    overview = on;
    lightState();
    // Řez stěn (clipping plane) je jiná varianta shaderů — poprvé se kompiluje za běhu.
    if (ready && on) void prewarm();
  }

  /* ---------------- odlesky: prostředí nasnímané z místa kamery (s předpočítaným světlem) */
  const cubeRT = new THREE.WebGLCubeRenderTarget(ENV_SIZE, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.05, 120, cubeRT);
  function captureEnv() {
    if (overview || bakeActive === null || disposed) return;
    scene.environment = capturedEnv ?? roomEnv;
    const preset = apt.views[view === "overview" ? "living" : view];
    cubeCam.position.copy(preset.pos);
    renderer.clippingPlanes = [];
    bakeUniforms.uBoxOn.value = 0;
    cubeCam.update(renderer, scene);
    if (preset.box) {
      bakeUniforms.uBoxMin.value.copy(preset.box.min);
      bakeUniforms.uBoxMax.value.copy(preset.box.max);
      bakeUniforms.uBoxProbe.value.copy(preset.pos);
      bakeUniforms.uBoxOn.value = 1;
    }
    const prev = capturedEnv;
    capturedEnv = pmrem.fromCubemap(cubeRT.texture).texture;
    prev?.dispose();
    lightState();
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

  /* ---------------- smyčka: změna → nový snímek, v klidu průměrování s posunem o zlomek pixelu */
  const sunJit = new THREE.Vector3(), su = new THREE.Vector3(), sv = new THREE.Vector3();
  su.crossVectors(sunDir, new THREE.Vector3(0, 1, 0)).normalize();
  sv.crossVectors(su, sunDir).normalize();
  let sunJittered = false;
  function frame(restart: boolean) {
    const n = post.frames;
    if (restart || !post.hdr) {
      jitter = [0, 0];
      sunJit.copy(sunDir);
    } else {
      const w = Math.max(1, canvas.width), h = Math.max(1, canvas.height);
      jitter = [((halton(n + 1, 2) - 0.5) * 2) / w, ((halton(n + 1, 3) - 0.5) * 2) / h];
      // Měkký okraj slunečních skvrn: každý snímek trochu jiný směr v disku slunce.
      const a = n * 2.399963, rr = SUN_RADIUS * Math.sqrt((n % Q.accum) / Q.accum);
      sunJit.copy(sunDir).addScaledVector(su, Math.cos(a) * rr).addScaledVector(sv, Math.sin(a) * rr).normalize();
    }
    const jit = !restart && post.hdr;
    if (jit || sunJittered) renderer.shadowMap.needsUpdate = true;
    sunJittered = jit;
    sun.position.copy(apt.center).addScaledVector(sunJit, 22);
    apply(cur);
    // Zrcadlový obraz pro lesk podlahy stačí jednou na polohu kamery (je rozmazaný).
    if (restart) {
      if (overview) refl.uniforms.uReflOn.value = 0;
      else refl.update(scene, camera, floorMeshes);
    }
    // Mezilehlé průměrované snímky se na obrazovku nevykreslují (záře + výstup stojí jako další průchod).
    post.render(scene, camera, restart, restart || post.frames + 1 >= Q.accum || (post.frames + 1) % 3 === 0);
  }

  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    if (anim) {
      const t = clamp((now - anim.t0) / anim.dur, 0, 1);
      const e = ease(t);
      cur = { pos: anim.from.pos.clone().lerp(anim.to.pos, e), target: anim.from.target.clone().lerp(anim.to.target, e), fov: anim.from.fov + (anim.to.fov - anim.from.fov) * e, level: anim.from.level + (anim.to.level - anim.from.level) * e };
      dirty = true;
      if (t >= 1) {
        const next = anim.next;
        anim = null;
        if (next !== "overview") { setOverviewMode(false); captureEnv(); }
      }
    }
    if (!visible || !ready || compiling > 0 || lost) return;
    if (dirty) {
      dirty = false;
      lastChange = now;
      frame(true);
      updateLabels();
      watchSpeed(now);
      return;
    }
    // Průměrování až po krátké pauze (při tažení by jen zdržovalo).
    if (post.hdr && post.frames < Q.accum && now - lastChange > 90) {
      frame(false);
      if (post.frames === Q.accum) opts.onSettled?.();
    }
  }

  /** Při tažení prstem / myší musí být obraz plynulý; když je trvale pomalý, ohlásí se to stránce. */
  function watchSpeed(now: number) {
    if (pointers.size === 0 || anim || now - readyAt < 2500) { lastDragT = 0; slow = 0; return; }
    const dt = now - lastDragT;
    if (lastDragT && dt < 500) slow = dt > SLOW_MS ? slow + 1 : 0;
    lastDragT = now;
    if (slow >= SLOW_FRAMES && !slowFired) { slowFired = true; opts.onSlow?.(); }
  }

  /** Předkompiluje shadery pro aktuální stav scény bez zablokování stránky (paralelní kompilace). */
  function prewarm(): Promise<void> {
    compiling++;
    return post.compile(scene, camera).catch(() => undefined).then(() => { compiling--; dirty = true; });
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
      cur = target;
      dirty = true;
      if (ready && v !== "overview") captureEnv();
      return;
    }
    anim = { from: { ...cur, pos: cur.pos.clone(), target: cur.target.clone() }, to: target, t0: performance.now(), dur: prev === "overview" || v === "overview" ? 1100 : 850, next: v };
  }

  const refresh = () => { if (!anim) { cur = camFor(apt.views[view], yaw, pitch, zoomK); dirty = true; } };

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
      pitch = clamp(pitch + dy * k, -0.4, 0.45);
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
  const onLostCtx = (e: Event) => { e.preventDefault(); lost = true; if (!disposed) opts.onLost?.(); };
  canvas.addEventListener("webglcontextlost", onLostCtx);

  function zoom(f: number) {
    const [lo, hi] = apt.views[view].mode === "look" ? [0.9, 2.4] : [0.75, 2.2];
    zoomK = clamp(zoomK * f, lo, hi);
    refresh();
  }
  function resetView() { yaw = 0; pitch = 0; zoomK = 1; refresh(); }

  const ro = new ResizeObserver(() => {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    // Strop počtu pixelů: HDR buffery s vyhlazováním jsou náročné na paměť GPU.
    const pr = Math.min(dpr, Q.maxDpr, Math.sqrt(Q.maxPixels / (w * h)));
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    post.setSize(canvas.width, canvas.height);
    refl.setSize(canvas.width, canvas.height);
    camera.aspect = w / h;
    if (anim) anim.to = camFor(apt.views[anim.next], 0, 0, 1);
    else cur = camFor(apt.views[view], yaw, pitch, zoomK);
    dirty = true;
  });
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); if (visible) dirty = true; });
  io.observe(canvas);

  /* ---------------- podlaha */
  const tiles = new Map<string, { tile: FloorTile; map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();
  let floorRequest = 0;
  let resolveFirstFloor!: () => void;
  const firstFloor = new Promise<void>((r) => (resolveFirstFloor = r));
  async function setFloor(f: FloorInput) {
    const my = ++floorRequest;
    const p = f.palette;
    const key = [f.seedKey, f.kind, f.pattern, f.plankL, f.plankW, f.bevel, ...p.dark, ...p.base, ...p.light].map((x) => (typeof x === "number" ? x.toFixed(3) : String(x))).join("|");
    let e = tiles.get(key);
    if (!e) {
      // Generování lamel se dělí na kroky, ve kterých stránka dýchá (na telefonu jinak na pár vteřin zamrzne).
      const tile = await buildFloorTile(f, maxSide, Q.boardPpm);
      if (disposed || my !== floorRequest) return;
      const map = new THREE.CanvasTexture(tile.map);
      map.colorSpace = THREE.SRGBColorSpace;
      const bump = new THREE.CanvasTexture(tile.bump);
      for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }
      // Po nahrání do GPU se plátno uvolní (dlaždice má desítky MB; mobilní prohlížeče mají limit na plátna).
      map.onUpdate = () => { tile.map.width = tile.map.height = 0; };
      bump.onUpdate = () => { tile.bump.width = tile.bump.height = 0; };
      e = { tile, map, bump };
      tiles.set(key, e);
      // Drží se jen pár posledních dekorů (paměť GPU na mobilech).
      while (tiles.size > (Q.level === "low" ? 2 : 3)) {
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
    if (disposed || my !== floorRequest) return;
    for (const t of [e.map, e.bump]) { t.repeat.set(1 / e.tile.tileW, 1 / e.tile.tileH); t.rotation = rot; t.center.set(0, 0); }
    const first = !apt.floorMaterial.map;
    apt.floorMaterial.map = e.map;
    apt.floorMaterial.bumpMap = e.bump;
    apt.floorMaterial.bumpScale = f.bevel ? 1.6 : 0.7;
    if (first) apt.floorMaterial.needsUpdate = true;
    // Odražené světlo podle průměrné barvy dekoru (tmavá podlaha = tmavší místnost).
    const c = new THREE.Color().setRGB(p.base[0] / 255, p.base[1] / 255, p.base[2] / 255, THREE.SRGBColorSpace);
    bakeUniforms.uFloorD.value.set(c.r - apt.floorAlbedo0[0], c.g - apt.floorAlbedo0[1], c.b - apt.floorAlbedo0[2]);
    dirty = true;
    resolveFirstFloor();
  }

  function setWallColor(hex: string) {
    apt.wallMaterial.color.set(hex);
    const c = apt.wallMaterial.color;
    bakeUniforms.uWallD.value.set(c.r - apt.wallAlbedo0[0], c.g - apt.wallAlbedo0[1], c.b - apt.wallAlbedo0[2]);
    dirty = true;
  }

  function loadBake(mode: LightingMode) {
    bakeLoads[mode] ??= fetchBake(mode)
      .then((d) => (disposed ? null : (bakes[mode] = prepareBake(apt.layout, d))))
      .catch((err) => { console.warn("[vizualizace] předpočítané světlo nedostupné:", err); return null; });
    return bakeLoads[mode]!;
  }

  async function applyLighting(l: LightingMode) {
    const set = bakes[l];
    if (set) { applyBake(apt.layout, set, bakeUniforms); bakeActive = l; } else bakeActive = null;
    const eve = l === "evening";
    sun.visible = !eve;
    const bm = backdropMat as THREE.ShaderMaterial;
    if (bm.isShaderMaterial) bm.uniforms.uScale.value.set(1, 1, 1).multiplyScalar(EXTERIOR.display).multiply(eve ? new THREE.Vector3(...EXTERIOR.evening) : new THREE.Vector3(1, 1, 1));
    for (const g of apt.glowing) g.mat.emissiveIntensity = g.mode === "always" || eve ? g.strength : 0;
    for (const e of apt.emitters) for (const s of e.shades) s.emissiveIntensity = e.mode === "always" || eve ? 1.3 : 0;
    renderer.toneMappingExposure = EXPOSURE[l];
    // Vyvážení bílé podle barvy světla na stěnách (ve dne skoro plně, večer méně — zůstane teplá atmosféra).
    const wl = set?.wallLight;
    wb = [1, 1, 1];
    if (wl) {
      const lum = 0.2126 * wl[0] + 0.7152 * wl[1] + 0.0722 * wl[2];
      const k = eve ? 0.3 : 0.85;
      const g = wl.map((c) => 1 + ((lum / Math.max(1e-4, c)) - 1) * k);
      const gl = 0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2];
      wb = [g[0] / gl, g[1] / gl, g[2] / gl];
    }
    lightState();
    // Večer bez slunce = jiné shadery; kompilují se souběžně, dokud se nic nekreslí.
    if (ready) { await prewarm(); if (!disposed) captureEnv(); }
  }

  function setLighting(l: LightingMode) {
    lighting = l;
    if (bakes[l] || !ready) { if (ready) void applyLighting(l); return; }
    opts.onBusy?.(true);
    loadBake(l).then(async () => {
      if (disposed || lighting !== l) { if (!disposed) opts.onBusy?.(false); return; }
      await applyLighting(l);
      if (!disposed) opts.onBusy?.(false);
    });
  }

  // Start: světlo pro den a výhled z oken; do té doby zůstává plátno skryté (indikátor načítání).
  const extTex = new THREE.TextureLoader().loadAsync(`/visualizer/exterior-${Q.exterior === "auto" ? (window.innerWidth >= 900 ? "l" : "s") : Q.exterior}.jpg`).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, aniso);
    return t;
  }).catch(() => null);
  // První podlaha má být hotová dřív než shadery (materiál podlahy se s texturou překládá).
  Promise.all([loadBake("day"), extTex, Promise.race([firstFloor, new Promise((r) => setTimeout(r, 6000))])]).then(async ([, tex]) => {
    if (disposed) { tex?.dispose(); return; }
    if (tex) setBackdropMat(backdropMaterial(tex));
    await applyLighting(lighting);
    if (disposed) return;
    await prewarm();
    if (disposed) return;
    ready = true;
    setView(view, true);
    readyAt = performance.now();
    dirty = true;
    opts.onReady?.();
    if (!bakes[lighting]) setLighting(lighting);
  }).catch((err) => { console.warn("[vizualizace] start selhal:", err); if (!disposed) opts.onLost?.(); });

  lightState();
  cur = camFor(apt.views[view], 0, 0, 1);
  raf = requestAnimationFrame(tick);

  return {
    setView,
    setFloor,
    setWallColor,
    setSkirtingColor(hex) { apt.skirtingMaterial.color.set(hex); dirty = true; },
    setLighting,
    zoom,
    resetView,
    snapshot() { post.present(); return canvas.toDataURL("image/jpeg", 0.92); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDbl);
      canvas.removeEventListener("webglcontextlost", onLostCtx);
      for (const { el } of labels) el.remove();
      for (const e of tiles.values()) { e.map.dispose(); e.bump.dispose(); }
      tiles.clear();
      for (const s of Object.values(bakes)) if (s) disposeBake(s);
      extTex.then((t) => t?.dispose());
      apt.dispose();
      backdrop.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); backdropMat.dispose();
      roomEnv.dispose(); capturedEnv?.dispose(); cubeRT.dispose(); pmrem.dispose();
      post.dispose();
      refl.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
