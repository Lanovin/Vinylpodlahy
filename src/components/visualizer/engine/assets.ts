import { decodeBake, type BakeData } from "./bakeFormat";
import type { LightingMode } from "./lighting";

/**
 * Soubory vizualizace z /public/visualizer (předpočítané světlo, výhled z oken). Stahují se přes
 * sdílené sliby: předběžné načtení (najetí na tlačítko „Byt ve 3D“) a samotný engine dostanou
 * jedno stažení, a engine ho může zahájit hned při startu, souběžně s prací procesoru.
 *
 * Adresa nese verzi z obsahu souborů (next.config.ts) — díky tomu se soubory cachují napořád
 * a po novém výpočtu světla se adresa změní.
 */

const VERSION = process.env.NEXT_PUBLIC_VIZ_ASSET_V;
export const vizAsset = (name: string) => `/visualizer/${name}${VERSION ? `?v=${VERSION}` : ""}`;

const bakeFiles = new Map<LightingMode, Promise<ArrayBuffer>>();

/** Stáhne (jednou) komprimovaný soubor předpočítaného světla; v paměti zůstane jen těch ~2 MB. */
export function prefetchBake(mode: LightingMode): Promise<ArrayBuffer> {
  let p = bakeFiles.get(mode);
  if (!p) {
    p = fetch(vizAsset(`bake-${mode}.bin`)).then((res) => {
      if (!res.ok) throw new Error(`bake ${mode}: HTTP ${res.status}`);
      return res.arrayBuffer();
    });
    bakeFiles.set(mode, p);
    p.catch(() => bakeFiles.delete(mode));
  }
  return p;
}

/** Předpočítané světlo rozbalené a dekódované. */
export async function loadBake(mode: LightingMode): Promise<BakeData> {
  const gz = await prefetchBake(mode);
  if (typeof DecompressionStream === "undefined") throw new Error("DecompressionStream unsupported");
  const raw = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  return decodeBake(raw);
}

const exteriors = new Map<string, Promise<HTMLImageElement>>();

/** Výhled z oken (velký nebo malý obrázek), dekódovaný mimo hlavní vlákno. */
export function loadExterior(size: "l" | "s"): Promise<HTMLImageElement> {
  let p = exteriors.get(size);
  if (!p) {
    const img = new Image();
    img.decoding = "async";
    img.src = vizAsset(`exterior-${size}.jpg`);
    p = img.decode().then(() => img);
    exteriors.set(size, p);
    p.catch(() => exteriors.delete(size));
  }
  return p;
}

/**
 * Předběžné načtení pro chvíli, kdy se uživatel chystá otevřít 3D (najetí, dotyk): světlo pro denní
 * režim a výhled z oken. Šetřič dat a pomalé sítě se přeskakují.
 */
export function prefetchVisualizerAssets() {
  if (typeof window === "undefined") return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /^(slow-2g|2g)$/.test(conn?.effectiveType ?? "")) return;
  const small = window.innerWidth < 900 || (window.matchMedia?.("(pointer: coarse)").matches ?? false);
  void prefetchBake("day").catch(() => undefined);
  void loadExterior(small ? "s" : "l").catch(() => undefined);
}
