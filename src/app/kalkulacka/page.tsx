import type { Metadata } from "next";
import { Site } from "@/components/layout/Site";
import { ProjectWizard, type WizardInitial } from "@/components/calculator/ProjectWizard";
import { accessories, calculations, content as contentRepo, products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicAccessory, toPublicProduct, toPublicSettings } from "@/lib/public";
import { emptyRoom } from "@/lib/calc";
import { WIZARD_RESULT_STEP } from "@/lib/guide";
import { layoutFromSlug } from "@/components/visualizer/decor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Kalkulačka projektu — metry, rozpočet, místnost, cena celého projektu",
  description: "Zadejte metry a odpovězte na 3 otázky. Vybereme 6–9 podlah, které dávají smysl, a u každé rovnou spočítáme celý projekt: balení s prořezem, podložku, lišty, lepidlo i dopravu.",
};

const parseNum = (v?: string) => { if (!v) return null; const n = parseFloat(v.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };

export default async function Page({ searchParams }: { searchParams: Promise<{ product?: string; calc?: string; l?: string; w?: string; area?: string; klad?: string }> }) {
  const sp = await searchParams;
  const list = products.visible().filter((p) => p.stockM2 > 0).map(toPublicProduct);
  const acc = accessories.visible().map(toPublicAccessory);
  const cfg = toPublicSettings(settingsRepo.get());
  const c = contentRepo.get();

  const lockedProduct = sp.product ? list.find((p) => p.slug === sp.product || p.id === sp.product) ?? null : null;
  const saved = sp.calc ? calculations.byId(sp.calc) : null;

  let initial: WizardInitial | null = null;
  if (saved) {
    initial = { rooms: saved.rooms, options: saved.options, answers: saved.answers ?? null, productId: list.some((p) => p.id === saved.productId) ? saved.productId : null, step: WIZARD_RESULT_STEP };
  } else {
    // Start z úvodní stránky / karty produktu / 3D bytu: rozměry už známe → rovnou na rozpočet (s podlahou rovnou na cenu).
    const l = parseNum(sp.l), w = parseNum(sp.w), area = parseNum(sp.area), layout = layoutFromSlug(sp.klad);
    const base = { ...emptyRoom(1), id: "r1", kind: "living" as const, ...(layout ? { layout } : {}) };
    if ((l && w) || area) {
      const room = { ...base, mode: l && w ? ("dims" as const) : ("area" as const), lengthM: l, widthM: w, areaM2: area };
      initial = { rooms: [room], step: lockedProduct ? WIZARD_RESULT_STEP : 1 };
    } else if (layout) {
      initial = { rooms: [base], step: 0 };
    }
  }

  return (
    <Site>
      <div className="container pt-4 pb-8 md:py-12">
        <ProjectWizard intro={
          <div className="max-w-2xl mb-4 sm:mb-8">
            <h1 className="text-[1.45rem] leading-tight sm:text-[2.2rem] sm:leading-[1.12]">{lockedProduct ? "Cena projektu s touto podlahou" : "Cena celého projektu za 2 minuty"}</h1>
            <p className="text-ink-soft mt-3 hidden sm:block">{lockedProduct ? "Zadejte metry — spočítáme balení s prořezem, podložku, lišty i dopravu." : "Metry, rozpočet, požadavky, barva — a vidíte konkrétní podlahy s cenou včetně příslušenství. Jedním tlačítkem vše do košíku."}</p>
          </div>
        } products={list} accessories={acc} settings={cfg} initial={initial} lockedProductId={lockedProduct?.id ?? null} priceGuide={{ title: c.priceGuide.title, rows: c.priceGuide.rows }} />
      </div>
    </Site>
  );
}
