import { NextResponse } from "next/server";
import { CalcInput, saveCalculation } from "./save";

export async function POST(req: Request) {
  const parsed = CalcInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Neplatná data kalkulace" }, { status: 400 });
  const calc = saveCalculation(parsed.data);
  if (!calc) return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
  return NextResponse.json({ id: calc.id, url: `/kalkulace/${calc.id}` });
}
