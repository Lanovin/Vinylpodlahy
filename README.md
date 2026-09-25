# vinylpodlahy.cz

E-shop s vinylovými a SPC podlahami (dropshipping z XML feedů velkoobchodů). Odlišení není cena ani dodací lhůta, ale **poradenský a výpočetní nástroj**: zákazník přijde s místností, odejde s kompletním košíkem včetně příslušenství a dopravy.

Stack: **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · zustand · sharp · fast-xml-parser · zod**. Data zatím v JSON souborech v `data/` (repozitářová vrstva v `src/lib/db/repos.ts` je jediné místo, které úložiště zná — výměna za Postgres/Prisma se dotkne jen tohoto souboru).

## Spuštění

```bash
export PATH=$HOME/.local/node/bin:$PATH   # Node 22 je nainstalovaný lokálně v ~/.local/node
npm install
npm run seed:fresh   # vytvoří demo feedy, produkty, přegeneruje fotky z fotky_podlahy/
npm run dev          # http://localhost:3000 (vývoj; na slabém stroji pomalé — první kompilace stránky desítky sekund)
npm run preview      # produkční build + server na :3000 — doporučeno pro prohlížení na slabém stroji / přes SSH tunel
```

Administrace: `http://localhost:3000/admin` — **admin / admin** (změňte přes `ADMIN_USER` / `ADMIN_PASSWORD`, viz `.env.example`).

## Co je hotové (F1–F8)

| | Funkce | Kde |
|---|---|---|
| F1 | **Kalkulačka projektu = hlavní cesta webem** (průvodce krok za krokem, 1 otázka na obrazovku): 1. metry (více místností, rozměry nebo plocha, kladení, dveře) → 2. rozpočet za m² (s přepočtem na projekt a orientačními cenami trhu) → 3. místnost → 4. požadavky (topení, děti/zvířata, integrovaná podložka, svépomoc click) → 5. barva → **nabídka 6–9 podlah, u každé rovnou cena celého projektu** vč. příslušenství. Výpočet: rovně/diagonálně/rybí kost (+5/10/15 %), balení ⌈plocha s prořezem / m² v balení⌉ + 1 rezerva, podložka ⌈plocha/15⌉ (přeskočí při integrované), sokl ⌈obvod/2,4⌉, přechodová 1/dveře, lepidlo 1/20 m, silikon 1/15 m. Vede přímo do košíku, ukládá se pod sdílitelnou URL `/kalkulace/[id]` včetně odpovědí. Z karty produktu (`?product=`) přeskočí otázky a ptá se jen na metry. Start je i v hero na úvodní stránce. Rozpracovaný projekt přežije obnovení stránky (sessionStorage). | `/kalkulacka`, `src/lib/calc.ts`, `src/lib/guide.ts`, `src/components/calculator/ProjectWizard.tsx`, `HeroStart.tsx` |
| F2 | Karta produktu: cena za m² **i** za balení, dostupnost v m² + termín ve dnech, tabulka parametrů, odhad dopravy z hmotnosti před vložením, vzorek zdarma, mini-kalkulačka m² → balení. | `/podlaha/[slug]` |
| F3 | Katalog s filtry (typ, tloušťka, nášlap, třída, odstín, cena/m², topení, podložka, voděodolnost, dostupnost) a řazením. SEO landing pages s vlastním H1/textem: `/spc-vinylove-podlahy`, `/vinylove-podlahy-click`, `/vinyl-do-koupelny`, `/vinyl-na-podlahove-topeni`, `/vinylove-podlahy-dub`. | `src/lib/catalog.ts`, `src/app/[landing]` |
| F4 | Průvodce výběrem je **sloučený do kalkulačky** (kroky 2–5). Jen pravidla nad parametry, žádná AI: koupelna/kuchyň → SPC nebo lepený; děti/zvířata → nášlap ≥ 0,4 a třída ≥ 32; komerční → třída ≥ 33; chodba → ≥ 32; topení → jen schválené; svépomoc → jen click. Rozpočet a barva jen řadí (rozpočet se při < 6 výsledcích uvolní a řekne to). Max. 9 dekorů s jednovětým důvodem. `/pruvodce` přesměrovává na `/kalkulacka`. | `src/lib/guide.ts` |
| F5 | Vzorky zdarma (oddělený košík, max 5), formulář e-mail + adresa, uložení kontaktu a dekorů, e-mailová fronta D+0 / D+3 (s kalkulací) / D+7 (sleva). | `/vzorky`, `src/app/api/samples` |
| F6 | Doprava z hmotnosti (balík ≤ 30 kg, paleta > 100 kg v pásmech), dovoz ke krajnici, vynáška jako příplatek v košíku, zdarma od 25 m² (nastavitelné), rozdělení na zásilky podle dodavatele s vlastní cenou a termínem **před** dokončením objednávky. | `src/lib/shipping.ts`, `/kosik`, `/pokladna`, `/doprava` |
| F7 | Poptávka montáže z karty produktu, kalkulace i košíku („Chci i pokládku“) → lead s vazbou na produkt/kalkulaci/objednávku. | `/montaz`, `src/app/api/leads` |
| F8 | Feed pipeline: 3 adaptéry (každý dodavatel jiný XML formát) → normalizovaný model; snapshot + diff; marže per dodavatel × kategorie (příslušenství vyšší); skok nákupní ceny > 10 % → **pozastaveno + upozornění**; produkt zmizel → pozastaveno; dostupnost −10 % rezerva; fotky staženy, přegenerovány (webp) do `public/media/`; chybějící hmotnost → odhad + upozornění; feed nedorazil → poslední stav zůstává, katalog se nevyprázdní. Duplicitní SKU ve feedu se přeskočí a nahlásí. | `src/lib/feed/` |

