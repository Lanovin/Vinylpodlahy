import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp, { type Sharp } from "sharp";
import type { ImageSource, ProductImages } from "@/lib/types";

/**
 * Fotky z feedu se STAHUJÍ, přegenerují (webp, více velikostí) a ukládají do vlastního úložiště
 * /public/media/products/{productId}/. Nikdy se nehotlinkují.
 * Manifest si pamatuje hash zdroje, aby se nepřegenerovávalo zbytečně.
 */
const MEDIA_ROOT = path.join(process.cwd(), "public", "media", "products");
const MANIFEST = path.join(process.cwd(), "data", "media-manifest.json");

type Manifest = Record<string, string>;

function readManifest(): Manifest {
  try { return JSON.parse(fs.readFileSync(MANIFEST, "utf8")); } catch { return {}; }
}
function writeManifest(m: Manifest) {
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
}

export async function loadSource(url: string): Promise<Buffer> {
  if (url.startsWith("file://")) {
    const rel = url.slice("file://".length);
    const abs = path.isAbsolute(rel) ? rel : path.join(/*turbopackIgnore: true*/ process.cwd(), rel);
    return fs.promises.readFile(abs);
  }
  if (/^https?:\/\//.test(url)) {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Stažení obrázku selhalo (${res.status}): ${url}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.promises.readFile(path.isAbsolute(url) ? url : path.join(/*turbopackIgnore: true*/ process.cwd(), url));
}

/** Verze zpracování — při změně výřezů se obrázky přegenerují i bez změny zdroje. */
const PIPELINE_VERSION = "v2-decor-first";

function sourceKey(sources: ProductImages["sources"]) {
  return crypto.createHash("sha1").update(PIPELINE_VERSION + JSON.stringify(sources)).digest("hex").slice(0, 16);
}

function apply(img: Sharp, t?: ImageSource["transform"]) {
  if (!t) return img;
  const mod: { brightness?: number; saturation?: number; hue?: number } = {};
  if (t.brightness) mod.brightness = t.brightness;
  if (t.saturation) mod.saturation = t.saturation;
  if (t.hue) mod.hue = t.hue;
  return Object.keys(mod).length ? img.modulate(mod) : img;
}

interface Decoded { data: Buffer; width: number; height: number; channels: 1 | 2 | 3 | 4 }

async function decode(buf: Buffer): Promise<Decoded> {
  const { data, info } = await sharp(buf).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels as Decoded["channels"] };
}

/**
 * Výřez ze zdroje v poměru výstupu: `frac` = podíl šířky zdroje (zoom; ne méně, než kolik pokryje výstup 1:1),
 * (cx, cy) = relativní střed výřezu. Pak zmenšit/zvětšit na výstup.
 */
function crop(src: Decoded, outW: number, outH: number, frac: number, cx: number, cy: number) {
  let cw = Math.min(src.width, Math.max(src.width * frac, Math.min(outW, src.width)));
  let ch = (cw * outH) / outW;
  if (ch > src.height) { ch = src.height; cw = (ch * outW) / outH; }
  const width = Math.min(src.width, Math.round(cw)), height = Math.min(src.height, Math.round(ch));
  const left = Math.round(Math.min(Math.max(0, cx * src.width - width / 2), src.width - width));
  const top = Math.round(Math.min(Math.max(0, cy * src.height - height / 2), src.height - height));
  return sharp(src.data, { raw: { width: src.width, height: src.height, channels: src.channels } })
    .extract({ left, top, width, height })
    .resize(outW, outH, { fit: "fill", kernel: "lanczos3" });
}

/**
 * Výstupy pro produkt:
 *  - hero.webp   celá plocha dekoru (první obrázek galerie),
 *  - card.webp   přiblížený dekor pro kartu produktu,
 *  - swatch.webp detail dekoru (vzorník, kalkulačka, 3D paleta),
 *  - detail.webp detail lamely se spárou / fází,
 *  - room.webp   interiér — jen pokud ho feed posílá (u demo dat jen tam, kde tón podlahy odpovídá dekoru).
 */
export async function processProductImages(productId: string, sources: ProductImages["sources"], force = false): Promise<Omit<ProductImages, "sources"> | null> {
  const manifest = readManifest();
  const key = sourceKey(sources);
  const dir = path.join(MEDIA_ROOT, productId);
  const rel = (f: string) => `/media/products/${productId}/${f}`;
  const result = (hasRoom: boolean) => ({
    card: rel("card.webp"), hero: rel("hero.webp"), swatch: rel("swatch.webp"),
    gallery: [rel("hero.webp"), rel("detail.webp"), ...(hasRoom ? [rel("room.webp")] : [])],
  });
  if (!force && manifest[productId] === key && fs.existsSync(path.join(dir, "card.webp"))) return null;

  fs.mkdirSync(dir, { recursive: true });
  const tt = sources.texture.transform;
  const tex = await decode(await loadSource(sources.texture.url));
  const vy = tt?.crop === "top" ? 0.3 : tt?.crop === "bottom" ? 0.7 : 0.5;
  await apply(crop(tex, 1600, 1000, 1, 0.5, vy), tt).webp({ quality: 80 }).toFile(path.join(dir, "hero.webp"));
  await apply(crop(tex, 900, 675, 0.5, 0.5, vy), tt).webp({ quality: 80 }).toFile(path.join(dir, "card.webp"));
  await apply(crop(tex, 520, 520, 0.27, 0.5, vy), tt).webp({ quality: 82 }).toFile(path.join(dir, "swatch.webp"));
  await apply(crop(tex, 1600, 1000, 0.3, 0.3, Math.min(0.75, vy + 0.15)), tt).webp({ quality: 80 }).toFile(path.join(dir, "detail.webp"));

  const roomFile = path.join(dir, "room.webp");
  if (sources.room) {
    // Interiér: podlaha bývá dole — u fotek na výšku bereme spodní část záběru.
    const room = await decode(await loadSource(sources.room.url));
    await apply(crop(room, 1600, 1000, 1, 0.5, 0.75), sources.room.transform).webp({ quality: 78 }).toFile(roomFile);
  } else if (fs.existsSync(roomFile)) {
    fs.unlinkSync(roomFile);
  }
  manifest[productId] = key;
  writeManifest(manifest);
  return result(!!sources.room);
}

export async function processAccessoryImage(accessoryId: string, url: string | null): Promise<string | null> {
  if (!url) return null;
  const manifest = readManifest();
  const key = crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
  const dir = path.join(process.cwd(), "public", "media", "accessories");
  const out = path.join(dir, `${accessoryId}.webp`);
  const relPath = `/media/accessories/${accessoryId}.webp`;
  if (manifest[`acc:${accessoryId}`] === key && fs.existsSync(out)) return relPath;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const buf = await loadSource(url);
    await sharp(buf).rotate().resize(600, 600, { fit: "cover" }).webp({ quality: 80 }).toFile(out);
    manifest[`acc:${accessoryId}`] = key;
    writeManifest(manifest);
    return relPath;
  } catch {
    return null;
  }
}
