@AGENTS.md

# Pravidla pro tento stroj a projekt

## Stroj má jen 4 GB RAM (bez swapu) — šetři paměť

- **Nespouštěj `next dev` na pozadí.** Když ho spustíš kvůli ověření, ověř a **hned ho ukonči** (`pkill -f 'next[-](server|build)|next [d]ev|next [s]tart'`).
- **Build pouštěj jen když je nutný**, a to výhradně do oddělené složky, aby nerozbil cache uživatelova `next dev` (stalo se 2026-09-21: build do `.next` při běžícím dev serveru → stránky 404 / JS se nenačetl, „nic nereaguje na kliknutí“):
  `NEXT_DIST_DIR=.next-verify NODE_OPTIONS=--max-old-space-size=1536 npm run build`
  a smoke test pak `NEXT_DIST_DIR=.next-verify npx next start -p 3126`. Nikdy nespouštěj `next build` do `.next`, pokud běží `next dev`.
- Ukončování vlastních serverů: `pkill -f 'next[-]server'` (rodičovský proces skončí sám). Nepoužívej vzory jako `next dev`/`next start` — matchnou i vlastní shell (exit 144).
- Před spuštěním čehokoli těžkého zkontroluj `ps aux | grep next` — nesmí běžet jiný `next dev` / `next build` / `next-server`.
- **Na konci každého úkolu** spusť `ps aux | grep next` a ukonči vše, co jsi spustil. Nic po tobě nesmí zůstat běžet.
- Nespouštěj Playwright/Chromium souběžně s dev serverem (OOM, exit 137).
- `next dev` je na tomto stroji velmi pomalý (první kompilace stránky 30–90 s, stovky malých JS chunků → v prohlížeči přes SSH tunel dlouho „nic nereaguje“, než doběhne hydratace). Na prohlížení webu používej **`npm run preview`** (build + `next start` na portu 3000) — stránky se pak servírují za desítky ms.
- Před `pkill` zkontroluj `ps aux | grep next` — na portu 3000 může běžet **uživatelův vlastní** dev server; ten nezabíjej bez upozornění.
- Na ověření typů preferuj `npm run typecheck` (tsc --noEmit) a `npm run lint` — jsou levnější než build.

## Prostředí

- Node není v systému, je v `~/.local/node/bin`: `export PATH=$HOME/.local/node/bin:$PATH`.
- Demo data: `npm run seed:fresh` (resetuje `data/*.json` a přegeneruje fotky z `fotky_podlahy/`).
- Admin: `/admin`, přihlášení admin / admin (viz `.env.example`).

## Kód

- Custom CSS třídy patří do `@layer components` v `src/app/globals.css`, jinak přebijí Tailwind utility.
- Úložiště zná jen `src/lib/db/repos.ts` — nikde jinde nečti/nezapisuj `data/*.json`.
- Nákupní ceny, marže a SKU dodavatele nikdy nesmí do klienta (`src/lib/public.ts`).
- Přehled hotových funkcí F1–F8 a záměrně chybějících věcí je v `README.md`.
