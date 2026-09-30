import type { Settings, SiteContent } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  vatRate: 0.21,
  freeShippingFromM2: 25,
  stockSafetyPct: 10,
  priceJumpAlertPct: 10,
  shipping: {
    parcelMaxKg: 30,
    parcelPrice: 149,
    parcelAdditionalPrice: 129,
    palletThresholdKg: 100,
    palletTiers: [
      { maxKg: 400, price: 1490, label: "Paleta do 400 kg" },
      { maxKg: 800, price: 1990, label: "Paleta do 800 kg" },
      { maxKg: 1200, price: 2490, label: "Paleta do 1 200 kg" },
      { maxKg: Number.POSITIVE_INFINITY, price: 2990, label: "Paleta nad 1 200 kg" },
    ],
    carryUpParcelPrice: 290,
    carryUpPalletPricePerFloor: 690,
  },
  samples: { min: 1, max: 5 },
  weightEstimateKgPerM2: {
    spc: 13,
    "vinyl-hdf": 9.5,
    "vinyl-composite": 8,
    "vinyl-glue": 6,
  },
};

export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    title: "Podlaha, která sedí.",
    subtitle: "Cena celého projektu na vaše metry — za 2 minuty.",
    ctaPrimary: "Spočítat cenu",
    ctaSecondary: "Vzorky zdarma",
    ctaTertiary: "Byt ve 3D",
    image: "/media/inspiration/hero.webp",
  },
  usps: [
    { title: "Přesný výpočet", text: "Balení, podložka, lišty i doprava na vaše metry — jedním klikem v košíku." },
    { title: "Doprava podle váhy", text: "Cenu dopravy vidíte ještě před košíkem, včetně toho, kdy jede paleta." },
    { title: "Vzorky zdarma", text: "Až 5 dekorů domů, bez platby a bez závazku." },
    { title: "Pokládka na přání", text: "Ozve se vám ověřený podlahář z vašeho okolí." },
  ],
  homeIntro: {
    title: "Vinylové a SPC podlahy pro byt i komerční prostory",
    text: "Specializovaný obchod s vinylovými a SPC podlahami. Pomáháme vybrat podle místnosti, zátěže, podlahového topení i rozpočtu. Cenu uvádíme za m² i za balení, dopravu počítáme z reálné hmotnosti.",
  },
  steps: [
    { title: "Změřte místnost", text: "Stačí délka a šířka, nebo rovnou plocha." },
    { title: "Vyberte dekor", text: "Doporučíme 6–9 podlah a ukážeme je ve 3D bytě." },
    { title: "Vložte celý projekt", text: "Balení, podložka i lišty jedním tlačítkem do košíku." },
  ],
  about: {
    title: "Žádný sklad. Přesný výběr a výpočet.",
    text: "Zboží jede přímo od velkoobchodního partnera k vám — proto vidíte skutečnou dostupnost v m² a termín ve dnech.",
  },
  contact: {
    email: "info@vinylpodlahy.cz",
    phone: "+420 000 000 000",
    hours: "Po–Pá 8:00–17:00",
    company: "vinylpodlahy.cz",
    address: "Adresa bude doplněna",
  },
  landings: {
    "spc-vinylove-podlahy": {
      h1: "SPC vinylové podlahy",
      intro: "Nejtvrdší a nejstabilnější typ vinylu. Voděodolné, vhodné na podlahové topení, nejméně citlivé na nerovnosti podkladu.",
      seoText: "SPC (Stone Plastic Composite) podlahy mají minerální jádro, díky kterému jsou rozměrově stabilní i při kolísání teplot — hodí se tam, kde běžný vinyl na HDF selhává: do koupelen, kuchyní, na podlahové topení i do místností s velkými okny na jih. Kladou se plovoucím způsobem na click zámek, často s integrovanou podložkou.",
      metaTitle: "SPC vinylové podlahy — voděodolné, na podlahové topení | vinylpodlahy.cz",
      metaDescription: "SPC podlahy s minerálním jádrem. Cena za m² i za balení, dostupnost v m², doprava podle hmotnosti. Spočítejte si projekt včetně příslušenství.",
    },
    "vinylove-podlahy-click": {
      h1: "Vinylové podlahy click",
      intro: "Plovoucí pokládka bez lepení. Zvládnete ji sami za jeden víkend a podlahu lze později rozebrat.",
      seoText: "Click vinyl se spojuje zámkem jako laminát, ale je tišší, teplejší a voděodolnější. Vybírejte podle nosné desky: SPC pro vlhké prostory a topení, HDF pro nejlepší pocit „skutečného dřeva“ v suchých místnostech.",
      metaTitle: "Vinylové podlahy click — plovoucí pokládka | vinylpodlahy.cz",
      metaDescription: "Click vinylové podlahy pro svépomocnou pokládku. Přehledné parametry, cena za m² a za balení, kalkulačka prořezu a příslušenství.",
    },
    "vinyl-do-koupelny": {
      h1: "Vinyl do koupelny",
      intro: "Jen 100 % voděodolné podlahy: SPC nebo lepený vinyl. Žádné HDF, které by nabobtnalo.",
      seoText: "Do koupelny patří podlaha, které nevadí stojící voda ani vlhkost ze sprchy. Vybíráme proto výhradně SPC s minerálním jádrem a lepené vinylové dílce. Doporučujeme nášlapnou vrstvu 0,4 mm a vyšší a dekory s protiskluzovou strukturou.",
      metaTitle: "Vinyl do koupelny — 100 % voděodolné podlahy | vinylpodlahy.cz",
      metaDescription: "Voděodolné vinylové a SPC podlahy do koupelny. Filtrujeme jen to, co vlhkost skutečně vydrží. Vzorky zdarma.",
    },
    "vinyl-na-podlahove-topeni": {
      h1: "Vinyl na podlahové topení",
      intro: "Podlahy s ověřenou vhodností pro teplovodní i elektrické podlahové topení, s nízkým tepelným odporem.",
      seoText: "Ne každý vinyl smí na podlahové topení — HDF deska a některé podložky fungují jako izolant. Zde najdete jen podlahy, u kterých výrobce vhodnost potvrzuje, a v kalkulačce vám automaticky nabídneme podložku určenou pod topení.",
      metaTitle: "Vinyl na podlahové topení — ověřené podlahy | vinylpodlahy.cz",
      metaDescription: "Vinylové a SPC podlahy vhodné na podlahové topení. Nízký tepelný odpor, správná podložka v kalkulačce.",
    },
    "vinylove-podlahy-dub": {
      h1: "Vinylové podlahy dub",
      intro: "Nejoblíbenější dekor: od běleného a přírodního dubu po medové a kouřové odstíny.",
      seoText: "Dubový dekor je bezpečná volba do každého interiéru. Světlý dub místnost opticky zvětší, medový dodá teplo, tmavý kouřový dub působí luxusně. Všechny dekory si můžete nechat poslat jako vzorek zdarma.",
      metaTitle: "Vinylové podlahy dub — světlý, přírodní, tmavý | vinylpodlahy.cz",
      metaDescription: "Vinylové podlahy v dekoru dub. Desítky odstínů, vzorky zdarma, kalkulačka balení a příslušenství.",
    },
  },
  priceGuide: {
    title: "Kolik stojí vinylová podlaha v roce 2026?",
    text: "Běžné ceny na českém trhu vč. DPH.",
    rows: [
      { label: "Lepený vinyl (LVT)", range: "350–900 Kč/m²", note: "Nejlevnější vstup, vyžaduje rovný podklad a lepidlo." },
      { label: "SPC click", range: "500–900 Kč/m²", note: "Nejžádanější typ: voděodolný, na topení, často s podložkou." },
      { label: "Prémiový vinyl, nášlap 0,55 mm+", range: "900–1 300 Kč/m²", note: "Komerční třída 33+, dlouhá záruka, věrné dekory." },
      { label: "Podložka", range: "50–150 Kč/m²", note: "Odpadá u podlah s integrovanou podložkou." },
      { label: "Lišty, lepidlo, tmel", range: "60–120 Kč/m²", note: "Závisí na obvodu místnosti a počtu dveří — počítáme přesně." },
      { label: "Pokládka podlahářem", range: "220–260 Kč/m²", note: "Click i lepený vinyl; příprava podkladu je navíc." },
    ],
    source: "Orientační rozpětí podle veřejných ceníků českých prodejců a podlahářů (2026).",
  },
  footerNote: "Ceny vč. DPH. Doprava podle hmotnosti, dovoz ke krajnici. Zboží posílají partneři přímo k vám.",
};
