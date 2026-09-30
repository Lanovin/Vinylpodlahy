import type { Metadata } from "next";
import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { content as contentRepo, settings as settingsRepo } from "@/lib/db/repos";
import { plural } from "@/lib/format";
import { Mail, Phone } from "@/components/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kontakt", description: "Poradíme s výběrem vinylové nebo SPC podlahy, s výpočtem množství i s dopravou." };

export default function Page() {
  const c = contentRepo.get();
  const max = settingsRepo.get().samples.max;
  return (
    <Site>
      <div className="container py-8 md:py-14 grid lg:grid-cols-12 gap-8 lg:gap-10">
        <div className="lg:col-span-6">
          <p className="eyebrow mb-3">Kontakt</p>
          <h1 className="h2">Radši zavoláte? Klidně.</h1>
          <div className="mt-6 md:mt-8 space-y-4">
            <a href={`tel:${c.contact.phone.replace(/\s/g, "")}`} className="flex items-center gap-4 text-xl hover:opacity-70"><span className="h-11 w-11 rounded-full bg-surface border border-line grid place-items-center"><Phone className="h-5 w-5" /></span>{c.contact.phone}</a>
            <a href={`mailto:${c.contact.email}`} className="flex items-center gap-4 text-xl hover:opacity-70"><span className="h-11 w-11 rounded-full bg-surface border border-line grid place-items-center"><Mail className="h-5 w-5" /></span>{c.contact.email}</a>
            <p className="text-muted pl-15">{c.contact.hours}</p>
          </div>
          <div className="mt-10 text-sm text-muted"><p>{c.contact.company}</p><p>{c.contact.address}</p></div>
        </div>
        <div className="lg:col-span-6 grid grid-cols-2 gap-3 sm:gap-4 content-start">
          {[["Kalkulačka projektu", "Balení, podložka, lišty — na vaše metry.", "/kalkulacka"], ["Vizualizace 3D", "Vyzkoušejte dekor v bytě.", "/vizualizace"], ["Vzorky zdarma", `Až ${max} ${plural(max, "dekor", "dekory", "dekorů")} domů.`, "/vzorky"], ["Doprava a platba", "Ceník podle hmotnosti.", "/doprava"]].map(([t, d, h]) => (
            <Link key={h} href={h} className="card card-hover p-4 sm:p-5"><p className="text-lg leading-tight">{t}</p><p className="text-sm text-muted mt-1">{d}</p></Link>
          ))}
        </div>
      </div>
    </Site>
  );
}
