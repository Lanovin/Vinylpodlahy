import Image from "next/image";
import Link from "next/link";
import type { PublicProduct } from "@/lib/public";
import type { FloorType } from "@/lib/types";
import { fmtCzk, fmtInt, fmtMm } from "@/lib/format";
import { Cube } from "@/components/ui/icons";
import { USAGE_SHORT } from "@/components/ui/terms";
import { SampleButton } from "./SampleButton";

/** Krátké popisky typu pro úzkou kartu (2 sloupce na telefonu). */
const TYPE_SHORT: Record<FloorType, string> = { spc: "SPC", "vinyl-hdf": "Vinyl HDF", "vinyl-composite": "Kompozit", "vinyl-glue": "Lepený" };

export function ProductCard({ p, sampleMax, reason }: { p: PublicProduct; sampleMax: number; reason?: string }) {
  const low = p.stockM2 > 0 && p.stockM2 < 30;
  return (
    <article className="group flex flex-col min-w-0">
      {/* Fotka i ikonka 3D jsou sourozenecké odkazy — odkaz nesmí být v odkazu. */}
      <div className="relative">
        <Link href={`/podlaha/${p.slug}`} className="relative block aspect-[4/3] overflow-hidden rounded-md bg-line">
          {p.images.card ? (
            <Image src={p.images.card} alt={`${p.brand} ${p.name}`} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted text-sm">Foto se připravuje</div>
          )}
          <div className="absolute top-2 left-2 flex gap-1">
            {p.isNew && <span className="tag tag-accent text-xs">Novinka</span>}
            {p.integratedUnderlay && <span className="tag bg-white/90 text-xs normal-case tracking-normal">Podložka v ceně</span>}
          </div>
          {p.stockM2 <= 0 && <div className="absolute inset-x-0 bottom-0 bg-ink/80 text-white text-xs text-center py-1.5">Dočasně nedostupné</div>}
        </Link>
        {/* Vizualizace nabízí jen dekory skladem. */}
        {p.stockM2 > 0 && (
          <Link href={`/vizualizace?podlaha=${p.slug}`} aria-label={`${p.decor} — byt ve 3D`} title="Byt ve 3D" className="absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-full bg-white/85 text-ink shadow-sm transition-colors hover:bg-white">
            <Cube className="h-5 w-5" />
          </Link>
        )}
      </div>
      <div className="pt-2.5 flex-1 flex flex-col">
        <p className="eyebrow truncate">{p.collection}</p>
        <h3 className="mt-0.5 text-[1.05rem] leading-snug"><Link href={`/podlaha/${p.slug}`} className="hover:underline underline-offset-4">{p.decor}</Link></h3>
        <p className="text-[0.8rem] sm:text-sm text-muted mt-0.5 truncate">{TYPE_SHORT[p.type]} · {fmtMm(p.thicknessMm)} · {USAGE_SHORT[p.usageClass]}</p>
        {reason && <p className="mt-2 text-sm text-ink-soft leading-snug border-l-2 border-accent pl-2.5">{reason}</p>}
        <p className="mt-2 text-lg leading-none">{fmtCzk(p.pricePerM2)}<span className="text-sm text-muted"> / m²</span></p>
        <p className="text-sm text-muted mt-1">{fmtCzk(p.pricePerPack)} / bal.</p>
        {low && <p className="text-xs text-warn mt-1">Posledních {fmtInt(Math.floor(p.stockM2))} m²</p>}
        <div className="mt-auto pt-3">
          <SampleButton productId={p.id} max={sampleMax} size="sm" compact className="w-full" />
        </div>
      </div>
    </article>
  );
}
