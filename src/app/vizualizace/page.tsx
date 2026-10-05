import type { Metadata } from "next";
import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { VisualizerEmbed } from "@/components/visualizer/VisualizerDialog";
import { layoutFromSlug } from "@/components/visualizer/decor";
import { viewFromSlug } from "@/components/visualizer/engine/views";
import { products } from "@/lib/db/repos";
import { toPublicProduct } from "@/lib/public";
import type { DecorTone } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Byt ve 3D — vyzkoušejte podlahu v modelovém bytě",
  description: "Modelový byt 2+kk ve 3D: obývák s kuchyní, ložnice, koupelna i předsíň. Přepínejte dekory, způsob kladení a barvu stěn a uvidíte podlahu ve skutečném rozměru lamel, ve dne i večer.",
  alternates: { canonical: "/vizualizace" },
};

const TONE_ORDER: DecorTone[] = ["light-oak", "grey", "dark-wood", "stone"];

export default async function Page({ searchParams }: { searchParams: Promise<{ podlaha?: string; mistnost?: string; klad?: string }> }) {
  const sp = await searchParams;
  const list = products.visible().filter((p) => p.stockM2 > 0)
    .sort((a, b) => TONE_ORDER.indexOf(a.decorTone) - TONE_ORDER.indexOf(b.decorTone) || a.pricePerM2 - b.pricePerM2)
    .map(toPublicProduct);
  const initial = list.find((p) => p.slug === sp.podlaha) ?? null;

  return (
    <Site>
      <div className="container pt-4 pb-8 md:py-10">
        <div className="max-w-3xl mb-3 md:mb-8">
          <p className="eyebrow mb-2 hidden sm:block">Byt ve 3D</p>
          <h1 className="text-[1.45rem] leading-tight sm:text-[2.2rem] sm:leading-[1.12]">Vyzkoušejte podlahu ve 3D bytě</h1>
          <p className="text-ink-soft mt-3 hidden sm:block">Modelový byt 2+kk (63 m²). Vyberte dekor, kladení a barvu stěn — podlaha se poskládá z lamel ve skutečném rozměru. Přepněte na večer a uvidíte ji i při lampách.</p>
        </div>
        <VisualizerEmbed products={list} initialProductId={initial?.id ?? null} initialView={viewFromSlug(sp.mistnost)} initialLayout={layoutFromSlug(sp.klad)} syncUrl />
        <div className="hidden md:grid md:grid-cols-2 gap-6 mt-12">
          <div className="border-t border-ink pt-4"><h2 className="h3">Skutečné rozměry</h2><p className="text-ink-soft mt-2 leading-relaxed">Lamely v rozměru od výrobce, s V-drážkou a posunem spojů min. 30 cm.</p></div>
          <div className="border-t border-ink pt-4"><h2 className="h3">Rovně, diagonálně, rybí kost</h2><p className="text-ink-soft mt-2 leading-relaxed">Stejně jako v <Link href="/kalkulacka" className="link">kalkulačce</Link> — tam k tomu spočítáme prořez a cenu projektu.</p></div>
        </div>
      </div>
    </Site>
  );
}
