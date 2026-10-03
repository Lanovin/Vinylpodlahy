import type { Metadata } from "next";
import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { Check } from "@/components/ui/icons";
import { unsubscribeAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Odhlášení z e-mailů", robots: { index: false, follow: false } };

/**
 * Odhlášení z navazujících e-mailů (rady k výběru, sleva). Odkaz z e-mailu jen otevře stránku — odhlásí až tlačítko
 * (POST), aby odkaz „neproklikly“ bezpečnostní skenery pošty.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; hotovo?: string; chyba?: string }> }) {
  const sp = await searchParams;
  const email = sp.token ? verifyUnsubscribeToken(sp.token) : null;
  return (
    <Site>
      <div className="container py-12 md:py-20 max-w-xl">
        <div className="panel text-center py-10 md:py-12">
          {sp.hotovo ? (
            <>
              <span className="mx-auto h-14 w-14 rounded-full bg-sage-soft text-sage grid place-items-center"><Check className="h-7 w-7" /></span>
              <h1 className="h2 mt-5">Odhlášeno.</h1>
              <p className="text-muted mt-3">Další e-maily s radami a slevou vám už neposíláme. Potvrzení objednávek a odeslání vzorků chodí dál — ty k nákupu patří.</p>
            </>
          ) : email ? (
            <>
              <h1 className="h2">Odhlásit z e-mailů?</h1>
              <p className="text-muted mt-3">Adresa <strong className="text-ink break-all">{email}</strong> přestane dostávat e-maily s radami k výběru a slevou.</p>
              <form action={unsubscribeAction} className="mt-6">
                <input type="hidden" name="token" value={sp.token} />
                <button className="btn btn-primary btn-lg">Odhlásit</button>
              </form>
            </>
          ) : (
            <>
              <h1 className="h2">Odkaz nefunguje.</h1>
              <p className="text-muted mt-3">Odkaz pro odhlášení je neplatný nebo neúplný. Napište nám a odhlásíme vás ručně.</p>
              <Link href="/kontakt" className="btn btn-outline mt-6">Kontakt</Link>
            </>
          )}
          <p className="text-xs text-muted mt-8"><Link href="/ochrana-osobnich-udaju" className="link">Ochrana osobních údajů</Link></p>
        </div>
      </div>
    </Site>
  );
}
