import type { Metadata } from "next";
import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { VisualizerEmbed } from "@/components/visualizer/VisualizerDialog";
import { layoutFromSlug } from "@/components/visualizer/decor";
import { viewFromSlug } from "@/components/visualizer/engine/views";
import { products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicProduct } from "@/lib/public";
import type { DecorTone } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Vizualizace interiéru — vyzkoušejte podlahu v celém bytě",
  description: "Modelový byt 2+kk ve 3D: obývák s kuchyní, ložnice, koupelna i předsíň. Přepínejte dekory, způsob kladení a barvu stěn a uvidíte podlahu ve skutečném rozměru lamel, ve dne i večer.",
};

const TONE_ORDER: DecorTone[] = ["light-oak", "grey", "dark-wood", "stone"];

export default async function Page({ searchParams }: { searchParams: Promise<{ podlaha?: string; mistnost?: string; klad?: string }> }) {
  const sp = await searchParams;
  const list = products.visible().filter((p) => p.stockM2 > 0)
    .sort((a, b) => TONE_ORDER.indexOf(a.decorTone) - TONE_ORDER.indexOf(b.decorTone) || a.pricePerM2 - b.pricePerM2)
    .map(toPublicProduct);
  const initial = list.find((p) => p.slug === sp.podlaha) ?? null;
  const cfg = settingsRepo.get();

  return (
    <Site>
      <div className="container py-8 md:py-10">
        <div className="max-w-3xl mb-6 md:mb-8">
          <p className="eyebrow mb-2">Vizualizace interiéru</p>
          <h1 className="h2">Projděte se bytem s novou podlahou.</h1>
          <p className="text-ink-soft mt-3">Modelový byt 2+kk (63 m²) ve 3D. Vyberte dekor, způsob kladení a barvu stěn — podlaha se poskládá z lamel ve skutečném rozměru a projde celým bytem. Přepněte na večer a uvidíte ji i při lampách.</p>
        </div>
        <VisualizerEmbed products={list} initialProductId={initial?.id ?? null} initialView={viewFromSlug(sp.mistnost)} initialLayout={layoutFromSlug(sp.klad)} sampleMax={cfg.samples.max} syncUrl />
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="border-t border-ink pt-4"><h2 className="h3">Skutečné rozměry</h2><p className="text-ink-soft mt-2 leading-relaxed">Každý dekor se pokládá z lamel o rozměru, který uvádí výrobce, včetně V-drážky a posunu spojů min. 30 cm.</p></div>
          <div className="border-t border-ink pt-4"><h2 className="h3">Rovně, diagonálně, rybí kost</h2><p className="text-ink-soft mt-2 leading-relaxed">Stejné způsoby kladení jako v <Link href="/kalkulacka" className="link">kalkulačce</Link> — tam k nim rovnou spočítáme prořez a cenu projektu.</p></div>
          <div className="border-t border-ink pt-4"><h2 className="h3">Pak vzorek domů</h2><p className="text-ink-soft mt-2 leading-relaxed">Obrazovka barvu vždy trochu zkreslí. Až {cfg.samples.max} vzorků vám pošleme zdarma, ať podlahu vidíte na vlastní podlaze.</p></div>
        </div>
      </div>
    </Site>
  );
}
