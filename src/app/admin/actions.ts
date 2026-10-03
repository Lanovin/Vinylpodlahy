"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkCredentials, clearSession, requireAdmin, setSession } from "@/lib/auth";
import { accessories, alerts, content, emailQueue, leads, orders, pricingRules, products, sampleRequests, settings, suppliers } from "@/lib/db/repos";
import { repriceAll, syncAll, syncSupplier } from "@/lib/feed/sync";
import { writeDemoFeeds, writeDemoFeedsWithChanges } from "@/lib/seed/run";
import { newId } from "@/lib/db/store";
import type { PricingCategory, Settings, SiteContent } from "@/lib/types";

export async function loginAction(formData: FormData) {
  const user = String(formData.get("user") ?? "");
  const pass = String(formData.get("password") ?? "");
  if (!checkCredentials(user, pass)) redirect("/admin/login?err=1");
  await setSession();
  redirect("/admin");
}

export async function logoutAction() {
  await clearSession();
  redirect("/admin/login");
}

const all = () => { revalidatePath("/", "layout"); };

// --- Obsah -------------------------------------------------------------------
export async function saveContentAction(formData: FormData) {
  await requireAdmin();
  const c = content.get();
  const g = (k: string) => String(formData.get(k) ?? "");
  const next: SiteContent = {
    ...c,
    hero: { ...c.hero, title: g("hero.title"), subtitle: g("hero.subtitle"), ctaPrimary: g("hero.ctaPrimary"), ctaSecondary: g("hero.ctaSecondary"), ctaTertiary: g("hero.ctaTertiary"), image: g("hero.image") || c.hero.image },
    homeIntro: { title: g("homeIntro.title"), text: g("homeIntro.text") },
    about: { title: g("about.title"), text: g("about.text") },
    usps: c.usps.map((u, i) => ({ title: g(`usp.${i}.title`) || u.title, text: g(`usp.${i}.text`) || u.text })),
    steps: c.steps.map((s, i) => ({ title: g(`step.${i}.title`) || s.title, text: g(`step.${i}.text`) || s.text })),
    contact: { email: g("contact.email"), phone: g("contact.phone"), hours: g("contact.hours"), company: g("contact.company"), address: g("contact.address"), ico: g("contact.ico"), dic: g("contact.dic"), registry: g("contact.registry") },
    footerNote: g("footerNote"),
    priceGuide: {
      title: g("priceGuide.title") || c.priceGuide.title, text: g("priceGuide.text") || c.priceGuide.text, source: g("priceGuide.source"),
      rows: c.priceGuide.rows.map((r, i) => ({ label: g(`priceGuide.${i}.label`) || r.label, range: g(`priceGuide.${i}.range`) || r.range, note: g(`priceGuide.${i}.note`) })),
    },
    landings: Object.fromEntries(Object.entries(c.landings).map(([slug, l]) => [slug, {
      h1: g(`landing.${slug}.h1`) || l.h1, intro: g(`landing.${slug}.intro`) || l.intro, seoText: g(`landing.${slug}.seoText`) || l.seoText,
      metaTitle: g(`landing.${slug}.metaTitle`) || l.metaTitle, metaDescription: g(`landing.${slug}.metaDescription`) || l.metaDescription,
    }])),
  };
  content.save(next);
  all();
  redirect("/admin/obsah?saved=1");
}

// --- Produkty ----------------------------------------------------------------
export async function setProductStatusAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "active" | "paused" | "hidden";
  products.update(id, { status, pauseReason: status === "active" ? null : products.byId(id)?.pauseReason ?? null });
  all();
}

export async function saveProductAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const p = products.byId(id);
  if (!p) return;
  const overrideRaw = String(formData.get("marginOverridePct") ?? "").trim();
  const override = overrideRaw === "" ? null : Number(overrideRaw.replace(",", "."));
  products.update(id, {
    name: String(formData.get("name") ?? p.name), decor: String(formData.get("decor") ?? p.decor), description: String(formData.get("description") ?? p.description),
    decorTone: String(formData.get("decorTone") ?? p.decorTone) as typeof p.decorTone,
    marginOverridePct: override !== null && Number.isFinite(override) ? override : null,
    status: String(formData.get("status") ?? p.status) as typeof p.status,
    isNew: formData.get("isNew") === "on",
  });
  repriceAll();
  all();
  redirect(`/admin/produkty/${id}?saved=1`);
}

export async function setAccessoryStatusAction(formData: FormData) {
  await requireAdmin();
  accessories.update(String(formData.get("id")), { status: String(formData.get("status")) as "active" | "paused" | "hidden" });
  all();
}

