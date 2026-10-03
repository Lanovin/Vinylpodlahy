import { NextResponse } from "next/server";
import { z } from "zod";
import { accessories, products, settings, suppliers } from "@/lib/db/repos";
import { quoteCart } from "@/lib/shipping";
import { markBlocked, normalizeItems } from "@/lib/orderGuard";

const Body = z.object({
  items: z.array(z.object({ kind: z.enum(["product", "accessory"]), id: z.string().max(80), qty: z.number().int().min(0).max(999) })).max(200),
  carryUp: z.object({ enabled: z.boolean(), floor: z.number().int().min(0).max(30), elevator: z.boolean() }).default({ enabled: false, floor: 1, elevator: false }),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
  const prods = products.all();
  const accs = accessories.all();
  const quote = quoteCart(normalizeItems(parsed.data.items), parsed.data.carryUp, { products: prods, accessories: accs, suppliers: suppliers.all(), settings: settings.get() });
  // Pozastavené / skryté položky košík označí a pokladna je nepustí dál (viz /api/orders).
  return NextResponse.json(markBlocked(quote, prods, accs));
}
