# AI-SEO audit — vinylpodlahy.cz

Stav k 2026-10-06 · Fáze 2 (audit) hotová, balík A1 A2 A3 A5 B1 B2 B3 C2 D1 implementován a ověřen (Fáze 3–4); zbytek čeká na rozhodnutí D1–D3 · kanonická doména: **https://www.vinylpodlahy.cz** (potvrzeno)

## Výchozí stav

- **Stack:** Next.js 16.3.5 (App Router), React 19, hosting Vercel (`vinylpodlahy.cz` → 308 → `www.vinylpodlahy.cz`).
- **Renderování:** všechny veřejné stránky SSR (`force-dynamic`), obsah i ceny jsou v HTML bez JS. Ověřeno na produkci: úvodní stránka 3 079 znaků textu v `<main>`, produktová stránka 1 479 znaků včetně ceny, skladu a termínu dodání, jedno `<h1>`.
- **Přístup crawlerů:** GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended i CCBot dostanou HTTP 200 a stejné HTML. Nic je neblokuje: v projektu není middleware ani `proxy.ts`, žádný WAF ani rate limit se neprojevil.
- **Strukturovaná data:** žádná (v kódu ani v HTML není `ld+json`).
- **Web je zatím demo před spuštěním.** Produkty (Quaro, Terrano, Casale, Lumea, Nordwood), ceny i dodavatelé jsou fiktivní. Údaje o firmě jsou placeholdery („[doplňte IČO]“, telefon `+420 000 000 000`).
- **Produkce je starší než `main`:** ještě nabízí „Vzorky zdarma“ a `/vzorky` (200), které v kódu už nejsou.

## Hlavní tabulka (seřazeno podle dopad / náročnost)

Sloupec **ID** slouží ke schválení („schvaluji A1–A5, B1…“). Každé ID bude samostatný commit.

