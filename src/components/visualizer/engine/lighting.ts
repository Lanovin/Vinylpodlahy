/**
 * Konstanty osvětlení sdílené 3D scénou a skriptem pro výpočet světla (scripts/visualizer/bake.ts).
 * Bez závislosti na three.js. Jednotky: ozáření E (irradiance) jako v three.js — bílá plocha
 * s E = π má jas 1. Po změně čehokoli zde je potřeba znovu spustit `npm run bake:viz`.
 */

/** Směr KE slunci (normalizuje se až při použití). */
export const SUN_DIR: [number, number, number] = [-0.45, 0.72, -0.53];
/** Ozáření od slunce kolmo na paprsky. */
export const SUN_E = 7.5;
export const SUN_COLOR: [number, number, number] = [1, 0.95, 0.88];
/** Úhlový poloměr slunečního disku (rad) — měkkost okrajů slunečních skvrn. */
export const SUN_RADIUS = 0.0093;

/**
 * Výhled z oken: výřez panoramatu „Studio Garden“ (Poly Haven, CC0), natočený tak, aby francouzská
 * okna mířila na trávník se stromy (vila je stranou). V JPEG je uložena hodnota x / (1 + x) v sRGB.
 * Azimut θ = atan2(z, x) v rozsahu [thetaMin, thetaMax] (stupně), výška nad obzorem [elevMin, elevMax].
 */
export const EXTERIOR = {
  rotU: 0.101,
  thetaMin: 80,
  thetaMax: 370,
  elevMin: -62,
  elevMax: 56,
  /**
   * Jas panoramatu pro výpočet světla v bytě (násobek dekódované hodnoty). Ve výhledu z okna je
   * panorama tmavší (`display`) — jako u fotografie interiéru složené z více expozic, kde okna
   * nejsou úplně přepálená.
   */
  radiance: 18,
  display: 3,
  /** Sytost barev panoramatu pro výpočet světla (celkový nádech se navíc vyrovná na neutrální). */
  bakeSaturation: 0.85,
  /** Večer (modrá hodina): násobek a barevný nádech. */
  evening: [0.028, 0.042, 0.085] as [number, number, number],
};

export type LightingMode = "day" | "evening";
