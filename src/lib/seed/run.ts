import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ACCESSORIES, COLLECTIONS, FEED_BUILDERS, PHOTOS, SUPPLIERS, PRICING_RULES } from "./data";
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
  // 1) skok ceny: Terrano Rigid Stone 5.5 Dub Medový +15 %
  const terrano = mutated.find((c) => c.collection === "Rigid Stone 5.5")!;
  terrano.decors.find((d) => d.decor === "Dub Medový")!.priceAdj = 0.15;
  // 2) zmizení: Quaro Basic SPC 4 Beton Světlý
  const quaro = mutated.find((c) => c.collection === "Basic SPC 4")!;
  quaro.decors = quaro.decors.filter((d) => d.decor !== "Beton Světlý");
  // 3) pokles skladu: Nordwood Dub Alpský 210 → 18 m²
  const nord = mutated.find((c) => c.collection === "Nature HDF 9")!;
  nord.decors.find((d) => d.decor === "Dub Alpský")!.stock = 18;
  for (const s of SUPPLIERS) fs.writeFileSync(path.join(dir, `${s.id}.xml`), FEED_BUILDERS[s.id](mutated, ACCESSORIES), "utf8");
}

export async function buildInspirationImages() {
  const dir = path.join(ROOT, "public", "media", "inspiration");
  fs.mkdirSync(dir, { recursive: true });
  const jobs: [string, string, number, number][] = [
    ["hero.webp", PHOTOS.roomWarm, 2000, 1125],
    ["hero-minimal.webp", PHOTOS.roomMinimal, 2000, 1125],
    ["living-oak.webp", PHOTOS.roomWarm, 1200, 900],
    ["minimal-oak.webp", PHOTOS.roomMinimal, 1200, 900],
    ["dark-lounge.webp", PHOTOS.roomDark, 1200, 900],
    ["office-corridor.webp", PHOTOS.roomCorridor, 1200, 900],
    ["herringbone.webp", PHOTOS.texHerringbone, 1200, 900],
    ["concrete.webp", PHOTOS.roomConcrete, 1200, 900],
    ["marble-hall.webp", PHOTOS.roomMarble, 1200, 900],
    ["light-hall.webp", PHOTOS.roomLightHall, 1200, 900],
    ["slate.webp", PHOTOS.roomSlate, 1200, 900],
    ["texture-oak.webp", PHOTOS.texOakLight, 1600, 900],
  ];
  for (const [file, src, w, h] of jobs) {
    const buf = await loadSource(src);
    await sharp(buf).rotate().resize(w, h, { fit: "cover" }).webp({ quality: 78 }).toFile(path.join(dir, file));
  }
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
  writeDemoFeeds();
  await buildInspirationImages();
  return syncAll({ forceImages: true });
}