| ID | Problém | Dopad | Náročnost | Navržené řešení |
|---|---|---|---|---|
| A1 ✅ | `metadataBase`, sitemap i robots míří na **`https://vinylpodlahy.cz` (bez www)**, který 308 přesměrovává. Každá URL v sitemapě i každý canonical by vedly přes redirect. | vysoký | nízká | Jedno místo pro adresu webu `src/lib/site.ts` (výchozí `https://www.vinylpodlahy.cz`), které použijí layout, robots, sitemap a JSON-LD. Opravit `.env.example`. **Akce pro vás:** na Vercelu nastavit `NEXT_PUBLIC_SITE_URL=https://www.vinylpodlahy.cz` (případně proměnnou smazat, výchozí hodnota v kódu bude správná). |
| A2 ✅ | `robots.txt` má jen `User-agent: *`. Funguje, ale AI boty nejsou uvedeny explicitně. | vysoký | nízká | Explicitní `Allow: /` pro GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot. Stejné `Disallow` (admin, api, košík, pokladna, objednávka, kalkulace) + `/odhlaseni`. Sitemap na správné doméně. |
| A3 ✅ | **Chybí `canonical`** na úvodní stránce, produktech, katalogu a statických stránkách (má ho jen 5 landing pages). Katalog s filtry (`/podlahy?type=spc&sort=…`) vytváří nekonečně variant téhož obsahu bez canonical. | vysoký | nízká | `alternates.canonical` na všech indexovatelných stránkách. U katalogu a landing pages vždy na čistou cestu bez query. |
| B1 ✅ | Žádné JSON-LD pro firmu. | vysoký | nízká | `Organization` (podtyp `OnlineStore`) + `WebSite` v layoutu: název, url, logo, e-mail. Pole s placeholdery („[doplňte …]“, `000 000 000`) se **automaticky vynechají**, takže se do schema nikdy nedostanou. Nepoužívat `LocalBusiness`: web nemá kamennou prodejnu a ověřené NAP. Otevírací doba a `sameAs` až po doplnění údajů (viz TODO). |
| B2 ✅ | Produktové stránky bez `Product`/`Offer` — nejdůležitější typ pro citace cen a parametrů. | vysoký | střední | `Product` generovaný ze stejných dat jako stránka: název, značka, popis, absolutní URL fotek, `Offer` v CZK s DPH (cena za balení + `UnitPriceSpecification` za m²), `availability` podle `stockM2`, `additionalProperty` pro parametry (tloušťka, nášlap, třída, zámek, topení, voděodolnost, rozměr lamely). Pozastavený produkt je bez `Offer`. **Neposílá se** nákupní cena, marže ani SKU dodavatele; `sku` = veřejný slug (interní `id` obsahuje jméno dodavatele). Bez `aggregateRating` a `review` (žádné recenze neexistují). |
| B3 ✅ | Žádné `BreadcrumbList`, žádný výpis kolekce. | střední | nízká | `BreadcrumbList` na produktu, katalogu a landing pages. `CollectionPage` + `ItemList` (odkazy na produkty) na `/podlahy` a landing pages. |
| A7 | **`/kalkulacka` je pro crawlery prázdná.** `ProjectWizard` do hydratace vykresluje jen skeleton (`useHydrated`), takže HTML bez JS má v `<main>` 0 znaků a žádný `<h1>`. Nález z Fáze 4 (v průzkumu jsem ověřoval jen úvodní, produktovou a kontaktní stránku). | vysoký | nízká | Vykreslit `intro` (H1 + úvodní text, který už server předává jako prop) i před hydratací, místo šedého pruhu ve skeletonu, a doplnit krátký server-renderovaný text (co kalkulačka počítá — vzorce z `calc.ts`). Skeleton se vizuálně mírně změní → **potřebuje schválení (D4).** Ostatní komponenty s `useHydrated` jsou v pořádku (Header: počet v košíku, FilterPanel: jen filtry; výpis produktů je z serveru). |
| A4 | **Produkce s demo daty je veřejně indexovatelná.** AI by citovala fiktivní značky a ceny jako skutečné. | vysoký | nízká | Přepínač `SITE_INDEXING`: dokud není `on`, `robots.txt` vrací `Disallow: /` a stránky mají `noindex` (X-Robots-Tag). Při spuštění jedna proměnná na Vercelu. **Potřebuje rozhodnutí — viz D1.** |
| A5 ✅ | Sitemap: nesprávná doména, žádné `lastmod` u statických a landing stránek, `/vzorky` ještě v produkční sitemapě. | střední | nízká | Doména z `site.ts`. `lastmod` jen tam, kde je pravdivé (produkty = `updatedAt`, katalog a landing = nejnovější `updatedAt` produktů). Ostatním `lastmod` nedávat, než vymýšlet datum. |
| A6 | **Produkce běží ze starého buildu** (vzorky, `/vzorky`, starý popis v meta). Po nasazení `main` zmizí; do té doby AI čte zrušenou funkci. | vysoký | nízká | Akce pro vás: nasadit aktuální `main` na Vercel. |
| C1 | **Placeholdery jsou veřejně v HTML:** kontakt, patička a právní stránky obsahují „[doplňte IČO]“, telefon `+420 000 000 000`. AI je může citovat doslova. | vysoký | nízká | Údaje doplnit v adminu (Texty webu → Kontakt). Do té doby viz D2. |
| C2 ✅ | Chybí Open Graph obrázek (`og:image`), Twitter karta. | střední | nízká | Výchozí `og:image` z existující fotky (`/media/inspiration/hero.webp`), u produktu jeho hlavní fotka, `twitter:card`. Bez změny vzhledu. |
| D1 ✅ | `llms.txt` neexistuje (404). | nízký | nízká | Dynamická route `/llms.txt` ze stejných dat (popis webu, klíčové stránky, landing pages, katalog podle typu). **Vliv `llms.txt` na AI vyhledávače zatím není prokázaný;** velká AI vyhledávání ho zatím oficiálně nevyužívají. Dělám ho kvůli nízké ceně. |
| B4 | `FAQPage` chybí — a není co do něj dát. | střední | střední | Nový FAQ blok jen z **faktů, které projekt už má**: doprava (z nastavení: balík/paleta, zdarma od 25 m², ke krajnici), platba převodem, vrácení do 14 dnů (z právních šablon — po kontrole právníkem), vysvětlení pojmů z `terms.ts` (SPC vs HDF vs kompozit, nášlap, třída zátěže, click), pravidla výběru z `guide.ts`. Přidává viditelný text → **potřebuje schválení (D3).** Pozn.: Google omezil zobrazení FAQ rich results, pro AI odpovědi a sémantiku je ale FAQ dál užitečné. |
| E1 | Chybí obsah, který by AI potřebovala k citaci. | vysoký | střední až vysoká | Návrhy (žádná vymyšlená fakta): **(1)** stránka „Kolik vinylu koupit“ — vzorce z `calc.ts` (prořez 5/10/15 %, balení, podložka, sokl); **(2)** srovnání SPC × vinyl na HDF × kompozit × lepený jako `<table>` generovaná z `terms.ts` a z živých cen (min–max Kč/m² podle typu); **(3)** FAQ (B4); **(4)** „O nás“ a Kontakt se skutečnými údaji (čeká na vás); **(5)** recenze — **ne**, dokud nejsou skutečné. |
| C3 | Popis produktu je jedna obecná věta z feedu. Souhrn parametrů je až v tabulce. | střední | nízká | Úvodní odstavec generovaný z dat: „*[Dekor] je [typ] podlaha tloušťky … Cena … Kč/m² vč. DPH, … Kč za balení … m². Skladem … m², dodání do … dnů.*“ Odpověď v první větě. Je to **nový viditelný text** → D3. |
| C4 | Texty landing pages: SEO text je sbalený v `<details>` pod výpisem (v HTML je celý, což je v pořádku), ale nezačíná přímou odpovědí. | nízký | nízká | Jen doporučení k textům v adminu (první věta = odpověď na otázku z H1). Kód nechávám. |
| B5 | `OfferShippingDetails` a `MerchantReturnPolicy` v `Offer`. | střední | střední | Připravit až po právní kontrole obchodních podmínek (lhůty, ceny vrácení). Do té doby se nezapíná. |
| B6 | `Service` pro pokládku (`/montaz`). | nízký | nízká | Jednoduché `Service` bez ceny (orientační cena je volný text v adminu) a bez `areaServed` (působnost nikde není uvedená). Navrhuju jen na přání. |
| F1 | Rychlost a velikost: produktová stránka 118 kB HTML, 10 skriptů; úvodní 136 kB. | nízký | — | Bez zásahu. Hodnoty jsou v normě, GTM se načítá až po souhlasu. |

