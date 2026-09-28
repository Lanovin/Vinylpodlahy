import * as THREE from "three";
import { decodeBake, type BakeData } from "./bakeFormat";
import type { BakeLayout } from "./layout";
import type { LightingMode } from "./lighting";

/**
 * Předpočítané světlo v prohlížeči: načtení souboru, lightmapy a atributy vrcholů, úprava shaderů.
 * Ozáření ze souboru nahradí rozptýlené světlo z prostředí (iblIrradiance); odlesky z prostředí zůstávají.
 */

/** Uniformy předpočítaného světla — každý prohlížeč má vlastní sadu (sdílí ji všechny jeho materiály). */
export const createBakeUniforms = () => ({
  uBakeOn: { value: 0 },
  /** Kvádr místnosti pro odlesky s paralaxou (prostředí nasnímané z bodu uBoxProbe). */
  uBoxOn: { value: 0 },
  uBoxMin: { value: new THREE.Vector3() },
  uBoxMax: { value: new THREE.Vector3() },
  uBoxProbe: { value: new THREE.Vector3() },
  uFloorD: { value: new THREE.Vector3() },
  uWallD: { value: new THREE.Vector3() },
  tBake0: { value: null as THREE.Texture | null },
  tBakeF: { value: null as THREE.Texture | null },
  tBakeW: { value: null as THREE.Texture | null },
});
export type BakeUniforms = ReturnType<typeof createBakeUniforms>;

const VERT_PARS = /* glsl */ `
varying vec3 vBoxWorldPos;
#ifdef BAKE_VTX
attribute vec3 bk0; attribute vec3 bkF; attribute vec3 bkW;
varying vec3 vBk0; varying vec3 vBkF; varying vec3 vBkW;
#endif
#ifdef BAKE_LM
attribute vec2 bkuv; varying vec2 vBkUv;
#endif
`;
const VERT_MAIN = /* glsl */ `
vBoxWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
#ifdef BAKE_VTX
vBk0 = bk0; vBkF = bkF; vBkW = bkW;
#endif
#ifdef BAKE_LM
vBkUv = bkuv;
#endif
`;
const FRAG_PARS = /* glsl */ `
uniform float uBakeOn; uniform vec3 uFloorD; uniform vec3 uWallD;
uniform float uBoxOn; uniform vec3 uBoxMin; uniform vec3 uBoxMax; uniform vec3 uBoxProbe; varying vec3 vBoxWorldPos;
vec3 boxProject( vec3 d ) {
	vec3 p = vBoxWorldPos;
	if ( uBoxOn < 0.5 || any( lessThan( p, uBoxMin ) ) || any( greaterThan( p, uBoxMax ) ) ) return d;
	vec3 t = max( ( uBoxMax - p ) / d, ( uBoxMin - p ) / d );
	return normalize( p + d * min( min( t.x, t.y ), t.z ) - uBoxProbe );
}
#ifdef BAKE_VTX
varying vec3 vBk0; varying vec3 vBkF; varying vec3 vBkW;
#endif
#ifdef BAKE_LM
uniform sampler2D tBake0; uniform sampler2D tBakeF; uniform sampler2D tBakeW; varying vec2 vBkUv;
#endif
`;
const FRAG_MAIN = /* glsl */ `
#if defined( RE_IndirectDiffuse ) && ( defined( BAKE_VTX ) || defined( BAKE_LM ) )
{
	#ifdef BAKE_LM
	vec3 bk0 = texture2D( tBake0, vBkUv ).rgb, bkF = texture2D( tBakeF, vBkUv ).rgb, bkW = texture2D( tBakeW, vBkUv ).rgb;
	#else
	vec3 bk0 = vBk0, bkF = vBkF, bkW = vBkW;
	#endif
	vec3 bakeE = max( bk0 + uFloorD * bkF + uWallD * bkW, vec3( 0.0 ) );
	iblIrradiance = mix( iblIrradiance, bakeE, uBakeOn );
}
#endif
`;

// Odlesk z prostředí s korekcí na kvádr místnosti (box projection).
const ENV_FROM = "reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );";
const ENV_PARS = THREE.ShaderChunk.envmap_physical_pars_fragment.replace(ENV_FROM, "reflectVec = boxProject( transformDirectionByInverseViewMatrix( reflectVec, viewMatrix ) );");
if (!THREE.ShaderChunk.envmap_physical_pars_fragment.includes(ENV_FROM)) console.warn("[vizualizace] box projection: shader chunk changed");

