/**
 * Barevná paleta dekoru změřená z fotky vzorku produktu (tmavá kresba / základ / světlá kresba).
 * Fotky z feedů bývají focené v perspektivě se stíny, proto se měří jen spodní polovina výřezu
 * (tam je podlaha) a kontrast se omezí, aby stín ve fotce nezměnil barvu podlahy.
 */
export type RGB = [number, number, number];
export interface Palette { dark: RGB; base: RGB; light: RGB }

const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const FALLBACK_PALETTE: Record<string, Palette> = {
  "light-oak": { dark: [150, 112, 72], base: [196, 160, 118], light: [222, 196, 160] },
  "dark-wood": { dark: [62, 40, 26], base: [104, 72, 50], light: [140, 104, 76] },
  grey: { dark: [112, 108, 102], base: [152, 148, 141], light: [186, 183, 176] },
  stone: { dark: [140, 136, 128], base: [182, 178, 170], light: [214, 211, 204] },
};

const cache = new Map<string, Promise<Palette>>();

export function paletteFromImage(url: string): Promise<Palette> {
  let p = cache.get(url);
  if (!p) {
    p = measure(url);
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

async function measure(url: string): Promise<Palette> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const S = 64;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas 2d");
  ctx.drawImage(img, 0, img.naturalHeight * 0.5, img.naturalWidth, img.naturalHeight * 0.5, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;
  const px: { l: number; c: RGB }[] = [];
  for (let i = 0; i < d.length; i += 4) { const col: RGB = [d[i], d[i + 1], d[i + 2]]; px.push({ l: lum(col), c: col }); }
  px.sort((a, b) => a.l - b.l);
  const band = (from: number, to: number): RGB => {
    const a = Math.floor(px.length * from), b = Math.max(a + 1, Math.floor(px.length * to));
    const s: RGB = [0, 0, 0];
    for (let i = a; i < b; i++) { s[0] += px[i].c[0]; s[1] += px[i].c[1]; s[2] += px[i].c[2]; }
    return [s[0] / (b - a), s[1] / (b - a), s[2] / (b - a)];
  };
  const base = band(0.35, 0.65);
  let dark = band(0.08, 0.28);
  let light = band(0.72, 0.92);
  // Omezení kontrastu: kresba dekoru, ne stín nebo odlesk z fotky.
  const lb = Math.max(1, lum(base));
  const ld = lum(dark), ll = lum(light);
  if (lb - ld > lb * 0.36) dark = mix(base, dark, (lb * 0.36) / (lb - ld));
  if (ll - lb > lb * 0.28) light = mix(base, light, (lb * 0.28) / (ll - lb));
  return { dark, base, light };
}

const scale = (c: RGB, k: number): RGB => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
/** Omezí odchylku kanálů od jasu na max. `maxSat` × jas. */
function desaturate(c: RGB, maxSat: number): RGB {
  const g = Math.max(1, lum(c));
  const dev = Math.max(...c.map((v) => Math.abs(v - g)));
  if (dev <= g * maxSat) return c;
  const k = (g * maxSat) / dev;
  return [g + (c[0] - g) * k, g + (c[1] - g) * k, g + (c[2] - g) * k];
}

/** Očekávaný jas základu podle odstínu z katalogu — hlídá fotky, kde většinu výřezu tvoří stín nebo prosvětlené okno. */
const TONE_LUM: Record<string, [number, number]> = {
  "light-oak": [140, 215],
  "dark-wood": [52, 125],
  grey: [88, 205],
  stone: [80, 228],
};

/**
 * Dorovnání palety: jas podle odstínu dekoru a minimální kontrast kresby (dřevo má viditelnou
 * kresbu i tehdy, když je fotka vzorku rozmazaná nebo přesvětlená).
 */
export function tunePalette(p: Palette, tone: string, wood: boolean): Palette {
  let { dark, base, light } = p;
  const range = TONE_LUM[tone];
  if (range) {
    const lb = lum(base);
    const k = lb < range[0] ? range[0] / Math.max(1, lb) : lb > range[1] ? range[1] / lb : 1;
    if (k !== 1) {
      // Zesvětlení tmavé fotky by přepálilo sytost — omezíme ji a při velké korekci se opřeme o typickou barvu odstínu.
      const fb = FALLBACK_PALETTE[tone];
      const blend = Math.min(0.75, Math.max(0, (Math.max(k, 1 / k) - 1.25) / 1.5));
      const fix = (c: RGB, f: RGB) => { const s = desaturate(scale(c, k), 0.42); return fb && blend > 0 ? mix(s, f, blend) : s; };
      dark = fix(dark, fb?.dark ?? dark); base = fix(base, fb?.base ?? base); light = fix(light, fb?.light ?? light);
    }
  }
  const lb = Math.max(1, lum(base));
  const minDark = wood ? 0.8 : 0.86, minLight = wood ? 1.1 : 1.06;
  if (lum(dark) > lb * minDark) {
    // Tmavší kresba s lehce vyšší sytostí (u dřeva letokruhy tmavnou do teplejšího tónu).
    const d = scale(base, minDark);
    const g = (d[0] + d[1] + d[2]) / 3;
    dark = wood ? [d[0] + (d[0] - g) * 0.25, d[1] + (d[1] - g) * 0.25, d[2] + (d[2] - g) * 0.25] : d;
  }
  if (lum(light) < lb * minLight) light = scale(base, minLight);
  return { dark, base, light };
}

export const toHex = (c: RGB) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
