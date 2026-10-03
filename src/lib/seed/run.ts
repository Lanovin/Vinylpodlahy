import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import crypto from "node:crypto";
import { ACCESSORIES, COLLECTIONS, DEMO_IMAGE_DIR, FEED_BUILDERS, PHOTOS, SUPPLIERS, PRICING_RULES, decorImageUrl, decorPlank } from "./data";
import { pricingRules, suppliers, settings, content } from "@/lib/db/repos";
import { DEFAULT_SETTINGS, DEFAULT_CONTENT } from "@/lib/defaults";
import { syncAll } from "@/lib/feed/sync";
import { loadSource } from "@/lib/feed/images";

const ROOT = process.cwd();

/** Zapíše mock XML feedy do data/feeds/incoming (výchozí, „čistý“ stav). */
export function writeDemoFeeds() {
  const dir = path.join(ROOT, "data", "feeds", "incoming");
  fs.mkdirSync(dir, { recursive: true });
  for (const s of SUPPLIERS) fs.writeFileSync(path.join(dir, `${s.id}.xml`), FEED_BUILDERS[s.id](COLLECTIONS, ACCESSORIES), "utf8");
}

/**
 * Demo: simulace změn ve feedu, aby bylo vidět pojistky pipeline —
 * skok ceny > 10 % u jednoho produktu, zmizení jiného, pokles skladu u třetího.
 */
export function writeDemoFeedsWithChanges() {
  const dir = path.join(ROOT, "data", "feeds", "incoming");
  const mutated = COLLECTIONS.map((c) => ({ ...c, decors: c.decors.map((d) => ({ ...d })) }));
  // 1) skok ceny: Terrano Rigid Stone 5.5 Dub medový +15 %
  const terrano = mutated.find((c) => c.collection === "Rigid Stone 5.5")!;
  terrano.decors.find((d) => d.decor === "Dub medový")!.priceAdj = 0.15;
  // 2) zmizení: Quaro Basic SPC 4 Beton světlý
  const quaro = mutated.find((c) => c.collection === "Basic SPC 4")!;
  quaro.decors = quaro.decors.filter((d) => d.decor !== "Beton světlý");
  // 3) pokles skladu: Nordwood Dub alpský 210 → 18 m²
  const nord = mutated.find((c) => c.collection === "Nature HDF 9")!;
  nord.decors.find((d) => d.decor === "Dub alpský")!.stock = 18;
  for (const s of SUPPLIERS) fs.writeFileSync(path.join(dir, `${s.id}.xml`), FEED_BUILDERS[s.id](mutated, ACCESSORIES), "utf8");
}

export async function buildInspirationImages() {
  const dir = path.join(ROOT, "public", "media", "inspiration");
  fs.mkdirSync(dir, { recursive: true });
  // [soubor, zdroj, šířka, výška, svislá poloha výřezu 0–1] — u fotek na výšku je podlaha dole, ne bílá zeď.
  const jobs: [string, string, number, number, number][] = [
    ["hero.webp", PHOTOS.roomWarm, 2000, 1125, 0.5],
    ["hero-minimal.webp", PHOTOS.roomMinimal, 2000, 1125, 0.8],
    ["living-oak.webp", PHOTOS.roomWarm, 1200, 900, 0.5],
    ["minimal-oak.webp", PHOTOS.roomMinimal, 1200, 900, 0.85],
    ["dark-lounge.webp", PHOTOS.roomDark, 1200, 900, 0.5],
    ["office-corridor.webp", PHOTOS.roomCorridor, 1200, 900, 0.7],
    ["herringbone.webp", PHOTOS.texHerringbone, 1200, 900, 0.8],
    ["concrete.webp", PHOTOS.roomConcrete, 1200, 900, 0.6],
    ["marble-hall.webp", PHOTOS.roomMarble, 1200, 900, 0.6],
    ["light-hall.webp", PHOTOS.roomLightHall, 1200, 900, 0.7],
    ["slate.webp", PHOTOS.roomSlate, 1200, 900, 0.7],
    ["texture-oak.webp", PHOTOS.texOakLight, 1600, 900, 0.5],
  ];
  for (const [file, src, w, h, vy] of jobs) {
    const img = sharp(await loadSource(src)).rotate();
    const { width: sw = w, height: sh = h, orientation } = await img.metadata();
    const [iw, ih] = orientation && orientation >= 5 ? [sh, sw] : [sw, sh];
    const scale = Math.max(w / iw, h / ih);
    const rw = Math.round(iw * scale), rh = Math.round(ih * scale);
    const left = Math.round((rw - w) / 2), top = Math.round((rh - h) * vy);
    await img.resize(rw, rh).extract({ left, top, width: w, height: h }).webp({ quality: 78 }).toFile(path.join(dir, file));
  }
}

