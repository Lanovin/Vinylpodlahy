import * as THREE from "three";

/**
 * „Fotoaparát“: scéna se kreslí do HDR bufferu, v klidu se průměruje více snímků s posunem o zlomek
 * pixelu (vyhlazené hrany, měkké stíny), přidá se jemná záře kolem přesvícených oken, vinětace,
 * tónová křivka a dithering proti pruhům v přechodech.
 */

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

function pass(frag: string, uniforms: Record<string, THREE.IUniform>, toneMapped = false) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped });
}

const ACCUM = /* glsl */ `
uniform sampler2D tNew; uniform sampler2D tPrev; uniform float uWeight; varying vec2 vUv;
void main() { gl_FragColor = mix( texture2D( tPrev, vUv ), texture2D( tNew, vUv ), uWeight ); }`;

const BRIGHT = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; varying vec2 vUv;
void main() {
	vec3 c = vec3( 0.0 );
	for ( int x = -1; x <= 1; x ++ ) for ( int y = -1; y <= 1; y ++ ) c += texture2D( tSrc, vUv + vec2( x, y ) * uTexel * 1.5 ).rgb;
	c /= 9.0;
	float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor = vec4( c * smoothstep( uThreshold, uThreshold * 3.0, l ), 1.0 );
}`;

const BLUR = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main() {
	vec3 c = texture2D( tSrc, vUv ).rgb * 0.2270270270;
	c += ( texture2D( tSrc, vUv + uDir * 1.3846153846 ).rgb + texture2D( tSrc, vUv - uDir * 1.3846153846 ).rgb ) * 0.3162162162;
	c += ( texture2D( tSrc, vUv + uDir * 3.2307692308 ).rgb + texture2D( tSrc, vUv - uDir * 3.2307692308 ).rgb ) * 0.0702702703;
	gl_FragColor = vec4( c, 1.0 );
}`;

const FINAL = /* glsl */ `
uniform sampler2D tSrc; uniform sampler2D tBloom; uniform sampler2D tBloom2; uniform float uBloom; uniform float uVignette; uniform float uFrame; uniform vec2 uRes; uniform vec3 uWB;
varying vec2 vUv;
float hash12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
void main() {
	vec3 c = texture2D( tSrc, vUv ).rgb;
	c += ( texture2D( tBloom, vUv ).rgb * 0.6 + texture2D( tBloom2, vUv ).rgb * 0.4 ) * uBloom;
	c *= uWB;
	// Filmová křivka ve stínech: hluboké stíny mírně odbarví (násobené odrazy teplého dřeva by jinak „zkhakověly“).
	float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c = mix( vec3( lum ), c, mix( 0.72, 1.0, smoothstep( 0.004, 0.09, lum ) ) );
	vec2 q = vUv - 0.5;
	q.x *= uRes.x / uRes.y;
	c *= 1.0 - uVignette * smoothstep( 0.35, 1.1, length( q ) );
	gl_FragColor = vec4( c, 1.0 );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	gl_FragColor.rgb += ( hash12( gl_FragCoord.xy + uFrame * 17.0 ) - 0.5 ) / 255.0;
}`;

export interface PostOptions { bloom: number; vignette: number; samples: number }

