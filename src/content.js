// Redakčný obsah webu (texty z Instagramu @lexbeauty_stupava).
// Ceny a dĺžky sa berú z Booqme cez `booqmeId`, texty tu sú len popis ošetrenia.

export const studio = {
  name: 'LEX | Kozmetické štúdio',
  brand: 'Beauty by Lex',
  owner: 'Alexandra Popovičová',
  address: 'Okružná 23/A, 900 31 Stupava',
  mapsUrl: 'https://maps.google.com/?q=Okru%C5%BEn%C3%A1+23%2FA%2C+Stupava',
  // TODO: doplniť celé telefónne číslo (v Instagram bio je skrátené „0903…“)
  phone: process.env.STUDIO_PHONE || '',
  instagram: 'https://www.instagram.com/lexbeauty_stupava/',
  brands: ['Algotherm', 'Medik8', 'BioRePeel'],
};

export const treatments = [
  {
    slug: 'hlbkove-cistenie',
    title: 'Hĺbkové', subtitle: 'čistenie pleti',
    booqmeId: 9527,
    tags: ['pleť'],
    steps: ['dvojfázové odlíčenie', 'enzymatická exfoliácia', 'kombinované prístrojové (skinscrubber) a manuálne čistenie pleti', 'ozónová plazma', 'čistiaca maska', 'záverečná starostlivosť'],
  },
  {
    slug: 'algo-discovery',
    title: 'Algo', subtitle: 'Discovery',
    booqmeId: 9528,
    tags: ['pleť'],
    intro: 'Kompletné ošetrenie na mieru podľa typu a stavu pleti s luxusnou francúzskou kozmetickou značkou Algotherm.',
    steps: ['dvojfázové odlíčenie', 'dvojkrokové peelingové čistenie pleti', '15 min. masáž tváre, krku a dekoltu', 'krémová maska', 'úprava obočia', 'záverečná starostlivosť'],
    note: 'zahŕňa tvár, krk a dekolt',
  },
  {
    slug: 'algo-intense',
    title: 'Algo', subtitle: 'Intense',
    booqmeId: 9529,
    tags: ['pleť', 'masáže'],
    intro: 'Kompletné ošetrenie na mieru podľa typu a stavu pleti s luxusnou francúzskou kozmetickou značkou Algotherm.',
    steps: ['dvojfázové odlíčenie', 'dvojkrokové peelingové čistenie pleti', '20 min. masáž tváre, krku a dekoltu', 'alginátová maska', '10 min. masáž rúk', 'úprava obočia', 'sérum', 'záverečná starostlivosť s SPF ochranou'],
    note: 'zahŕňa tvár, krk a dekolt',
  },
  {
    slug: 'hydra-beauty',
    title: 'Hydra', subtitle: 'Beauty',
    booqmeId: 9532,
    tags: ['pleť', 'prístrojové'],
    steps: ['dvojfázové odlíčenie', 'prístrojové hĺbkové čistenie hydrodermabráziou', 'ozónová plazma', 'zapravenie séra hydrodermabráziou', 'rádiofrekvencia', 'zapracovanie masky ultrazvukom', 'záverečná starostlivosť'],
  },
  {
    slug: 'kobido',
    title: 'Kobido', subtitle: 'liftingová masáž',
    booqmeId: 9530,
    tags: ['masáže'],
    intro: 'Japonská liftingová KOBIDO masáž tváre, krku a dekoltu – kombinácia uvoľnenia svalov, rytmického poklepávania, lymfatickej drenáže a jemnej akupresúry.',
    steps: ['dvojfázové odlíčenie', 'KOBIDO masáž tváre, krku a dekoltu', 'záverečná starostlivosť'],
  },
  {
    slug: 'crystal-retinal',
    title: 'Crystal', subtitle: 'Retinal',
    booqmeId: 9531,
    tags: ['pleť', 'masáže'],
    steps: ['dvojfázové odlíčenie', 'enzymatický peeling', 'zapracovanie na mieru namiešanej masky s vitamínom C a koncentrátom Crystal Retinalu (Medik8) pomocou liftingovej masáže', 'záverečná starostlivosť'],
    note: 'zahŕňa tvár, krk a dekolt',
  },
  {
    slug: 'chemicky-peeling',
    title: 'Chemický', subtitle: 'peeling – Medik8',
    booqmeId: 9534,
    tags: ['peelingy'],
    concerns: ['vrásky', 'akné', 'post akné', 'pigmentové škvrny'],
    steps: ['dvojfázové odlíčenie', 'príprava pleti', 'chemický peeling podľa stavu a typu pleti', 'neutralizácia', 'sterilná maska', 'záverečná starostlivosť'],
  },
  {
    slug: 'biorepeel',
    title: 'BioRePeel', subtitle: 'hĺbkový peeling',
    booqmeId: 9535,
    tags: ['peelingy'],
    concerns: ['vrásky', 'akné', 'post akné', 'pigmentové škvrny'],
    steps: ['dvojfázové odlíčenie', 'povrchové čistenie', 'príprava pleti', 'biorevitalizačný chemický peeling BioRePeel Cl3', 'neutralizácia', 'sterilná maska', 'záverečná starostlivosť'],
  },
  {
    slug: 'mezoterapia',
    title: 'Mezoterapia', subtitle: 'Derma-pen / Vital Injector',
    booqmeId: 9537,
    tags: ['prístrojové'],
    concerns: ['vrásky', 'akné', 'jazvy po akné', 'pigmentové škvrny'],
    steps: ['dvojfázové odlíčenie', 'príprava pleti', 'anestetický krém', 'zapracovanie vybranej ampule derma-penom alebo vital injectorom', 'sterilná maska', 'záverečná starostlivosť'],
  },
  {
    slug: 'laminacia-obocia',
    title: 'Laminácia', subtitle: 'obočia',
    booqmeId: 9539,
    tags: ['obočie a mihalnice'],
    intro: 'Laminačné prípravky vyformujú, zafixujú a zvýraznia prirodzený tvar obočia. Výsledkom je upravené, vyčesané obočie, ktoré stačí prečesať kefkou.',
    steps: ['príprava obočia', 'aplikácia laminačných prípravkov', 'úprava a farbenie hennou'],
    note: 'výdrž 4–6 týždňov',
  },
  {
    slug: 'laminacia-mihalnic',
    title: 'Laminácia', subtitle: 'mihalníc',
    booqmeId: 9540,
    tags: ['obočie a mihalnice'],
    intro: 'Prirodzené mihalnice sa vyčešú na špeciálny valček, laminačné prípravky ich nadvihnú, vytočia a opticky predĺžia.',
    steps: ['príprava mihalníc', 'aplikácia laminačných prípravkov', 'farbenie hennou'],
    note: 'výdrž 4–6 týždňov',
  },
];

export const lymphBenefits = [
  'Veľmi jemná technika masáže, ktorá stimuluje tok lymfy – čírej tekutiny, ktorá odstraňuje toxíny a odpadové látky z tkanív.',
  'Efektívne znižuje opuchy, a tým zvýrazňuje kontúry tváre.',
  'Pomáha pri bolestiach hlavy a migrénach, uvoľňuje dutiny a zmierňuje stres.',
  'Dodáva kyslík do podkožných buniek, zlepšuje ich hydratáciu a pomáha uvoľniť tlak a napätie.',
  'Vďaka cielenému prekrveniu dokáže rozjasniť a vypnúť pleť.',
  'Na dosiahnutie dlhodobých účinkov je vhodné lymfodrenáž pravidelne opakovať.',
];