/**
 * Vykreslí „fotky od dodavatele“ pro demo feedy: každý dekor svou plochu podlahy v cílové barvě
 * (viz `decor-render.ts`), příslušenství jednoduchou produktovou fotku. Cache podle hashe zadání.
 */
export async function buildDemoDecorImages(log: (s: string) => void = () => {}) {
  const { ACCESSORY_VERSION, RENDER_VERSION, renderVersionFor, writeAccessoryImage, writeDecorImage } = await import("./decor-render");
  sharp.concurrency(1);
  sharp.cache(false);
  const dir = path.join(ROOT, DEMO_IMAGE_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const indexFile = path.join(dir, "index.json");
  let index: Record<string, string> = {};
  try { index = JSON.parse(fs.readFileSync(indexFile, "utf8")); } catch { /* první běh */ }
  const wanted = new Set<string>(["index.json"]);
  const fileOf = (url: string) => path.join(ROOT, url.slice("file://".length));
  const run = async (url: string, spec: unknown, version: string, render: (file: string) => Promise<void>) => {
    const file = fileOf(url);
    wanted.add(path.basename(file));
    const key = crypto.createHash("sha1").update(JSON.stringify([version, spec])).digest("hex").slice(0, 16);
    if (index[path.basename(file)] === key && fs.existsSync(file)) return;
    const t0 = Date.now();
    await render(file);
    index[path.basename(file)] = key;
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
    log(`  ${path.basename(file)} (${Date.now() - t0} ms)`);
  };
  for (const c of COLLECTIONS) {
    for (const d of c.decors) {
      const spec = { color: d.color, look: d.look, plank: decorPlank(c, d), bevel: c.bevel, herringbone: /rybí kost|herringbone/i.test(`${c.collection} ${d.decor}`), seed: `${c.brand} ${c.collection} ${d.decor}` };
      await run(decorImageUrl(c, d), spec, renderVersionFor(d.look), (file) => writeDecorImage(spec, file));
    }
  }
  for (const a of ACCESSORIES) {
    if (!a.visual || !a.image) continue;
    const visual = a.visual;
    await run(a.image, visual, `${RENDER_VERSION}.a${ACCESSORY_VERSION}`, (file) => writeAccessoryImage(visual, file, a.sku));
  }
  // Úklid obrázků dekorů, které už v datech nejsou.
  for (const f of fs.readdirSync(dir)) if (!wanted.has(f)) { fs.unlinkSync(path.join(dir, f)); delete index[f]; }
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
}

/** Smaže odvozená data (produkty, příslušenství, upozornění, běhy, média) — čistý start dema. */
export function wipeDerivedData() {
  for (const f of ["products", "accessories", "alerts", "feed-runs", "media-manifest", "calculations", "orders", "leads", "sample-requests", "email-queue"]) {
    const file = path.join(ROOT, "data", `${f}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  fs.rmSync(path.join(ROOT, "public", "media", "products"), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, "public", "media", "accessories"), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, "data", "feeds", "snapshots"), { recursive: true, force: true });
}

export async function seedAll(opts: { resetContent?: boolean; fresh?: boolean } = {}) {
  fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
  if (opts.fresh) wipeDerivedData();
  suppliers.saveAll(SUPPLIERS);
  pricingRules.saveAll(PRICING_RULES);
  if (opts.resetContent || !fs.existsSync(path.join(ROOT, "data", "settings.json"))) settings.save(DEFAULT_SETTINGS);
  if (opts.resetContent || !fs.existsSync(path.join(ROOT, "data", "content.json"))) content.save(DEFAULT_CONTENT);
  await buildDemoDecorImages((s) => console.log(s));
  writeDemoFeeds();
  await buildInspirationImages();
  return syncAll({ forceImages: true });
}
