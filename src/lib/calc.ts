import type { CalcLine, CalcOptions, CalcResult, RoomInput } from "./types";
import type { PublicAccessory as Accessory, PublicProduct as Product, PublicSettings as Settings } from "./public";
import { LAYOUT_WASTE } from "./types";

export const DEFAULT_OPTIONS: CalcOptions = {
  reservePack: true,
  includeUnderlay: true,
  includeSkirting: true,
  includeTransitions: true,
};

export function emptyRoom(index: number): RoomInput {
  return {
    id: `r${index}_${Math.random().toString(36).slice(2, 6)}`,
    name: index === 1 ? "Obývací pokoj" : `Místnost ${index}`,
    mode: "dims",
    lengthM: null,
    widthM: null,
    areaM2: null,
    perimeterM: null,
    layout: "straight",
    doors: 1,
    floorHeating: false,
  };
}

export function roomArea(r: RoomInput): number {
  if (r.mode === "dims") return (r.lengthM ?? 0) * (r.widthM ?? 0);
  return r.areaM2 ?? 0;
}

export function roomPerimeter(r: RoomInput): { value: number; estimated: boolean } {
  if (r.perimeterM && r.perimeterM > 0) return { value: r.perimeterM, estimated: false };
  if (r.mode === "dims" && r.lengthM && r.widthM) return { value: 2 * (r.lengthM + r.widthM), estimated: false };
  // Jen plocha: předpokládáme čtvercovou místnost — obvod = 4 × √plocha (uvedeno jako odhad).
  const a = roomArea(r);
  return { value: a > 0 ? 4 * Math.sqrt(a) : 0, estimated: true };
}

function pickUnderlay(list: Accessory[], floorHeating: boolean) {
  const usable = list.filter((a) => a.kind === "underlay" && a.status === "active");
  if (floorHeating) return usable.find((a) => a.floorHeating) ?? usable[0] ?? null;
  return usable.find((a) => !a.floorHeating) ?? usable[0] ?? null;
}

function pickSkirting(list: Accessory[], product: Product) {
  const usable = list.filter((a) => a.kind === "skirting" && a.status === "active");
  return usable.find((a) => a.decorTones.includes(product.decorTone)) ?? usable[0] ?? null;
}