## Co je v pořádku (neměním)

- Obsah v HTML bez JS; jedno `<h1>` na stránku, logická hierarchie nadpisů, `lang="cs"`.
- Parametry produktů jsou v `<table>`, ceník dopravy také.
- Stav 404 u neexistujících stránek i produktů; stránka 404 má `noindex`.
- Alt texty produktových fotek („značka název“); hero fotky jsou dekorativní (`alt=""`).
- Konzistence názvu: „vinylpodlahy.cz“ ve title, patičce, OG i logu; e-mail `info@vinylpodlahy.cz` všude stejný.
- Košík, pokladna, kalkulace a admin jsou v `robots.txt` zakázané.
- Nákupní ceny, marže a SKU dodavatele se do klienta ani do HTML nedostanou (`src/lib/public.ts`) — JSON-LD to musí dodržet.

## Rozhodnutí, která potřebuju

- **D1 — Pojistka indexace do spuštění (A4).** Doporučuju **zapnout**: web zůstane dostupný pro vás, ale vyhledávače ani AI nebudou citovat demo data. Nevýhoda: AI web nenajde, dokud nezapnete `SITE_INDEXING=on` (při ostrém startu jedna proměnná). Alternativa: nechat indexaci jako dnes.
- **D2 — Placeholdery na veřejných stránkách (C1).** Doporučuju do doplnění nezobrazovat telefon `+420 000 000 000` a řádky „[doplňte …]“ v patičce a na Kontaktu (drobná změna vzhledu). Právní stránky nechat, ty musí projít právníkem.
- **D4 — Obsah kalkulačky pro crawlery (A7).** Doporučuju zobrazit nadpis a úvod hned ze serveru místo skeletonu. Změna je vizuálně malá (nahradí šedý pruh skutečným nadpisem), ale sahá na hlavní cestu webem, proto se ptám.
- **D3 — Nový viditelný text (B4, C3, E1).** Souhlasíte s přidáním generovaného úvodního odstavce na produktu a FAQ bloku, případně s novými stránkami (E1 body 1 a 2)? Změní se vzhled stránek, proto se ptám.

## TODO: doplnit (fakta, která nevymýšlím)

V kódu jako `TODO: doplnit`, ve schema se vynechají:

- Obchodní firma, sídlo, IČO, DIČ, zápis v rejstříku (admin → Texty webu → Kontakt)
- Telefon (teď `+420 000 000 000`) a potvrzení e-mailu `info@vinylpodlahy.cz` a doby „Po–Pá 8:00–17:00“
- Odkazy na profily pro `sameAs` (Facebook, Instagram, Google Business, Heureka/Zboží…)
- Logo jako samostatný soubor (teď je SVG v komponentě; `Organization.logo` potřebuje URL na obrázek)
- Obsah „O nás“ (příběh, zkušenosti, reference)
- Reálné produkty a ceny (po napojení skutečných feedů) a odpovědi pro FAQ nad rámec dat z projektu
- Právní kontrola obchodních podmínek (vstup pro B5)

## Plán implementace (po schválení)

1. A1 + A2 + A3 + A5 (adresa, robots, canonical, sitemap) — čtyři commity, jedna sada souborů
2. B1, B2, B3 (JSON-LD) — společný helper `src/lib/jsonld.ts`, vykreslení přes `<script type="application/ld+json">` s únikem `<` podle dokumentace Next.js
3. C2 (OG) a D1 (`llms.txt`)
4. A4 podle D1; C1 podle D2; B4, C3, E1 podle D3
5. Ověření: `npm run typecheck`, `npm run lint`, build do `.next-verify`, `curl` bez JS i s AI user-agenty, validace JSON-LD

## Fáze 3–4 — stav (2026-10-06)