// --- Cenotvorba ---------------------------------------------------------------
export async function savePricingRuleAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "") || newId("pr");
  const supplierId = String(formData.get("supplierId") || "") || null;
  const category = (String(formData.get("category") || "") || null) as PricingCategory | null;
  const marginPct = Number(String(formData.get("marginPct") ?? "0").replace(",", "."));
  if (!Number.isFinite(marginPct)) return;
  const list = pricingRules.all().filter((r) => r.id !== id);
  pricingRules.saveAll([...list, { id, supplierId, category, marginPct, note: String(formData.get("note") ?? "") }]);
  repriceAll();
  all();
}

export async function deletePricingRuleAction(formData: FormData) {
  await requireAdmin();
  pricingRules.saveAll(pricingRules.all().filter((r) => r.id !== String(formData.get("id"))));
  repriceAll();
  all();
}

// --- Feedy -------------------------------------------------------------------
export async function syncSupplierAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("supplierId") || "");
  if (id) await syncSupplier(id); else await syncAll();
  all();
  redirect("/admin/feedy?synced=1");
}

export async function simulateFeedChangesAction() {
  await requireAdmin();
  writeDemoFeedsWithChanges();
  await syncAll();
  all();
  redirect("/admin/feedy?simulated=1");
}

export async function resetDemoFeedsAction() {
  await requireAdmin();
  writeDemoFeeds();
  await syncAll();
  all();
  redirect("/admin/feedy?reset=1");
}

export async function toggleSupplierAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const s = suppliers.byId(id);
  if (s) suppliers.update(id, { active: !s.active });
  all();
}

export async function saveSupplierFeedUrlAction(formData: FormData) {
  await requireAdmin();
  suppliers.update(String(formData.get("id")), { feedUrl: String(formData.get("feedUrl") ?? "") });
  all();
}

export async function acknowledgeAlertAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (id === "all") alerts.acknowledgeAll(); else alerts.acknowledge(id);
  all();
}

// --- Leady, vzorky, objednávky ------------------------------------------------
export async function setLeadStatusAction(formData: FormData) {
  await requireAdmin();
  leads.update(String(formData.get("id")), { status: String(formData.get("status")) as "new" | "contacted" | "closed" });
  all();
}

export async function setSampleStatusAction(formData: FormData) {
  await requireAdmin();
  sampleRequests.update(String(formData.get("id")), { status: String(formData.get("status")) as "new" | "sent" | "done" });
  all();
}

export async function markEmailSentAction(formData: FormData) {
  await requireAdmin();
  emailQueue.markSent(String(formData.get("id")));
  all();
}

export async function setOrderStatusAction(formData: FormData) {
  await requireAdmin();
  orders.update(String(formData.get("id")), { status: String(formData.get("status")) as "new" | "confirmed" | "shipped" | "done" | "cancelled" });
  all();
}

// --- Nastavení ---------------------------------------------------------------
export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();
  const s = settings.get();
  const n = (k: string, d: number) => { const v = Number(String(formData.get(k) ?? "").replace(",", ".")); return Number.isFinite(v) ? v : d; };
  const tiers = s.shipping.palletTiers.map((t, i) => ({ ...t, price: n(`tier.${i}.price`, t.price), maxKg: i === s.shipping.palletTiers.length - 1 ? t.maxKg : n(`tier.${i}.maxKg`, t.maxKg) }));
  const next: Settings = {
    ...s,
    freeShippingFromM2: n("freeShippingFromM2", s.freeShippingFromM2),
    stockSafetyPct: n("stockSafetyPct", s.stockSafetyPct),
    priceJumpAlertPct: n("priceJumpAlertPct", s.priceJumpAlertPct),
    samples: { min: n("samples.min", s.samples.min), max: n("samples.max", s.samples.max) },
    shipping: { ...s.shipping, parcelMaxKg: n("parcelMaxKg", s.shipping.parcelMaxKg), parcelPrice: n("parcelPrice", s.shipping.parcelPrice), parcelAdditionalPrice: n("parcelAdditionalPrice", s.shipping.parcelAdditionalPrice), palletThresholdKg: n("palletThresholdKg", s.shipping.palletThresholdKg), carryUpParcelPrice: n("carryUpParcelPrice", s.shipping.carryUpParcelPrice), carryUpPalletPricePerFloor: n("carryUpPalletPricePerFloor", s.shipping.carryUpPalletPricePerFloor), palletTiers: tiers },
    weightEstimateKgPerM2: { spc: n("w.spc", s.weightEstimateKgPerM2.spc), "vinyl-hdf": n("w.vinyl-hdf", s.weightEstimateKgPerM2["vinyl-hdf"]), "vinyl-composite": n("w.vinyl-composite", s.weightEstimateKgPerM2["vinyl-composite"]), "vinyl-glue": n("w.vinyl-glue", s.weightEstimateKgPerM2["vinyl-glue"]) },
  };
  settings.save(next);
  repriceAll();
  all();
  redirect("/admin/nastaveni?saved=1");
}
