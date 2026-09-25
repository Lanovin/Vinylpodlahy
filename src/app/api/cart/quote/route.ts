import { NextResponse } from "next/server";
import { z } from "zod";
import { accessories, products, settings, suppliers } from "@/lib/db/repos";
import { quoteCart } from "@/lib/shipping";

const Body = z.object({
  items: z.array(z.object({ kind: z.enum(["product", "accessory"]), id: z.string(), qty: z.number().int().min(0).max(999) })),
  carryUp: z.object({ enabled: z.boolean(), floor: z.number().int().min(0).max(30), elevator: z.boolean() }).default({ enabled: false, floor: 1, elevator: false }),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
  const quote = quoteCart(parsed.data.items, parsed.data.carryUp, { products: products.all(), accessories: accessories.all(), suppliers: suppliers.all(), settings: settings.get() });
  return NextResponse.json(quote);
}
