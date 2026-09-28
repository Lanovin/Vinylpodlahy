import * as THREE from "three";

/**
 * Odlesk na podlaze: scéna se vykreslí zrcadlově přes rovinu y = 0 (virtuální kamera pod podlahou),
 * rozmaže se podle matnosti povrchu a podlaha ji použije místo odlesku z prostředí. Díky tomu se
 * v lesku podlahy správně rýsují okna a nábytek.
 */

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;
const BLUR = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main() {
	vec4 c = texture2D( tSrc, vUv ) * 0.2270270270;
	c += ( texture2D( tSrc, vUv + uDir * 1.3846153846 ) + texture2D( tSrc, vUv - uDir * 1.3846153846 ) ) * 0.3162162162;
	c += ( texture2D( tSrc, vUv + uDir * 3.2307692308 ) + texture2D( tSrc, vUv - uDir * 3.2307692308 ) ) * 0.0702702703;
	gl_FragColor = c;
}`;

export class FloorReflection {
  readonly uniforms = {
    tRefl: { value: null as THREE.Texture | null },
    tReflSharp: { value: null as THREE.Texture | null },
    uReflMatrix: { value: new THREE.Matrix4() },
    uReflOn: { value: 0 },
  };
  private rt: THREE.WebGLRenderTarget;
  private a: THREE.WebGLRenderTarget;
  private b: THREE.WebGLRenderTarget;
  private cam = new THREE.PerspectiveCamera();
  private blur = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BLUR, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blur);
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(private renderer: THREE.WebGLRenderer, hdr: boolean) {
    const o = { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false } as const;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { ...o, depthBuffer: true });
    this.a = new THREE.WebGLRenderTarget(1, 1, o);
    this.b = new THREE.WebGLRenderTarget(1, 1, o);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
    this.uniforms.tReflSharp.value = this.rt.texture;
    this.uniforms.tRefl.value = this.a.texture;
  }

  setSize(w: number, h: number) {
    const rw = Math.max(2, Math.round(w / 2)), rh = Math.max(2, Math.round(h / 2));
    this.rt.setSize(rw, rh);
    this.a.setSize(Math.max(2, Math.round(rw / 2)), Math.max(2, Math.round(rh / 2)));
    this.b.setSize(this.a.width, this.a.height);
  }

  /** Vykreslí zrcadlový obraz pro aktuální kameru (včetně posunu objektivu). */
  update(scene: THREE.Scene, camera: THREE.PerspectiveCamera, hidden: THREE.Object3D[]) {
    const r = this.renderer;
    // Zrcadlení přes y = 0: poloha, cíl i „nahoru“ kamery.
    const m = new THREE.Matrix4().makeScale(1, -1, 1).multiply(camera.matrixWorld);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    const dir = new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorld);
    dir.y = -dir.y;
    const up = new THREE.Vector3(0, 1, 0).transformDirection(camera.matrixWorld);
    up.y = -up.y;
    this.cam.position.copy(pos);
    this.cam.up.copy(up);
    this.cam.lookAt(pos.clone().add(dir));
    this.cam.updateMatrixWorld();
    this.cam.projectionMatrix.copy(camera.projectionMatrix);
    this.cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    this.uniforms.uReflMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(this.cam.projectionMatrix).multiply(this.cam.matrixWorldInverse);

    const vis = hidden.map((o) => o.visible);
    for (const o of hidden) o.visible = false;
    const prevTarget = r.getRenderTarget();
    const clip = r.clippingPlanes;
    r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.001)];
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, this.cam);
    r.clippingPlanes = clip;
    hidden.forEach((o, i) => (o.visible = vis[i]));
    // Rozmazání (lesk vinylu je hedvábný, ne zrcadlový): dvakrát oddělitelný Gauss ve čtvrtinovém rozlišení.
    const pass = (src: THREE.Texture, dst: THREE.WebGLRenderTarget, dx: number, dy: number) => {
      this.blur.uniforms.tSrc.value = src;
      this.blur.uniforms.uDir.value.set(dx, dy);
      r.setRenderTarget(dst);
      r.render(this.qScene, this.qCam);
    };
    const w = this.a.width, h = this.a.height;
    pass(this.rt.texture, this.b, 1 / this.rt.width, 0);
    pass(this.b.texture, this.a, 0, 1 / this.rt.height);
    pass(this.a.texture, this.b, 2 / w, 0);
    pass(this.b.texture, this.a, 0, 2 / h);
    r.setRenderTarget(prevTarget);
    this.uniforms.uReflOn.value = 1;
  }

  /** Podlahový materiál bere lesk ze zrcadlového obrazu místo z prostředí. */
  patch(m: THREE.MeshStandardMaterial) {
    const prev = m.onBeforeCompile.bind(m);
    const prevKey = m.customProgramCacheKey.bind(m);
    m.onBeforeCompile = (sh, rr) => {
      prev(sh, rr);
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform mat4 uReflMatrix; varying vec4 vReflUv;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvReflUv = uReflMatrix * modelMatrix * vec4( transformed, 1.0 );");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D tRefl; uniform sampler2D tReflSharp; uniform float uReflOn; varying vec4 vReflUv;")
        .replace("#include <lights_fragment_maps>", `#include <lights_fragment_maps>
	#if defined( RE_IndirectSpecular )
	{
		// Mírné zvlnění podle reliéfu (spáry, struktura) a mix ostrého a rozmazaného obrazu podle drsnosti.
		vec2 ruv = vReflUv.xy / vReflUv.w + ( normal.xy - geometryNormal.xy ) * 0.02;
		vec3 refl = mix( texture2D( tReflSharp, ruv ).rgb, texture2D( tRefl, ruv ).rgb, smoothstep( 0.05, 0.35, roughnessFactor ) );
		radiance = mix( radiance, refl, uReflOn );
		#ifdef USE_BUMPMAP
		// Ve spárách (V-drážka) se nic neodráží.
		radiance *= smoothstep( 0.15, 0.85, texture2D( bumpMap, vBumpMapUv ).r );
		#endif
	}
	#endif`);
    };
    m.customProgramCacheKey = () => `${prevKey()}|refl`;
    m.needsUpdate = true;
  }

  dispose() {
    this.rt.dispose(); this.a.dispose(); this.b.dispose();
    this.blur.dispose(); this.quad.geometry.dispose();
  }
}