/** Doplní do materiálu čtení předpočítaného světla (zachová případný dřívější onBeforeCompile). */
export function patchBakeMaterial(m: THREE.MeshStandardMaterial, kind: "lm" | "vtx", U: BakeUniforms) {
  if (m.userData.bakePatched) return;
  m.userData.bakePatched = kind;
  m.defines = { ...(m.defines ?? {}), [kind === "lm" ? "BAKE_LM" : "BAKE_VTX"]: "" };
  const prev = m.onBeforeCompile.bind(m);
  const prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>\n${VERT_PARS}`).replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_MAIN}`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_PARS}`)
      .replace("#include <lights_fragment_maps>", `#include <lights_fragment_maps>\n${FRAG_MAIN}`)
      .replace("#include <envmap_physical_pars_fragment>", ENV_PARS);
  };
  m.customProgramCacheKey = () => `${prevKey()}|bake-${kind}`;
  m.needsUpdate = true;
}

export async function fetchBake(mode: LightingMode, signal?: AbortSignal): Promise<BakeData> {
  const res = await fetch(`/visualizer/bake-${mode}.bin`, { signal });
  if (!res.ok || !res.body) throw new Error(`bake ${mode}: HTTP ${res.status}`);
  if (typeof DecompressionStream === "undefined") throw new Error("DecompressionStream unsupported");
  const buf = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  return decodeBake(buf);
}

function rgbaHalf(src: Uint16Array, w: number, h: number) {
  const d = new Uint16Array(w * h * 4);
  for (let i = 0, j = 0; i < src.length; i += 3, j += 4) { d[j] = src[i]; d[j + 1] = src[i + 1]; d[j + 2] = src[i + 2]; d[j + 3] = 0x3c00; }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Sada světla pro jeden režim (den / večer) připravená k přepnutí. */
export interface BakeSet {
  textures: [THREE.Texture, THREE.Texture, THREE.Texture];
  attrs: [THREE.BufferAttribute, THREE.BufferAttribute, THREE.BufferAttribute][];
  /** Průměrná barva světla na stěnách (lineární RGB) — podklad pro vyvážení bílé. */
  wallLight: [number, number, number];
}

export function prepareBake(layout: BakeLayout, data: BakeData): BakeSet {
  if (data.hash !== layout.hash || data.atlasW !== layout.atlasW || data.atlasH !== layout.atlasH || data.vtx.length !== layout.vtxMeshes.length) {
    throw new Error("bake does not match the scene (run npm run bake:viz)");
  }
  const { atlasW: W, atlasH: H } = data;
  const textures: BakeSet["textures"] = [rgbaHalf(data.atlas.l0, W, H), rgbaHalf(data.atlas.df, W / 2, H / 2), rgbaHalf(data.atlas.dw, W / 2, H / 2)];
  const attrs = layout.vtxMeshes.map((m, i) => {
    const v = data.vtx[i];
    if (v.l0.length !== m.geometry.getAttribute("position").count * 3) throw new Error("bake vertex count mismatch");
    const a = (arr: Uint16Array) => { const b = new THREE.Float16BufferAttribute(arr, 3); b.array.set(arr); return b; };
    return [a(v.l0), a(v.df), a(v.dw)] as [THREE.BufferAttribute, THREE.BufferAttribute, THREE.BufferAttribute];
  });
  const acc = [0, 0, 0];
  let n = 0;
  for (const c of layout.charts) {
    if (c.mesh < 0 || (layout.lmMeshes[c.mesh].material as THREE.Material).userData.group !== "wall") continue;
    for (let j = 0; j < c.ch; j += 2) for (let i = 0; i < c.cw; i += 2) {
      const o = ((c.py + j) * W + c.px + i) * 3;
      for (let k = 0; k < 3; k++) acc[k] += THREE.DataUtils.fromHalfFloat(data.atlas.l0[o + k]);
      n++;
    }
  }
  const wallLight = acc.map((v) => v / Math.max(1, n)) as [number, number, number];
  return { textures, attrs, wallLight };
}

export function applyBake(layout: BakeLayout, set: BakeSet, U: BakeUniforms) {
  [U.tBake0.value, U.tBakeF.value, U.tBakeW.value] = set.textures;
  layout.vtxMeshes.forEach((m, i) => {
    const [l0, df, dw] = set.attrs[i];
    m.geometry.setAttribute("bk0", l0);
    m.geometry.setAttribute("bkF", df);
    m.geometry.setAttribute("bkW", dw);
  });
}

export function disposeBake(set: BakeSet) {
  for (const t of set.textures) t.dispose();
}
