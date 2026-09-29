import type * as THREE from "three";

/**
 * Náročnost zobrazení. Všechny stupně kreslí stejný byt se stejným předpočítaným světlem —
 * liší se jen tím, kolik pixelů, vzorků a paměti se na obrázek vynaloží. V klidu (po zprůměrování
 * snímků) je rozdíl mezi stupni na obrazovce telefonu skoro neznatelný.
 */
export type QualityLevel = "high" | "medium" | "low";
export type QualityChoice = QualityLevel | "auto";

export interface Quality {
  level: QualityLevel;
  /** Strop počtu pixelů plátna a poměr pixelů zařízení. */
  maxPixels: number;
  maxDpr: number;
  /** Vyhlazování hran při tažení (v klidu doostří průměrování snímků). */
  msaa: number;
  /** Kolik snímků se v klidu zprůměruje (měkké okraje slunce, hrany). */
  accum: number;
  /** Rozlišení stínové mapy slunce. */
  shadowSize: number;
  /** Zrcadlový obraz podlahy má rozlišení plátna děleno tímto číslem. */
  reflDiv: number;
  /** Strana dlaždice podlahy v pixelech a nejvyšší hustota pixelů jedné lamely (px/m). */
  floorSide: number;
  boardPpm: number;
  /** Nejvyšší anizotropní filtrování (ostrost podlahy pod úhlem). */
  aniso: number;
  /** Velikost obrázku výhledu z oken (velký má 2887 px, malý 1650 px). */
  exterior: "l" | "s" | "auto";
}

export const QUALITY: Record<QualityLevel, Quality> = {
  high: { level: "high", maxPixels: 2.6e6, maxDpr: 1.75, msaa: 4, accum: 20, shadowSize: 2048, reflDiv: 2, floorSide: 2560, boardPpm: 520, aniso: 16, exterior: "l" },
  medium: { level: "medium", maxPixels: 1.4e6, maxDpr: 2, msaa: 2, accum: 12, shadowSize: 1536, reflDiv: 2, floorSide: 2048, boardPpm: 420, aniso: 8, exterior: "auto" },
  low: { level: "low", maxPixels: 0.75e6, maxDpr: 1.5, msaa: 0, accum: 8, shadowSize: 1024, reflDiv: 3, floorSide: 1536, boardPpm: 320, aniso: 4, exterior: "s" },
};

export const LEVEL_ORDER: QualityLevel[] = ["high", "medium", "low"];
export const LEVEL_LABEL: Record<QualityLevel, string> = { high: "Plná", medium: "Vyvážená", low: "Úsporná" };

/** O stupeň níž (nebo null, když už níž nejde). */
export const lowerLevel = (l: QualityLevel): QualityLevel | null => LEVEL_ORDER[LEVEL_ORDER.indexOf(l) + 1] ?? null;

export interface Detection { level: QualityLevel; reason: string }

interface NavigatorHints { deviceMemory?: number; connection?: { saveData?: boolean } }

/**
 * Odhad výkonu zařízení bez zkoušení: softwarové vykreslování, paměť, počet jader, mobilní GPU,
 * velikost obrazovky. Chybný odhad vyrovná automatické snížení při trhaném tažení (viewer.onSlow)
 * a ruční přepínač v panelu.
 */
export function detectQuality(renderer: THREE.WebGLRenderer): Detection {
  const gl = renderer.getContext();
  const nav = navigator as Navigator & NavigatorHints;
  let gpu = "";
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
  } catch { /* ignore */ }

  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen/.test(gpu)) return { level: "low", reason: "softwarové vykreslování" };
  if (nav.connection?.saveData) return { level: "low", reason: "spořič dat" };

  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency || 4;
  const phone = Math.min(window.screen.width, window.screen.height) < 700;
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const cap = renderer.capabilities;
  const oldMobileGpu = /mali-(4|t[0-8])|adreno.{0,8}\b[2-5]\d\d\b|powervr|sgx|apple a[3-9]\b|intel.{0,12}(gma|hd graphics [2-4]\d{2,3}\b)/.test(gpu);

  if (cap.maxTextureSize < 4096 || oldMobileGpu) return { level: "low", reason: "starší grafický čip" };
  if (mem <= 2 || cores <= 2) return { level: "low", reason: "málo paměti nebo jader" };
  if (phone || touch) return { level: mem <= 3 ? "low" : "medium", reason: "mobilní zařízení" };
  if (mem <= 4) return { level: "medium", reason: "průměrný počítač" };
  return { level: "high", reason: "výkonný počítač" };
}
