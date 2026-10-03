import { NextResponse } from "next/server";
import { z } from "zod";
import { calculations, emailQueue } from "@/lib/db/repos";
import { newId, nowIso } from "@/lib/db/store";
import { projectTotal } from "@/lib/calc";
import type { EmailQueueItem } from "@/lib/types";
import { CalcInput, saveCalculation } from "../save";

// Buď už uložená kalkulace (calculationId), nebo rozpracovaná z průvodce (calc) — tu nejdřív uložíme.
const Body = z.object({
  email: z.string().trim().email().max(200),
  calculationId: z.string().max(64).optional(),
  calc: CalcInput.optional(),
}).refine((b) => !!b.calculationId || !!b.calc);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const emailBad = parsed.error.issues.some((i) => i.path[0] === "email");
    return NextResponse.json({ error: emailBad ? "Zkontrolujte prosím e-mailovou adresu." : "Neplatná data kalkulace", field: emailBad ? "email" : "" }, { status: 400 });
  }
  const { email, calculationId, calc: input } = parsed.data;
  const calc = calculationId ? calculations.byId(calculationId) : input ? saveCalculation(input) : null;
  if (!calc) return NextResponse.json({ error: "Kalkulaci se nepodařilo najít." }, { status: 404 });

  // Reálné odesílání zatím není — e-mail čeká ve frontě (admin / budoucí odesílač).
  const item: EmailQueueItem = {
    id: newId("e"), sampleRequestId: "", to: email, type: "calc-share", dueAt: nowIso(), sentAt: null,
    payload: { calculationId: calc.id, url: `/kalkulace/${calc.id}`, product: calc.productSnapshot.name, areaM2: calc.result.totalAreaM2, total: projectTotal(calc.result) },
  };
  emailQueue.addMany([item]);
  return NextResponse.json({ ok: true, id: calc.id, url: `/kalkulace/${calc.id}` });
}
