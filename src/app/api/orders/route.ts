import { NextResponse } from "next/server";
import { z } from "zod";
import { accessories, calculations, leads, orders, products, settings, suppliers } from "@/lib/db/repos";
import { newId, nowIso } from "@/lib/db/store";
import { quoteCart } from "@/lib/shipping";
import { markBlocked, MAX_QTY_PER_LINE, normalizeItems, phoneOk } from "@/lib/orderGuard";

const ICO = /^\d{8}$/;
const DIC = /^[A-Z]{2}\d{8,10}$/;

const Body = z.object({
  // Pořadí polí = pořadí ve formuláři: první chybné pole vracíme klientovi (`field`), ten mu dá focus.
  customer: z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(30).refine(phoneOk),
    street: z.string().trim().min(2).max(160),
    zip: z.string().trim().regex(/^\d{3} ?\d{2}$/),
    city: z.string().trim().min(2).max(120),
    business: z.boolean().optional().default(false),
    company: z.string().trim().max(160).optional().default(""),
    ico: z.string().trim().max(20).optional().default(""),
    dic: z.string().trim().max(20).optional().default(""),
    note: z.string().max(1000).optional().default(""),
    terms: z.literal(true),
  }).superRefine((c, ctx) => {
    if (!c.business) return;
    if (c.company.length < 2) ctx.addIssue({ code: "custom", path: ["company"], message: "company" });
    if (!ICO.test(c.ico.replace(/\s/g, ""))) ctx.addIssue({ code: "custom", path: ["ico"], message: "ico" });
    if (c.dic && !DIC.test(c.dic.replace(/\s/g, "").toUpperCase())) ctx.addIssue({ code: "custom", path: ["dic"], message: "dic" });
  }),
  items: z.array(z.object({ kind: z.enum(["product", "accessory"]), id: z.string().max(80), qty: z.number().int().min(1).max(MAX_QTY_PER_LINE) })).min(1).max(200),
  carryUp: z.object({ enabled: z.boolean(), floor: z.number().int().min(0).max(30), elevator: z.boolean() }),
  installRequested: z.boolean(),
  calculationId: z.string().max(80).nullable(),
});

/** Pořadí polí zákazníka ve formuláři — z více chyb vracíme tu nejvýš. */
const FIELD_ORDER = ["name", "email", "phone", "street", "zip", "city", "company", "ico", "dic", "note", "terms"];

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => String((i.path[0] === "customer" ? i.path[1] : i.path[0]) ?? ""));
    const field = [...fields].sort((a, b) => (FIELD_ORDER.indexOf(a) + 1 || 99) - (FIELD_ORDER.indexOf(b) + 1 || 99))[0] ?? "";
    return NextResponse.json({ error: "Zkontrolujte prosím vyplněné údaje.", field }, { status: 400 });
  }
  const d = parsed.data;
  const prods = products.all();
  const accs = accessories.all();
  // Ceny a dopravu počítáme znovu na serveru z aktuálních dat; duplicitní řádky sloučíme.
  const quote = markBlocked(quoteCart(normalizeItems(d.items), d.carryUp, { products: prods, accessories: accs, suppliers: suppliers.all(), settings: settings.get() }), prods, accs);
  if (quote.lines.length === 0) return NextResponse.json({ error: "Košík neobsahuje dostupné položky." }, { status: 400 });
  const blocked = quote.lines.filter((l) => l.blocked);
  if (blocked.length > 0) {
    return NextResponse.json({
      error: `Některé položky teď nejde objednat: ${blocked.map((l) => l.name).join(", ")}. Odeberte je prosím v košíku, nebo vyberte podobné.`,
      field: "items", blocked: blocked.map((l) => ({ kind: l.kind, id: l.id })),
    }, { status: 400 });
  }
  // Neexistující kalkulaci tiše ignorujeme (např. smazaná / podvržená).
  const calculationId = d.calculationId && calculations.byId(d.calculationId) ? d.calculationId : null;
  const id = newId("o");
  const seq = orders.all().length + 1;
  const number = `${new Date().getFullYear()}${String(seq).padStart(5, "0")}`;
  const { terms: _t, business, company, ico, dic, ...customer } = d.customer;
  orders.add({
    id, number, createdAt: nowIso(),
    customer: { ...customer, note: customer.note ?? "", business: business ? { company, ico: ico.replace(/\s/g, ""), dic: dic.replace(/\s/g, "").toUpperCase() } : null },
    carryUp: d.carryUp, installRequested: d.installRequested, quote, calculationId, payment: "transfer", status: "new",
  });
  if (d.installRequested) {
    const firstProduct = quote.lines.find((l) => l.kind === "product");
    leads.add({ id: newId("l"), createdAt: nowIso(), zip: customer.zip, areaM2: quote.totalFloorM2, term: "dle dodání zboží", name: customer.name, phone: customer.phone, email: customer.email, note: `Z objednávky ${number}. ${customer.note ?? ""}`.trim(), productId: firstProduct?.id ?? null, calculationId, orderId: id, source: "cart", status: "new" });
  }
  return NextResponse.json({ id, number });
}
