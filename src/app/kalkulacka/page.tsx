import type { Metadata } from "next";
import { Site } from "@/components/layout/Site";
import { ProjectWizard, type WizardInitial } from "@/components/calculator/ProjectWizard";
import { accessories, calculations, content as contentRepo, products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicAccessory, toPublicProduct, toPublicSettings } from "@/lib/public";
import { emptyRoom } from "@/lib/calc";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Kalkulačka projektu — metry, rozpočet, místnost, cena celého projektu",
  description: "Zadejte metry a odpovězte na 4 otázky. Vybereme 6–9 podlah, které dávají smysl, a u každé rovnou spočítáme celý projekt: balení s prořezem, podložku, lišty, lepidlo i dopravu.",
};

const parseNum = (v?: string) => { if (!v) return null; const n = parseFloat(v.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };

export default async function Page({ searchParams }: { searchParams: Promise<{ product?: string; calc?: string; l?: string; w?: string; area?: string }> }) {
  const sp = await searchParams;
  const list = products.visible().filter((p) => p.stockM2 > 0).map(toPublicProduct);
  const acc = accessories.visible().map(toPublicAccessory);
  const cfg = toPublicSettings(settingsRepo.get());
  const c = contentRepo.get();

  const lockedProduct = sp.product ? list.find((p) => p.slug === sp.product || p.id === sp.product) ?? null : null;
  const saved = sp.calc ? calculations.byId(sp.calc) : null;

  let initial: WizardInitial | null = null;
  if (saved) {
    initial = { rooms: saved.rooms, options: saved.options, answers: saved.answers ?? null, productId: list.some((p) => p.id === saved.productId) ? saved.productId : null, step: 5 };
  } else {
    // Start z úvodní stránky: rozměry už známe → rovnou na rozpočet.
    const l = parseNum(sp.l), w = parseNum(sp.w), area = parseNum(sp.area);
    if ((l && w) || area) {
      const room = { ...emptyRoom(1), id: "r1", mode: l && w ? ("dims" as const) : ("area" as const), lengthM: l, widthM: w, areaM2: area };
      initial = { rooms: [room], step: lockedProduct ? 5 : 1 };
    }
  }

  return (
    <Site>
      <div className="container py-8 md:py-12">
        <ProjectWizard intro={
          <div className="max-w-2xl mb-8">
            <h1 className="h2">{lockedProduct ? "Cena celého projektu s vybranou podlahou" : "Přijďte s místností. Odejděte s cenou celého projektu."}</h1>
            <p className="text-ink-soft mt-3">{lockedProduct ? "Zadejte metry — spočítáme balení s prořezem, podložku, lišty i dopravu." : "Metry, rozpočet, místnost, požadavky, barva. Pět kroků a vidíte konkrétní podlahy s cenou včetně příslušenství — a jedním tlačítkem vše do košíku."}</p>
          </div>
        } products={list} accessories={acc} settings={cfg} initial={initial} lockedProductId={lockedProduct?.id ?? null} priceGuide={{ title: c.priceGuide.title, rows: c.priceGuide.rows }} />
      </div>
    </Site>
  );
}