export class PhotoPipeline {
  readonly hdr: boolean;
  private renderer: THREE.WebGLRenderer;
  private quad: THREE.Mesh;
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rtScene!: THREE.WebGLRenderTarget;
  /** Bez vyhlazování hran: snímky, které se průměrují, si vystačí s posunem o zlomek pixelu (vzniká vyhlazení lepší než MSAA). */
  private rtPlain: THREE.WebGLRenderTarget | null = null;
  private acc!: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private bloomA!: THREE.WebGLRenderTarget;
  private bloomB!: THREE.WebGLRenderTarget;
  private bloomC!: THREE.WebGLRenderTarget;
  private bloomD!: THREE.WebGLRenderTarget;
  private cur = 0;
  private w = 1;
  private h = 1;
  private mAccum = pass(ACCUM, { tNew: { value: null }, tPrev: { value: null }, uWeight: { value: 1 } });
  private mBright = pass(BRIGHT, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.6 } });
  private mBlur = pass(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
  private mFinal = pass(FINAL, { tSrc: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, uBloom: { value: 0.06 }, uVignette: { value: 0.12 }, uFrame: { value: 0 }, uRes: { value: new THREE.Vector2() }, uWB: { value: new THREE.Vector3(1, 1, 1) } }, true);
  /** Počet již zprůměrovaných snímků. */
  frames = 0;

  constructor(renderer: THREE.WebGLRenderer, private opts: PostOptions) {
    this.renderer = renderer;
    const ext = renderer.extensions;
    this.hdr = ext.has("EXT_color_buffer_float") || ext.has("EXT_color_buffer_half_float");
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mFinal);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
    this.mFinal.uniforms.uBloom.value = opts.bloom;
    this.mFinal.uniforms.uVignette.value = opts.vignette;
    if (this.hdr) this.allocate(1, 1);
  }

  private allocate(w: number, h: number) {
    this.dispose(true);
    const o = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter } as const;
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { ...o, depthBuffer: true, samples: this.opts.samples });
    this.rtPlain = null;
    this.acc = [new THREE.WebGLRenderTarget(w, h, o), new THREE.WebGLRenderTarget(w, h, o)];
    const bw = Math.max(1, Math.round(w / 4)), bh = Math.max(1, Math.round(h / 4));
    this.bloomA = new THREE.WebGLRenderTarget(bw, bh, o);
    this.bloomB = new THREE.WebGLRenderTarget(bw, bh, o);
    this.bloomC = new THREE.WebGLRenderTarget(Math.max(1, Math.round(bw / 4)), Math.max(1, Math.round(bh / 4)), o);
    this.bloomD = new THREE.WebGLRenderTarget(Math.max(1, Math.round(bw / 4)), Math.max(1, Math.round(bh / 4)), o);
    this.w = w; this.h = h;
    this.frames = 0;
  }

  /** Síla vinětace (v pohledu „celý byt“ 0, aby pozadí splynulo se stránkou). */
  setVignette(v: number) { this.mFinal.uniforms.uVignette.value = v; }

  /** Vyvážení bílé (násobky kanálů v lineárním prostoru). */
  setWhiteBalance(r: number, g: number, b: number) { this.mFinal.uniforms.uWB.value.set(r, g, b); }

  setSize(w: number, h: number) {
    if (this.hdr && (w !== this.w || h !== this.h)) this.allocate(w, h);
    this.mFinal.uniforms.uRes.value.set(w, h);
  }

  private blit(m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  /**
   * Předkompiluje shadery scény pro vykreslování do HDR bufferu (paralelně, bez zablokování stránky).
   * Program závisí i na cíli vykreslení, proto se cíl na dobu volání nastaví.
   */
  compile(scene: THREE.Scene, camera: THREE.Camera): Promise<void> {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    if (this.hdr) r.setRenderTarget(this.rtScene);
    const done = r.compileAsync(scene, camera).then(() => undefined);
    r.setRenderTarget(prev);
    return done;
  }

  /** Vykreslí snímek; restart začne nové průměrování, present = přenést výsledek na obrazovku. */
  render(scene: THREE.Scene, camera: THREE.Camera, restart: boolean, present = true) {
    const r = this.renderer;
    if (!this.hdr) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      this.frames = 1;
      return;
    }
    if (restart) this.frames = 0;
    let target = this.rtScene;
    if (!restart && this.opts.samples > 0) {
      this.rtPlain ??= new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      target = this.rtPlain;
    }
    r.setRenderTarget(target);
    r.render(scene, camera);
    const prev = this.acc[this.cur], next = this.acc[this.cur ^ 1];
    this.mAccum.uniforms.tNew.value = target.texture;
    this.mAccum.uniforms.tPrev.value = prev.texture;
    this.mAccum.uniforms.uWeight.value = 1 / (this.frames + 1);
    this.blit(this.mAccum, next);
    this.cur ^= 1;
    this.frames++;
    if (present) this.present();
  }

  /** Záře a výstup na obrazovku z aktuálního průměru. */
  present() {
    if (!this.hdr) return;
    const src = this.acc[this.cur].texture;
    this.mBright.uniforms.tSrc.value = src;
    this.mBright.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
    this.blit(this.mBright, this.bloomA);
    const blur = (a: THREE.WebGLRenderTarget, b: THREE.WebGLRenderTarget, s: number) => {
      this.mBlur.uniforms.tSrc.value = a.texture; this.mBlur.uniforms.uDir.value.set(s / a.width, 0); this.blit(this.mBlur, b);
      this.mBlur.uniforms.tSrc.value = b.texture; this.mBlur.uniforms.uDir.value.set(0, s / a.height); this.blit(this.mBlur, a);
    };
    blur(this.bloomA, this.bloomB, 1);
    this.mBlur.uniforms.tSrc.value = this.bloomA.texture; this.mBlur.uniforms.uDir.value.set(1 / this.bloomA.width, 0); this.blit(this.mBlur, this.bloomC);
    this.mBlur.uniforms.tSrc.value = this.bloomC.texture; this.mBlur.uniforms.uDir.value.set(0, 1 / this.bloomC.height); this.blit(this.mBlur, this.bloomD);
    blur(this.bloomD, this.bloomC, 1.5);
    this.mFinal.uniforms.tSrc.value = src;
    this.mFinal.uniforms.tBloom.value = this.bloomA.texture;
    this.mFinal.uniforms.tBloom2.value = this.bloomD.texture;
    this.mFinal.uniforms.uFrame.value = this.frames;
    this.blit(this.mFinal, null);
  }

  dispose(keepMaterials = false) {
    for (const rt of [this.rtScene, this.rtPlain, ...(this.acc ?? []), this.bloomA, this.bloomB, this.bloomC, this.bloomD]) rt?.dispose();
    if (!keepMaterials) {
      for (const m of [this.mAccum, this.mBright, this.mBlur, this.mFinal]) m.dispose();
      this.quad.geometry.dispose();
    }
  }
}