Úvodní stránka: hero s prvním krokem kalkulačky (metry) → jak to funguje → **orientační ceny na trhu 2026** (materiál, podložka, lišty, pokládka; texty v adminu) → výhody → kategorie → dekory → vzorky → o nás.

Admin (`/admin`): přehled + upozornění, objednávky (stavy), poptávky montáže, vzorky + e-mailová fronta, kalkulace, produkty (schválení po skoku ceny, ruční marže), cenotvorba (pravidla), feedy (sync, **Demo: simulovat změny ve feedu**, obnovit), texty webu (hero, USP, kroky, orientační ceny, landing pages, kontakt), nastavení (doprava, pojistky, vzorky).

## Demo data

Reálné feedy nejsou k dispozici, proto `src/lib/seed/data.ts` definuje 3 fiktivní dodavatele (FloorTrade CZ, Vinylia Distribution, Nordic Floors), 33 podlah a 12 položek příslušenství a generuje z nich mock XML v `data/feeds/incoming/*.xml` — každý v jiném formátu. Pipeline je zpracuje stejně jako reálné feedy. Fotky z `fotky_podlahy/` slouží jako zdroj „feedových“ obrázků; pro odlišení dekorů se na ně při přegenerování aplikuje jas/sytost/odstín (`imageTransform`, u reálných feedů prázdné). Fiktivní značky: Terrano, Quaro, Nordwood, Lumea, Casale.

Napojení reálného dodavatele = nový adaptér v `src/lib/feed/adapters/` (mapování polí → `FeedFloorItem` / `FeedAccessoryItem`) + záznam v `data/suppliers.json` s `feedUrl` na https.

## Cron

```
POST /api/feed/sync            (hlavička x-sync-secret: $FEED_SYNC_SECRET)
POST /api/feed/sync?supplier=vinylia
```
Spouštět 2–4× denně.

## Pravidla, která kód dodržuje

- Všechny ceny vč. DPH 21 %, zaokrouhlené na celé Kč; cena za balení = zaokrouhlená cena/m² × m² v balení.
- Plochy na 2 desetinná místa, balení celá čísla.
- Nákupní ceny, marže a SKU dodavatele nikdy neodcházejí do klienta (`src/lib/public.ts`).
- Výsledky kalkulace, košíku i objednávky se vždy přepočítávají na serveru.
- Chybějící data mají definované chování: bez hmotnosti → odhad; bez fotky → placeholder; feed selhal → poslední stav + upozornění; pozastavený produkt → karta s vysvětlením a podobnými dekory.

## Co záměrně chybí (další iterace)

Platební brána (objednávka končí „platba převodem“), vizualizér místnosti z fotky, B2B ceníky, skutečné odesílání e-mailů (fronta je připravená v `data/email-queue.json`), databáze místo JSON.
