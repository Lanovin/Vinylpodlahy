import { NextResponse } from "next/server";
import { z } from "zod";
import { accessories, leads, orders, products, settings, suppliers } from "@/lib/db/repos";
import { newId, nowIso } from "@/lib/db/store";
import { quoteCart } from "@/lib/shipping";

const Body = z.object({
  // Pořadí polí = pořadí ve formuláři: první chybné pole vracíme klientovi (`field`), ten mu dá focus.
  customer: z.object({ name: z.string().trim().min(2).max(160), email: z.string().trim().email(), phone: z.string().trim().min(6).max(30), street: z.string().trim().min(2).max(160), zip: z.string().trim().regex(/^\d{3} ?\d{2}$/), city: z.string().trim().min(2).max(120), note: z.string().max(1000).optional().default(""), terms: z.literal(true) }),
  items: z.array(z.object({ kind: z.enum(["product", "accessory"]), id: z.string(), qty: z.number().int().min(1).max(999) })).min(1),
  carryUp: z.object({ enabled: z.boolean(), floor: z.number().int().min(0).max(30), elevator: z.boolean() }),
  installRequested: z.boolean(),
  calculationId: z.string().nullable(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path ?? [];
    const field = String((path[0] === "customer" ? path[1] : path[0]) ?? "");
    return NextResponse.json({ error: "Zkontrolujte prosím vyplněné údaje.", field }, { status: 400 });
  }
  const d = parsed.data;
  // Ceny a dopravu počítáme znovu na serveru z aktuálních dat.
  const quote = quoteCart(d.items, d.carryUp, { products: products.all(), accessories: accessories.all(), suppliers: suppliers.all(), settings: settings.get() });
  if (quote.lines.length === 0) return NextResponse.json({ error: "Košík neobsahuje dostupné položky." }, { status: 400 });
  const id = newId("o");
  const seq = orders.all().length + 1;
  const number = `${new Date().getFullYear()}${String(seq).padStart(5, "0")}`;
  const { terms: _t, ...customer } = d.customer;
  orders.add({ id, number, createdAt: nowIso(), customer: { ...customer, note: customer.note ?? "" }, carryUp: d.carryUp, installRequested: d.installRequested, quote, calculationId: d.calculationId, payment: "transfer", status: "new" });
  if (d.installRequested) {
    const firstProduct = quote.lines.find((l) => l.kind === "product");
    leads.add({ id: newId("l"), createdAt: nowIso(), zip: customer.zip, areaM2: quote.totalFloorM2, term: "dle dodání zboží", name: customer.name, phone: customer.phone, email: customer.email, note: `Z objednávky ${number}. ${customer.note ?? ""}`.trim(), productId: firstProduct?.id ?? null, calculationId: d.calculationId, orderId: id, source: "cart", status: "new" });
  }
  return NextResponse.json({ id, number });
}
