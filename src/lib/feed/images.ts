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

function sourceKey(sources: ProductImages["sources"]) {
  return crypto.createHash("sha1").update(JSON.stringify(sources)).digest("hex").slice(0, 16);
}

function apply(img: Sharp, t?: ImageSource["transform"]) {
  if (!t) return img;
  const mod: { brightness?: number; saturation?: number; hue?: number } = {};
  if (t.brightness) mod.brightness = t.brightness;
  if (t.saturation) mod.saturation = t.saturation;
  if (t.hue) mod.hue = t.hue;
  return Object.keys(mod).length ? img.modulate(mod) : img;
}

function position(t?: ImageSource["transform"]): string {
  return t?.crop === "top" ? "top" : t?.crop === "bottom" ? "bottom" : "centre";
}

export async function processProductImages(productId: string, sources: ProductImages["sources"], force = false): Promise<Omit<ProductImages, "sources"> | null> {
  const manifest = readManifest();
  const key = sourceKey(sources);
  const dir = path.join(MEDIA_ROOT, productId);
  const rel = (f: string) => `/media/products/${productId}/${f}`;
  const existing = { card: rel("card.webp"), hero: rel("hero.webp"), swatch: rel("swatch.webp"), gallery: [rel("hero.webp"), rel("card.webp"), rel("detail.webp")] };
  if (!force && manifest[productId] === key && fs.existsSync(path.join(dir, "card.webp"))) return null;

  fs.mkdirSync(dir, { recursive: true });
  const tex = await loadSource(sources.texture.url);
  const room = sources.room ? await loadSource(sources.room.url) : null;
  const tt = sources.texture.transform;

  await apply(sharp(tex).rotate().resize(900, 675, { fit: "cover", position: position(tt) }), tt).webp({ quality: 80 }).toFile(path.join(dir, "card.webp"));
  await apply(sharp(tex).rotate().resize(520, 520, { fit: "cover", position: position(tt) }), tt).webp({ quality: 80 }).toFile(path.join(dir, "swatch.webp"));
  await apply(sharp(tex).rotate().resize(1600, 1000, { fit: "cover", position: position(tt) }), tt).webp({ quality: 78 }).toFile(path.join(dir, "detail.webp"));
  if (room) {
    const rt = sources.room?.transform;
    await apply(sharp(room).rotate().resize(1600, 1000, { fit: "cover", position: position(rt) }), rt).webp({ quality: 78 }).toFile(path.join(dir, "hero.webp"));
  } else {
    fs.copyFileSync(path.join(dir, "detail.webp"), path.join(dir, "hero.webp"));
  }
  manifest[productId] = key;
  writeManifest(manifest);
  return existing;
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