function pickKind(list: Accessory[], kind: Accessory["kind"]) {
  return list.find((a) => a.kind === kind && a.status === "active") ?? null;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Kalkulačka projektu. Čistá funkce — stejná na serveru i v klientovi.
 * Prořez: rovně +5 %, diagonálně +10 %, rybí kost +15 %.
 * Balení = ceil(plocha s prořezem / m² v balení) + 1 rezerva (volitelně).
 * Podložka = ceil(plocha / pokrytí role), přeskočit při integrované podložce.
 * Sokl = ceil(obvod / délka lišty). Přechodové lišty = 1 ks / dveře.
 * Lepidlo = 1 ks / 20 m lišt. Silikon = 1 ks / 15 m lišt.
 */
export function calculateProject(
  product: Product,
  rooms: RoomInput[],
  options: CalcOptions,
  accessoriesList: Accessory[],
  _settings: Settings,
): CalcResult {
  const warnings: string[] = [];
  const roomsOut = rooms
    .map((r) => {
      const area = roomArea(r);
      const per = roomPerimeter(r);
      const waste = LAYOUT_WASTE[r.layout];
      return {
        id: r.id,
        name: r.name || "Místnost",
        areaM2: r2(area),
        perimeterM: r2(per.value),
        perimeterEstimated: per.estimated,
        wastePct: Math.round(waste * 100),
        areaWithWasteM2: r2(area * (1 + waste)),
        doors: Math.max(0, Math.round(r.doors || 0)),
      };
    })
    .filter((r) => r.areaM2 > 0);

  const totalArea = r2(roomsOut.reduce((s, r) => s + r.areaM2, 0));
  const totalWithWaste = r2(roomsOut.reduce((s, r) => s + r.areaWithWasteM2, 0));
  const totalPerimeter = r2(roomsOut.reduce((s, r) => s + r.perimeterM, 0));
  const totalDoors = roomsOut.reduce((s, r) => s + r.doors, 0);
  const anyFloorHeating = rooms.some((r) => r.floorHeating && roomArea(r) > 0);

  if (roomsOut.some((r) => r.perimeterEstimated)) {
    warnings.push("U místností zadaných jen plochou je obvod odhadnut (čtvercový půdorys). Pro přesný počet lišt doplňte obvod.");
  }
  if (anyFloorHeating && !product.floorHeating) {
    warnings.push("Vybraná podlaha není výrobcem schválena na podlahové topení. Zvažte jiný dekor — filtr „Podlahové topení“ v katalogu.");
  }

  const packsWithoutReserve = totalWithWaste > 0 ? Math.ceil(totalWithWaste / product.m2PerPack) : 0;
  const packs = packsWithoutReserve + (options.reservePack && packsWithoutReserve > 0 ? 1 : 0);
  const coveredArea = r2(packs * product.m2PerPack);

  if (packs > 0 && coveredArea > product.stockM2) {
    warnings.push(
      `Aktuálně je u dodavatele dostupných ${product.stockM2.toFixed(2).replace(".", ",")} m², projekt potřebuje ${coveredArea.toFixed(2).replace(".", ",")} m². Zbytek by se doobjednával s delší lhůtou — ozveme se vám s termínem.`,
    );
  }
  if (product.weightEstimated) {
    warnings.push("Hmotnost balení dodavatel neuvedl, doprava je počítána z odhadu podle typu podlahy.");
  }

  const lines: CalcLine[] = [];
  if (packs > 0) {
    lines.push({
      kind: "product",
      refId: product.id,
      name: product.name,
      detail: `${packs} × ${product.m2PerPack.toFixed(2).replace(".", ",")} m² = ${coveredArea.toFixed(2).replace(".", ",")} m²${options.reservePack ? " (vč. 1 balení rezervy)" : ""}`,
      qty: packs,
      unit: "balení",
      unitPrice: product.pricePerPack,
      lineTotal: packs * product.pricePerPack,
    });
  }

  // Podložka
  if (options.includeUnderlay && totalArea > 0) {
    if (product.integratedUnderlay) {
      lines.push({ kind: "accessory", refId: "underlay", name: "Podložka", detail: "Podlaha má integrovanou podložku — není potřeba.", qty: 0, unit: "role", unitPrice: 0, lineTotal: 0, skipped: "integrated" });
    } else {
      const u = pickUnderlay(accessoriesList, anyFloorHeating);
      if (u) {
        const qty = Math.ceil(totalArea / u.coverage);
        lines.push({
          kind: "accessory", refId: u.id, name: u.name,
          detail: `${qty} × ${u.coverage} m²/role pro ${totalArea.toFixed(2).replace(".", ",")} m²${anyFloorHeating && u.floorHeating ? " · vhodná pod topení" : ""}`,
          qty, unit: u.unit, unitPrice: u.pricePerUnit, lineTotal: qty * u.pricePerUnit,
        });
      } else {
        warnings.push("Podložka momentálně není v nabídce — přidejte ji prosím zvlášť.");
      }
    }
  }

  // Sokl + lepidlo + silikon
  let skirtingMeters = 0;
  if (options.includeSkirting && totalPerimeter > 0) {
    const s = pickSkirting(accessoriesList, product);
    if (s) {
      const qty = Math.ceil(totalPerimeter / s.coverage);
      skirtingMeters = totalPerimeter;
      lines.push({
        kind: "accessory", refId: s.id, name: s.name,
        detail: `${qty} × ${s.coverage.toString().replace(".", ",")} m na obvod ${totalPerimeter.toFixed(2).replace(".", ",")} m`,
        qty, unit: s.unit, unitPrice: s.pricePerUnit, lineTotal: qty * s.pricePerUnit,
      });
      const g = pickKind(accessoriesList, "glue");
      if (g) {
        const gq = Math.ceil(skirtingMeters / 20);
        lines.push({ kind: "accessory", refId: g.id, name: g.name, detail: `${gq} ks — 1 ks na každých 20 m lišt`, qty: gq, unit: g.unit, unitPrice: g.pricePerUnit, lineTotal: gq * g.pricePerUnit });
      }
      const si = pickKind(accessoriesList, "silicone");
      if (si) {
        const sq = Math.ceil(skirtingMeters / 15);
        lines.push({ kind: "accessory", refId: si.id, name: si.name, detail: `${sq} ks — 1 ks na každých 15 m lišt`, qty: sq, unit: si.unit, unitPrice: si.pricePerUnit, lineTotal: sq * si.pricePerUnit });
      }
    }
  }

  // Lepidlo na podlahu — jen u lepených dílců
  if (product.lock === "glue" && totalArea > 0) {
    const fa = pickKind(accessoriesList, "floor-adhesive");
    if (fa) {
      const q = Math.ceil(totalAreaWithWaste(totalArea, totalWithWaste) / fa.coverage);
      lines.push({ kind: "accessory", refId: fa.id, name: fa.name, detail: `${q} × ${fa.coverageLabel} pro lepenou pokládku`, qty: q, unit: fa.unit, unitPrice: fa.pricePerUnit, lineTotal: q * fa.pricePerUnit });
    } else {
      warnings.push("Lepený vinyl vyžaduje disperzní lepidlo — momentálně není v nabídce, přidejte ho zvlášť.");
    }
  }

  // Přechodové lišty
  if (options.includeTransitions && totalDoors > 0) {
    const t = accessoriesList.find((a) => a.kind === "transition" && a.status === "active" && a.decorTones.includes(product.decorTone))
      ?? pickKind(accessoriesList, "transition");
    if (t) {
      lines.push({ kind: "accessory", refId: t.id, name: t.name, detail: `${totalDoors} ks — 1 ks na každé dveře`, qty: totalDoors, unit: t.unit, unitPrice: t.pricePerUnit, lineTotal: totalDoors * t.pricePerUnit });
    }
  }

  const total = lines.reduce((s, l) => s + l.lineTotal, 0);

  return {
    rooms: roomsOut,
    totalAreaM2: totalArea,
    totalAreaWithWasteM2: totalWithWaste,
    totalPerimeterM: totalPerimeter,
    totalDoors,
    packs,
    packsWithoutReserve,
    coveredAreaM2: coveredArea,
    anyFloorHeating,
    lines,
    total,
    warnings,
  };
}

function totalAreaWithWaste(_area: number, withWaste: number) { return withWaste; }

/** Mini-kalkulačka na kartě produktu: m² → balení a cena (s prořezem 5 % rovně, bez rezervy). */
export function quickPacks(product: Product, areaM2: number, wastePct = 5) {
  if (!areaM2 || areaM2 <= 0) return { packs: 0, coveredM2: 0, total: 0, areaWithWaste: 0 };
  const areaWithWaste = areaM2 * (1 + wastePct / 100);
  const packs = Math.ceil(areaWithWaste / product.m2PerPack);
  return { packs, coveredM2: r2(packs * product.m2PerPack), total: packs * product.pricePerPack, areaWithWaste: r2(areaWithWaste) };
}
