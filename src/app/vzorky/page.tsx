import type { Metadata } from "next";
import { Site } from "@/components/layout/Site";
import { SamplesForm } from "@/components/samples/SamplesForm";
import { products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicProduct } from "@/lib/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vzorky zdarma", description: "Až 5 vzorků vinylových a SPC podlah domů zdarma. Bez platby, výměnou za e-mail a adresu." };

export default function Page() {
  const cfg = settingsRepo.get();
  return (
    <Site>
      <div className="container py-10 md:py-14">
        <div className="max-w-2xl mb-10"><p className="eyebrow mb-3">Vzorky zdarma</p><h1 className="h2">Podlahu vybírejte na své podlaze.</h1><p className="lead mt-4">Barva dekoru na displeji lže. Vyberte si až {cfg.samples.max} vzorků a porovnejte je doma — vedle nábytku, u okna, ve večerním světle.</p></div>
        <SamplesForm products={products.all().filter((p) => p.status !== "hidden").map(toPublicProduct)} min={cfg.samples.min} max={cfg.samples.max} />
      </div>
    </Site>
  );
}