Implementováno devět commitů (`bb08cb2` … `acac229`), každé ID samostatně. Nic se vizuálně nezměnilo.

| ID | Co je hotové |
|---|---|
| A1 | `src/lib/site.ts`: jediná adresa webu, výchozí `https://www.vinylpodlahy.cz`; použito v layoutu, robots, sitemap, JSON-LD. `.env.example` opraven. |
| A2 | `robots.txt`: skupina pro 11 AI botů s `Allow: /`; `Disallow` neveřejných cest zopakovaný v obou skupinách. |
| A3 | `canonical` na všech indexovatelných stránkách; filtrovaný katalog (`/podlahy?type=spc&sort=…`) ukazuje na `/podlahy`. |
| A5 | Sitemap: nová doména, `lastmod` jen z reálných dat (produkty, příslušenství), ostatním se neuvádí. |
| B1 | `OnlineStore` + `WebSite` na úvodní stránce, `OnlineStore` na kontaktu. Zástupné hodnoty se vynechávají (`isFilled`). |
| B2 | `Product` + `Offer` na kartě produktu z veřejné podoby produktu; bez recenzí a hodnocení; pozastavený produkt bez `Offer`. |
| B3 | `BreadcrumbList` (produkt, katalog, landing) a `CollectionPage` + `ItemList` (katalog, landing). |
| C2 | Výchozí `og:image` a `twitter:card`; produkt má vlastní obrázek. |
| D1 | `/llms.txt` generovaný z dat (vliv na AI zatím neprokázaný). |

### Ověření (lokální produkční build do `.next-verify`, `next start -p 3126`)

- `npm run lint` bez chyb; `tsc --noEmit` bez chyb mimo `.next/` (viz poznámka níže); `next build` prošel, `/llms.txt` je v seznamu rout.
- Všech 11 AI user-agentů (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot) dostalo HTTP 200 a identické HTML s jedním `<h1>`.
- JSON-LD je v HTML bez JS: úvodní stránka (OnlineStore, WebSite), kontakt (OnlineStore), `/podlahy` a landing (BreadcrumbList, CollectionPage), produkt (Product, BreadcrumbList). Všechny bloky jsou validní JSON, `@context` je schema.org, `Product` má `name`, `image`, `offers.price`, `priceCurrency`, `availability`, `Breadcrumb` má správné pozice a absolutní URL.
- Kontrola úniku: ve schema není nákupní cena, marže, SKU dodavatele ani zástupný text („doplňte“, telefon z nul).
- Sitemapa: 51 URL, 41 s `lastmod`, žádná bez `www`, `/vzorky` tam není.
- **Neověřeno** (nemám nástroj/přístup): Google Rich Results Test a validator.schema.org je potřeba spustit ručně na nasazené URL. Hodnotu `price` jsem zvolil za balení s `eligibleQuantity` v m²; pokud Merchant Center chce cenu za m², upravíme.
- Poznámka k prostředí: `tsc` a `next build` padaly na zastaralých vygenerovaných souborech `.next/types/validator.ts` a `.next/dev/types/validator.ts` (odkazují na smazané stránky vzorků; v gitu nejsou). Přesunul jsem je do scratchpadu; `next dev` je vytvoří znovu. Na Vercelu se to neprojeví.

### Zbývá

- **Nasadit `main` na Vercel** a nastavit `NEXT_PUBLIC_SITE_URL=https://www.vinylpodlahy.cz` (nebo proměnnou smazat). Bez nasazení je produkce pořád starý build s „Vzorky zdarma“ a `/vzorky`.
- Po nasazení zopakovat `curl` s AI user-agenty na produkci a spustit Rich Results Test na produktové stránce.
- Čekají na rozhodnutí: A7 (D4), A4 (D1), C1 (D2), B4, C3, E1 (D3). B5, B6 až po právní kontrole / na přání.

### TODO: doplnit (fakta, která v projektu nejsou)

- Obchodní firma, sídlo, IČO, DIČ, zápis v rejstříku (admin → Texty webu → Kontakt) → po vyplnění se samy objeví v `OnlineStore` (`legalName`, `address`, `taxID`, `vatID`).
- Telefon (teď `+420 000 000 000`) → po vyplnění se objeví v `contactPoint`; potvrdit e-mail `info@vinylpodlahy.cz` a dobu „Po–Pá 8:00–17:00“ (doba zatím není ve schema, je to volný text).
- Profily pro `sameAs`: pole `SOCIAL_PROFILES` v `src/lib/site.ts` (Facebook, Instagram, Google Business, Heureka…).
- Logo jako samostatný soubor (obrázek) pro `Organization.logo`; teď je jen SVG v komponentě.
- Obsah „O nás“, reálné produkty a ceny (po napojení feedů), odpovědi pro FAQ nad rámec dat z projektu, právní kontrola podmínek (vstup pro B5).
