import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { AddAccessoryButton } from "@/components/cart/AddAccessoryButton";
import { accessories } from "@/lib/db/repos";
import { toPublicAccessory } from "@/lib/public";
import { ACCESSORY_KIND_LABEL, type AccessoryKind } from "@/lib/types";
import { fmtCzk } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Příslušenství k vinylovým podlahám", description: "Podložky, soklové a přechodové lišty, lepidla, tmely a čisticí sady. Kalkulačka projektu spočítá potřebné množství automaticky." };

const ORDER: AccessoryKind[] = ["underlay", "skirting", "transition", "floor-adhesive", "glue", "silicone", "cleaning"];

export default function Page() {
  const list = accessories.visible().map(toPublicAccessory);
  return (
    <Site>
      <div className="container py-10 md:py-14">
        <p className="eyebrow mb-3">Příslušenství</p>
        <h1 className="h2">Vše, co k podlaze patří.</h1>
        <p className="lead mt-3 max-w-2xl">Nemusíte počítat ručně — <Link href="/kalkulacka" className="link">kalkulačka projektu</Link> přidá podložku, lišty, lepidlo i tmel v přesném množství podle vašich místností.</p>
        {ORDER.map((kind) => {
          const items = list.filter((a) => a.kind === kind);
          if (!items.length) return null;
          return (
            <section key={kind} className="mt-12">
              <h2 className="h3 mb-5 pb-3 border-b border-line">{ACCESSORY_KIND_LABEL[kind]}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((a) => (
                  <article key={a.id} className="card p-4 flex gap-4">
                    <div className="relative h-24 w-24 shrink-0 rounded-sm overflow-hidden bg-bg">{a.image ? <Image src={a.image} alt="" fill sizes="96px" className="object-cover" /> : <div className="absolute inset-0 grid place-items-center text-[10px] text-muted text-center px-2">{ACCESSORY_KIND_LABEL[a.kind]}</div>}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="leading-snug">{a.name}</h3>
                      <p className="text-xs text-muted mt-1">{a.coverageLabel} · dodání {a.deliveryDays} dní</p>
                      <p className="text-sm text-ink-soft mt-1.5 line-clamp-2">{a.description}</p>
                      <div className="mt-3 flex items-center justify-between gap-2"><span className="text-lg">{fmtCzk(a.pricePerUnit)}<span className="text-xs text-muted"> / {a.unit}</span></span><AddAccessoryButton id={a.id} /></div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Site>
  );
}
