import Image from "next/image";
import Link from "next/link";
import type { PublicProduct } from "@/lib/public";
import { FLOOR_TYPE_LABEL } from "@/lib/types";
import { fmtCzk, fmtNum2 } from "@/lib/format";
import { SampleButton } from "./SampleButton";

export function ProductCard({ p, sampleMax, reason }: { p: PublicProduct; sampleMax: number; reason?: string }) {
  const low = p.stockM2 > 0 && p.stockM2 < 30;
  return (
    <article className="group flex flex-col">
      <Link href={`/podlaha/${p.slug}`} className="relative block aspect-[4/3] overflow-hidden rounded-md bg-line">
        {p.images.card ? (
          <Image src={p.images.card} alt={`${p.brand} ${p.name}`} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted text-sm">Foto se připravuje</div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          {p.isNew && <span className="tag tag-accent">Novinka</span>}
          {p.integratedUnderlay && <span className="tag bg-white/90">+ podložka</span>}
        </div>
        {p.stockM2 <= 0 && <div className="absolute inset-x-0 bottom-0 bg-ink/80 text-white text-xs text-center py-1.5">Dočasně nedostupné</div>}
      </Link>
      <div className="pt-3 flex-1 flex flex-col">
        <p className="eyebrow">{p.brand} · {p.collection}</p>
        <h3 className="mt-1 text-[1.05rem] leading-snug"><Link href={`/podlaha/${p.slug}`} className="hover:underline underline-offset-4">{p.decor}</Link></h3>
        <p className="text-sm text-muted mt-0.5">{FLOOR_TYPE_LABEL[p.type]} · {String(p.thicknessMm).replace(".", ",")} mm · nášlap {String(p.wearLayerMm).replace(".", ",")} mm · tř. {p.usageClass}</p>
        {reason && <p className="mt-2 text-sm text-ink-soft leading-snug border-l-2 border-accent pl-2.5">{reason}</p>}
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-lg leading-none">{fmtCzk(p.pricePerM2)}<span className="text-sm text-muted"> / m²</span></p>
            <p className="text-sm text-muted mt-1">{fmtCzk(p.pricePerPack)} / balení ({fmtNum2(p.m2PerPack)} m²)</p>
          </div>
          <div className="text-right text-xs text-muted leading-tight">
            <span className={low ? "text-warn" : p.stockM2 > 0 ? "text-ok" : "text-danger"}>{p.stockM2 > 0 ? `${fmtNum2(p.stockM2)} m²` : "0 m²"}</span>
            <br />dodání {p.deliveryDays} dní
          </div>
        </div>
        <div className="mt-3">
          <SampleButton productId={p.id} max={sampleMax} size="sm" />
        </div>
      </div>
    </article>
  );
}
