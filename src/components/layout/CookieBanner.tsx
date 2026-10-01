"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_OPEN_EVENT, readConsent, saveConsent, type Consent } from "@/lib/consent";

const CATEGORIES: { key: keyof Consent | "necessary"; title: string; text: string }[] = [
  { key: "necessary", title: "Nezbytné", text: "Košík, přihlášení do administrace a zapamatování této volby. Bez nich web nefunguje, proto jsou vždy zapnuté." },
  { key: "analytics", title: "Analytické", text: "Anonymní statistiky návštěvnosti (Google Analytics přes Tag Manager) — které stránky a nástroje lidé používají." },
  { key: "marketing", title: "Marketingové", text: "Měření reklam a přizpůsobení nabídky (např. Google Ads, remarketing)." },
];

/**
 * Lišta se souhlasem s cookies. Do volby běží vše v režimu „denied“ (Consent Mode v2, viz Gtm.tsx).
 * „Odmítnout“ a „Přijmout“ jsou stejně výrazná tlačítka. Znovu se otevře událostí z CookieSettingsButton.
 */
export function CookieBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [prefs, setPrefs] = useState<Consent>({ analytics: false, marketing: false });

  useEffect(() => {
    // Cookie jde číst až v prohlížeči; po hydrataci, aby se SSR a klient shodly.
    const init = setTimeout(() => {
      const stored = readConsent();
      if (stored) setPrefs(stored);
      else setOpen(true);
    }, 0);
    const reopen = () => {
      const current = readConsent();
      if (current) setPrefs(current);
      setSettings(true);
      setOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => {
      clearTimeout(init);
      window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
    };
  }, []);

  if (!open || pathname.startsWith("/admin")) return null;

  const decide = (c: Consent) => {
    saveConsent(c);
    setPrefs(c);
    setOpen(false);
    setSettings(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      className="fade-up fixed z-[70] inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:left-4 sm:bottom-4 sm:w-[26rem] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-lg border border-line bg-surface p-5 shadow-card"
    >
      <p className="eyebrow">Cookies</p>
      <h2 id="cookie-title" className="mt-1 text-xl leading-snug">Používáme cookies</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {settings
          ? "Vyberte, co smíme měřit. Volbu kdykoli změníte v patičce webu."
          : "Nezbytné cookies používáme vždy. Statistické a marketingové jen s vaším souhlasem — pomůžou nám zjistit, co na webu nefunguje."}
      </p>

      {settings && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {CATEGORIES.map((c) => {
            const necessary = c.key === "necessary";
            const id = `cookie-${c.key}`;
            return (
              <li key={c.key} className="flex items-start justify-between gap-4 py-3">
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-[.95rem]">{c.title}</span>
                  <span className="mt-0.5 block text-[.8rem] leading-snug text-muted">{c.text}</span>
                </label>
                <input
                  id={id}
                  type="checkbox"
                  role="switch"
                  className="switch mt-0.5"
                  checked={necessary || prefs[c.key as keyof Consent]}
                  disabled={necessary}
                  onChange={(e) => !necessary && setPrefs((p) => ({ ...p, [c.key]: e.target.checked }))}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-outline" onClick={() => decide({ analytics: false, marketing: false })}>Odmítnout vše</button>
        <button type="button" className="btn btn-primary" onClick={() => decide({ analytics: true, marketing: true })}>Přijmout vše</button>
        {settings ? (
          <button type="button" className="btn btn-ghost col-span-2" onClick={() => decide(prefs)}>Uložit výběr</button>
        ) : (
          <button type="button" className="btn btn-ghost col-span-2" onClick={() => setSettings(true)}>Nastavit podrobně</button>
        )}
      </div>
    </div>
  );
}

/** Odkaz do patičky, který lištu znovu otevře v podrobném nastavení. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
      Nastavení cookies
    </button>
  );
}
