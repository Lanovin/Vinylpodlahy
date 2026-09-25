import { NextResponse } from "next/server";
import { z } from "zod";
import { leads } from "@/lib/db/repos";
import { newId, nowIso } from "@/lib/db/store";

const Body = z.object({
  zip: z.string().min(5).max(6), areaM2: z.number().min(1).max(100000), term: z.string().min(2).max(120),
  name: z.string().min(2).max(120), phone: z.string().min(6).max(30), email: z.string().email(), note: z.string().max(2000).optional().default(""),
  productId: z.string().nullable(), calculationId: z.string().nullable(), source: z.enum(["product", "cart", "page"]),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Zkontrolujte prosím vyplněné údaje (plocha musí být číslo)." }, { status: 400 });
  const id = newId("l");
  leads.add({ id, createdAt: nowIso(), ...parsed.data, note: parsed.data.note ?? "", orderId: null, status: "new" });
  return NextResponse.json({ id });
}
