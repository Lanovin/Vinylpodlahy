import fs from "node:fs";
import path from "node:path";
import type { Accessory, Alert, FeedRun, Product } from "@/lib/types";
import { accessories, alerts, feedRuns, pricingRules, products, settings as settingsRepo, suppliers } from "@/lib/db/repos";
import { newId, nowIso } from "@/lib/db/store";
import { estimatePackWeight, priceAccessory, priceProduct, safeStock } from "@/lib/pricing";
import { slugify } from "@/lib/format";
import { ADAPTERS } from "./adapters";
import type { FeedAccessoryItem, FeedFloorItem, FeedItem } from "./types";
import { isWaterproof } from "./types";
import { processAccessoryImage, processProductImages } from "./images";

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "feeds", "snapshots");

async function loadFeed(url: string): Promise<string> {
  if (url.startsWith("file://")) {
    const rel = url.slice("file://".length);
    return fs.promises.readFile(path.isAbsolute(rel) ? rel : path.join(/*turbopackIgnore: true*/ process.cwd(), rel), "utf8");
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function saveSnapshot(supplierId: string, items: FeedItem[]) {
  const dir = path.join(SNAPSHOT_DIR, supplierId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(items));
  fs.writeFileSync(path.join(dir, "latest.json"), JSON.stringify(items));
  // Držíme posledních 30 snapshotů.
  const all = fs.readdirSync(dir).filter((f) => f !== "latest.json").sort();
  for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(dir, old));
  return path.relative(process.cwd(), file);
}

function uniqueSlug(base: string, taken: Set<string>) {
  let slug = slugify(base) || "podlaha";
  let i = 2;
  while (taken.has(slug)) slug = `${slugify(base)}-${i++}`;
  taken.add(slug);
  return slug;
}

export interface SyncOutcome { run: FeedRun; alerts: Alert[] }

/**
 * Synchronizace jednoho dodavatele. Zásady:
 *  - snapshot + diff, ne přepis naslepo
 *  - skok nákupní ceny > X % → produkt pozastaven + upozornění (nikdy neprodávat za starou cenu)
 *  - produkt zmizel z feedu → pozastaven + upozornění
 *  - dostupnost s bezpečnostní rezervou
 *  - chybí hmotnost → odhad + upozornění
 *  - feed nedorazil → poslední známý stav zůstává, upozornění; katalog se nikdy nevyprazdňuje
 */
export async function syncSupplier(supplierId: string, opts: { forceImages?: boolean } = {}): Promise<SyncOutcome> {
  const sup = suppliers.byId(supplierId);
  const startedAt = nowIso();
  const newAlerts: Alert[] = [];
  const mkAlert = (a: Omit<Alert, "id" | "createdAt" | "acknowledged">): Alert => ({ id: newId("al"), createdAt: nowIso(), acknowledged: false, ...a });
  const stats: FeedRun["stats"] = { inFeed: 0, added: 0, updated: 0, unchanged: 0, missing: 0, pausedPriceJump: 0, imagesProcessed: 0 };

  if (!sup) throw new Error(`Neznámý dodavatel ${supplierId}`);
  const adapter = ADAPTERS[sup.adapter];
  const cfg = settingsRepo.get();
  const rules = pricingRules.all();

  let items: FeedItem[];
  try {
    const xml = await loadFeed(sup.feedUrl);
    items = adapter.parse(xml);
    if (items.length === 0) throw new Error("Feed neobsahuje žádné položky — ponechán poslední známý stav.");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const run: FeedRun = { id: newId("run"), supplierId, startedAt, finishedAt: nowIso(), status: "failed", stats, error: message, snapshotFile: null };
    feedRuns.add(run);
    const a = mkAlert({ type: "feed-failed", supplierId, productId: null, message: `Feed ${sup.name} se nepodařilo načíst: ${message}. Katalog běží na posledním známém stavu.` });
    alerts.add(a);
    suppliers.update(supplierId, { lastSyncAt: nowIso(), lastSyncStatus: "failed" });
    return { run, alerts: [a] };
  }

  // Duplicitní SKU ve feedu: první vyhrává, další se přeskočí a nahlásí.
  const seenSku = new Set<string>();
  items = items.filter((it) => {
    if (seenSku.has(it.sku)) { newAlerts.push(mkAlert({ type: "info", supplierId, productId: null, message: `Feed ${sup.name} obsahuje duplicitní SKU ${it.sku} (${it.name}) — druhý výskyt přeskočen.` })); return false; }
    seenSku.add(it.sku); return true;
  });
  const snapshotFile = saveSnapshot(supplierId, items);
  stats.inFeed = items.length;

  // --- Podlahy -------------------------------------------------------------
  const allProducts = products.all();
  const taken = new Set(allProducts.map((p) => p.slug));
  const bySku = new Map(allProducts.filter((p) => p.supplierId === supplierId).map((p) => [p.supplierSku, p]));
  const seen = new Set<string>();
  const nextProducts: Product[] = allProducts.filter((p) => p.supplierId !== supplierId);

  for (const it of items.filter((i): i is FeedFloorItem => i.kind === "floor")) {
    seen.add(it.sku);
    const existing = bySku.get(it.sku);
    const sources: Product["images"]["sources"] = {
      texture: { url: it.imageTexture, transform: it.imageTransform ?? undefined },
      ...(it.imageRoom ? { room: { url: it.imageRoom, transform: it.imageTransform?.crop ? undefined : undefined } } : {}),
    };
    const weightMissing = it.packWeightKg === null || it.packWeightKg <= 0;
    const base: Omit<Product, "id" | "slug" | "images" | "status" | "pauseReason" | "isNew" | "createdAt" | "updatedAt" | "marginPct" | "pricePerM2" | "pricePerPack" | "marginOverridePct"> = {
      name: it.name, brand: it.brand, collection: it.collection, decor: it.decor, decorTone: it.decorTone ?? "light-oak",
      type: it.type, thicknessMm: it.thicknessMm, wearLayerMm: it.wearLayerMm, usageClass: it.usageClass, lock: it.lock,
      plankLengthMm: it.plankLengthMm, plankWidthMm: it.plankWidthMm, bevel: it.bevel, m2PerPack: it.m2PerPack,
      packWeightKg: weightMissing ? estimatePackWeight({ type: it.type, m2PerPack: it.m2PerPack }, cfg) : it.packWeightKg!,
      weightEstimated: weightMissing,
      floorHeating: it.floorHeating, integratedUnderlay: it.integratedUnderlay, waterproof: isWaterproof(it.type),
      stockM2Raw: it.stockM2, stockM2: safeStock(it.stockM2, cfg.stockSafetyPct), deliveryDays: it.deliveryDays,
      purchasePriceM2: it.purchasePriceM2, supplierId, supplierSku: it.sku, description: it.description,
    };

    if (!existing) {
      const id = `p_${supplierId}_${slugify(it.sku)}`;
      const draft: Product = {
        id, slug: uniqueSlug(`${it.brand} ${it.name}`, taken), ...base,
        marginOverridePct: null, marginPct: 0, pricePerM2: 0, pricePerPack: 0,
        images: { card: null, hero: null, swatch: null, gallery: [], sources },
        status: "active", pauseReason: null, isNew: sup.lastSyncStatus !== "never", createdAt: nowIso(), updatedAt: nowIso(),
      };
      try {
        const img = await processProductImages(id, sources, opts.forceImages);
        if (img) { draft.images = { ...img, sources }; stats.imagesProcessed++; }
      } catch (e) {
        newAlerts.push(mkAlert({ type: "info", supplierId, productId: id, message: `Obrázek pro ${it.name} se nepodařilo zpracovat: ${e instanceof Error ? e.message : e}` }));
      }
      if (weightMissing) newAlerts.push(mkAlert({ type: "weight-missing", supplierId, productId: id, message: `${it.name}: feed neposlal hmotnost balení, použit odhad ${draft.packWeightKg} kg.` }));
      nextProducts.push(priceProduct(draft, rules, cfg));
      stats.added++;
      continue;
    }

    // Existující produkt → diff
    const oldPrice = existing.purchasePriceM2;
    const jumpPct = oldPrice > 0 ? Math.abs(it.purchasePriceM2 - oldPrice) / oldPrice * 100 : 0;
    let status = existing.status;
    let pauseReason = existing.pauseReason;
    if (jumpPct > cfg.priceJumpAlertPct) {
      status = "paused";
      pauseReason = `Nákupní cena změněna o ${jumpPct.toFixed(1)} % (${oldPrice} → ${it.purchasePriceM2} Kč/m² bez DPH). Čeká na schválení.`;
      stats.pausedPriceJump++;
      newAlerts.push(mkAlert({ type: "price-jump", supplierId, productId: existing.id, message: `${existing.name}: ${pauseReason}` }));
    } else if (existing.status === "paused" && existing.pauseReason?.startsWith("Zmizel z feedu")) {
      // Produkt se do feedu vrátil a cena drží → automaticky obnovit.
      status = "active"; pauseReason = null;
    }
    if (weightMissing && !existing.weightEstimated) {
      newAlerts.push(mkAlert({ type: "weight-missing", supplierId, productId: existing.id, message: `${existing.name}: feed přestal posílat hmotnost balení, použit odhad.` }));
    }
    const merged: Product = {
      ...existing, ...base,
      // Hmotnost: pokud feed neposlal, ale dříve reálnou znal, nechat poslední známou reálnou hodnotu.
      packWeightKg: weightMissing && !existing.weightEstimated ? existing.packWeightKg : base.packWeightKg,
      weightEstimated: weightMissing ? existing.weightEstimated || weightMissing : false,
      status, pauseReason, isNew: existing.isNew && Date.now() - Date.parse(existing.createdAt) < 30 * 86400_000,
      images: { ...existing.images, sources },
    };
    try {
      const img = await processProductImages(existing.id, sources, opts.forceImages);
      if (img) { merged.images = { ...img, sources }; stats.imagesProcessed++; }
    } catch { /* obrázek zůstává starý */ }
    const priced = priceProduct(merged, rules, cfg);
    const changed = JSON.stringify({ ...priced, updatedAt: 0 }) !== JSON.stringify({ ...existing, updatedAt: 0 });
    if (changed) { priced.updatedAt = nowIso(); stats.updated++; } else stats.unchanged++;
    nextProducts.push(priced);
  }

  // Produkty dodavatele, které z feedu zmizely → pozastavit (ne smazat), upozornit.
  for (const p of allProducts.filter((p) => p.supplierId === supplierId && !seen.has(p.supplierSku))) {
    stats.missing++;
    if (p.status === "active") {
      newAlerts.push(mkAlert({ type: "missing-in-feed", supplierId, productId: p.id, message: `${p.name} zmizel z feedu ${sup.name} — pozastaven.` }));
      nextProducts.push({ ...p, status: "paused", pauseReason: `Zmizel z feedu ${sup.name} (${new Date().toLocaleDateString("cs-CZ")}).`, updatedAt: nowIso() });
    } else nextProducts.push(p);
  }
  products.saveAll(nextProducts.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));

  // --- Příslušenství -------------------------------------------------------
  const allAcc = accessories.all();
  const accBySku = new Map(allAcc.filter((a) => a.supplierId === supplierId).map((a) => [a.supplierSku, a]));
  const seenAcc = new Set<string>();
  const nextAcc: Accessory[] = allAcc.filter((a) => a.supplierId !== supplierId);
  const takenAcc = new Set(allAcc.map((a) => a.slug));
  for (const it of items.filter((i): i is FeedAccessoryItem => i.kind === "accessory")) {
    seenAcc.add(it.sku);
    const existing = accBySku.get(it.sku);
    const id = existing?.id ?? `a_${supplierId}_${slugify(it.sku)}`;
    const image = await processAccessoryImage(id, it.image);
    const draft: Accessory = {
      id, slug: existing?.slug ?? uniqueSlug(it.name, takenAcc), name: it.name, kind: it.accessoryKind, unit: it.unit,
      coverage: it.coverage, coverageLabel: it.coverageLabel, unitWeightKg: it.unitWeightKg, purchasePrice: it.purchasePrice,
      marginPct: 0, marginOverridePct: existing?.marginOverridePct ?? null, pricePerUnit: 0, supplierId, supplierSku: it.sku,
      decorTones: it.decorTones, floorHeating: it.floorHeating, stockUnits: it.stockUnits, deliveryDays: it.deliveryDays,
      image: image ?? existing?.image ?? null, status: existing?.status ?? "active", description: it.description, updatedAt: existing?.updatedAt ?? nowIso(),
    };
    if (existing && existing.purchasePrice > 0 && Math.abs(it.purchasePrice - existing.purchasePrice) / existing.purchasePrice * 100 > cfg.priceJumpAlertPct) {
      draft.status = "paused";
      newAlerts.push(mkAlert({ type: "price-jump", supplierId, productId: id, message: `${it.name}: nákupní cena příslušenství změněna o více než ${cfg.priceJumpAlertPct} % — pozastaveno.` }));
    }
    nextAcc.push(priceAccessory(draft, rules, cfg));
  }
  for (const a of allAcc.filter((a) => a.supplierId === supplierId && !seenAcc.has(a.supplierSku))) {
    if (a.status === "active") newAlerts.push(mkAlert({ type: "missing-in-feed", supplierId, productId: a.id, message: `${a.name} (příslušenství) zmizelo z feedu — pozastaveno.` }));
    nextAcc.push({ ...a, status: "paused" });
  }
  accessories.saveAll(nextAcc);

  if (newAlerts.length) alerts.addMany(newAlerts);
  const run: FeedRun = { id: newId("run"), supplierId, startedAt, finishedAt: nowIso(), status: "ok", stats, error: null, snapshotFile };
  feedRuns.add(run);
  suppliers.update(supplierId, { lastSyncAt: nowIso(), lastSyncStatus: "ok" });
  return { run, alerts: newAlerts };
}

export async function syncAll(opts: { forceImages?: boolean } = {}) {
  const out: SyncOutcome[] = [];
  for (const s of suppliers.all().filter((s) => s.active)) out.push(await syncSupplier(s.id, opts));
  return out;
}

/** Přepočet cen po změně pravidel marže / nastavení (bez načítání feedu). */
export function repriceAll() {
  const rules = pricingRules.all();
  const cfg = settingsRepo.get();
  products.saveAll(products.all().map((p) => priceProduct({ ...p, stockM2: safeStock(p.stockM2Raw, cfg.stockSafetyPct) }, rules, cfg)));
  accessories.saveAll(accessories.all().map((a) => priceAccessory(a, rules, cfg)));
}
