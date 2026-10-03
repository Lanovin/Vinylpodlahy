import type {
  Accessory, Alert, Calculation, EmailQueueItem, FeedRun, InstallLead, Order, PricingRule, Product,
  SampleRequest, Settings, SiteContent, Supplier, EmailUnsubscribe,
} from "@/lib/types";
import { readCollection, updateCollection, writeCollection } from "./store";
import { DEFAULT_SETTINGS, DEFAULT_CONTENT } from "@/lib/defaults";

// --- Produkty ---------------------------------------------------------------
export const products = {
  all(): Product[] { return readCollection<Product[]>("products", []); },
  /** Produkty viditelné v katalogu: aktivní. Pozastavené se nezobrazují (nikdy neprodávat za starou cenu). */
  visible(): Product[] { return this.all().filter((p) => p.status === "active"); },
  byId(id: string) { return this.all().find((p) => p.id === id) ?? null; },
  bySlug(slug: string) { return this.all().find((p) => p.slug === slug) ?? null; },
  saveAll(list: Product[]) { writeCollection("products", list); },
  update(id: string, patch: Partial<Product>) {
    return updateCollection<Product[]>("products", [], (list) =>
      list.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)),
    ).find((p) => p.id === id) ?? null;
  },
};

// --- Příslušenství ----------------------------------------------------------
export const accessories = {
  all(): Accessory[] { return readCollection<Accessory[]>("accessories", []); },
  visible(): Accessory[] { return this.all().filter((a) => a.status === "active"); },
  byId(id: string) { return this.all().find((a) => a.id === id) ?? null; },
  saveAll(list: Accessory[]) { writeCollection("accessories", list); },
  update(id: string, patch: Partial<Accessory>) {
    return updateCollection<Accessory[]>("accessories", [], (list) =>
      list.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a)),
    ).find((a) => a.id === id) ?? null;
  },
};

// --- Dodavatelé -------------------------------------------------------------
export const suppliers = {
  all(): Supplier[] { return readCollection<Supplier[]>("suppliers", []); },
  byId(id: string) { return this.all().find((s) => s.id === id) ?? null; },
  saveAll(list: Supplier[]) { writeCollection("suppliers", list); },
  update(id: string, patch: Partial<Supplier>) {
    updateCollection<Supplier[]>("suppliers", [], (list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  },
};

// --- Cenová pravidla --------------------------------------------------------
export const pricingRules = {
  all(): PricingRule[] { return readCollection<PricingRule[]>("pricing-rules", []); },
  saveAll(list: PricingRule[]) { writeCollection("pricing-rules", list); },
};

// --- Nastavení a obsah ------------------------------------------------------
export const settings = {
  get(): Settings {
    const stored = readCollection<Partial<Settings>>("settings", {});
    return { ...DEFAULT_SETTINGS, ...stored, shipping: { ...DEFAULT_SETTINGS.shipping, ...(stored.shipping ?? {}) } };
  },
  save(value: Settings) { writeCollection("settings", value); },
};

export const content = {
  get(): SiteContent {
    const stored = readCollection<Partial<SiteContent>>("content", {});
    return { ...DEFAULT_CONTENT, ...stored, landings: { ...DEFAULT_CONTENT.landings, ...(stored.landings ?? {}) }, contact: { ...DEFAULT_CONTENT.contact, ...(stored.contact ?? {}) } };
  },
  save(value: SiteContent) { writeCollection("content", value); },
};

// --- Kalkulace --------------------------------------------------------------
export const calculations = {
  all(): Calculation[] { return readCollection<Calculation[]>("calculations", []); },
  byId(id: string) { return this.all().find((c) => c.id === id) ?? null; },
  add(calc: Calculation) { updateCollection<Calculation[]>("calculations", [], (l) => [calc, ...l].slice(0, 5000)); },
};

// --- Vzorky + e-mailová fronta ---------------------------------------------
export const sampleRequests = {
  all(): SampleRequest[] { return readCollection<SampleRequest[]>("sample-requests", []); },
  add(r: SampleRequest) { updateCollection<SampleRequest[]>("sample-requests", [], (l) => [r, ...l]); },
  update(id: string, patch: Partial<SampleRequest>) {
    updateCollection<SampleRequest[]>("sample-requests", [], (l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  },
};

export const emailQueue = {
  all(): EmailQueueItem[] { return readCollection<EmailQueueItem[]>("email-queue", []); },
  addMany(items: EmailQueueItem[]) { updateCollection<EmailQueueItem[]>("email-queue", [], (l) => [...l, ...items]); },
  markSent(id: string) {
    updateCollection<EmailQueueItem[]>("email-queue", [], (l) =>
      l.map((e) => (e.id === id ? { ...e, sentAt: new Date().toISOString() } : e)));
  },
  /** Zruší (odebere z fronty) ještě neodeslané e-maily daných typů pro adresu. Vrací počet zrušených. */
  cancelPending(email: string, types: readonly EmailQueueItem["type"][]) {
    const to = email.trim().toLowerCase();
    let n = 0;
    updateCollection<EmailQueueItem[]>("email-queue", [], (l) => l.filter((e) => {
      const drop = !e.sentAt && e.to.trim().toLowerCase() === to && types.includes(e.type);
      if (drop) n++;
      return !drop;
    }));
    return n;
  },
};

export const unsubscribes = {
  all(): EmailUnsubscribe[] { return readCollection<EmailUnsubscribe[]>("unsubscribes", []); },
  add(u: EmailUnsubscribe) { updateCollection<EmailUnsubscribe[]>("unsubscribes", [], (l) => [u, ...l]); },
};

// --- Poptávky montáže -------------------------------------------------------
export const leads = {
  all(): InstallLead[] { return readCollection<InstallLead[]>("leads", []); },
  add(l: InstallLead) { updateCollection<InstallLead[]>("leads", [], (list) => [l, ...list]); },
  update(id: string, patch: Partial<InstallLead>) {
    updateCollection<InstallLead[]>("leads", [], (list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  },
};

// --- Objednávky -------------------------------------------------------------
export const orders = {
  all(): Order[] { return readCollection<Order[]>("orders", []); },
  byId(id: string) { return this.all().find((o) => o.id === id) ?? null; },
  add(o: Order) { updateCollection<Order[]>("orders", [], (l) => [o, ...l]); },
  update(id: string, patch: Partial<Order>) {
    updateCollection<Order[]>("orders", [], (l) => l.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  },
};

// --- Feed pipeline ----------------------------------------------------------
export const feedRuns = {
  all(): FeedRun[] { return readCollection<FeedRun[]>("feed-runs", []); },
  add(r: FeedRun) { updateCollection<FeedRun[]>("feed-runs", [], (l) => [r, ...l].slice(0, 500)); },
};

export const alerts = {
  all(): Alert[] { return readCollection<Alert[]>("alerts", []); },
  open(): Alert[] { return this.all().filter((a) => !a.acknowledged); },
  add(a: Alert) { updateCollection<Alert[]>("alerts", [], (l) => [a, ...l].slice(0, 2000)); },
  addMany(items: Alert[]) { updateCollection<Alert[]>("alerts", [], (l) => [...items, ...l].slice(0, 2000)); },
  acknowledge(id: string) {
    updateCollection<Alert[]>("alerts", [], (l) => l.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
  },
  acknowledgeAll() {
    updateCollection<Alert[]>("alerts", [], (l) => l.map((a) => ({ ...a, acknowledged: true })));
  },
};
