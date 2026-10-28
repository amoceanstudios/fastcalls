# Amocean Prospect OS

Een Nederlandstalig, lokaal saleswerkstation voor Amocean. React, strict TypeScript, Vite, Dexie/IndexedDB en een installeerbare PWA. Het CRM werkt zonder account, betaalde API of externe AI-dienst. Optioneel haalt een meegeleverde Netlify Function openbare bedrijfsvermeldingen op.

## Starten

Vereist Node.js 24 LTS en npm. De lockfile legt exacte dependencyversies vast.

```sh
npm ci
npm run dev
```

Gebruik de bestaande checkout. Cloudtaken zijn al geïsoleerd; maak geen extra Git-worktree. In deze cloudmachine staat de repository in `/workspace/fastcalls`. Bij een afgeschermde thuismap gebruikt u `npm ci --cache /workspace/.npm-cache`.

```sh
npm test                 # bedrijfslogica, echte XLSX-verwerking, IndexedDB, UI
npm run typecheck
npm run build            # productie-uitvoer naar dist/
npm run preview          # controle van de productiebuild, inclusief service worker
npm run test:e2e          # Chromium: mobiele flows, offline, back-up/herstel
npm run format:check
```

De browsertests gebruiken `/usr/bin/chromium` indien aanwezig. Op een andere machine: `npx playwright install chromium`. Optioneel stelt u `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` in op uw Chromium-uitvoerbaar bestand. Er zijn geen applicatieomgevingsvariabelen of geheimen vereist. De PWA-serviceworker is alleen actief in de productiebuild, zodat ontwikkelwijzigingen niet door een oude cache worden gemaskeerd.

## Werkdag

- **Overzicht:** eerst achterstallige opvolgingen, daarna vandaag en actiegerichte prospects op prioriteit. Afgeronde bedrijven, klanten en niet-interessante bedrijven worden uitgesloten. Een toekomstige opvolging wordt niet te vroeg naar voren gehaald.
- **Bedrijven:** kies direct een branche met aantallen en bekijk bedrijven gegroepeerd per branche of als doorlopende lijst. De weergave blijft lokaal bewaard. Telefoon, e-mailadres (indien bekend), website en contactpersoon staan op de bedrijfskaart. Zoek ook op e-mailadres. Combineer filters en sorteringen; wijzig status rechtstreeks in de lijst. Het formulier biedt branchesuggesties en laat eigen branches toe. De app bevat een daadwerkelijk verzamelde openbare bedrijvenlijst die automatisch lokaal wordt toegevoegd. Gegevens en bronnen zijn controleerbaar; ontbrekende contactgegevens worden niet verzonnen. Importeer daarnaast eigen gegevens of voeg bedrijven handmatig toe. Maak een volledige back-up om alle gegevens naar een ander apparaat mee te nemen.
- **Bedrijfsprofiel:** contactgegevens, volledige oorspronkelijke kans, bewerkbare notities, opvolging, e-mailconcepten en historie. Nieuwe notitie-invoer blijft in IndexedDB staan wanneer u wisselt of herlaadt.
- **Belmodus:** vaste wachtrij, vorige/volgende, overslaan, pauzeren en hervatten. Pas filters aan en kies ‘Nieuwe wachtrij met deze filters’ om de actieve sessie opnieuw samen te stellen.
- **Belacties:** een `tel:`-klik registreert uitsluitend dat u een belactie start. Leg de daadwerkelijke uitkomst zelf vast. Er wordt geen verbinding, gesprekstijd of opname gedetecteerd. Handmatig bevestigde gespreksnotities worden aan het bedrijf gekoppeld.
- **E-mails:** zes offline sjablonen en vijf toonopties, eigen afzenderprofiel, bewerkbare concepten, kopiëren en correct gecodeerde mailto-links. Gespreks- en eerdere-e-mailcontext vereisen bevestiging; adressen worden nooit geraden. Een geopende e-mailapp betekent niet dat er iets is verstuurd.
- **Opvolging:** lokale kalenderdagen, optionele tijd, bewerken, afronden, heropenen en verwijderen. Er zijn geen gegarandeerde meldingen wanneer de app gesloten is.
- **Snelzoeken:** Ctrl/⌘ + K. `/` focust de prospectzoekbalk of opent snelzoeken, buiten invoervelden.

## Uw echte Excel-bestand importeren

Er is geen echte bedrijvenlijst meegeleverd. De productieapp bevat bewust **geen verzonnen prospects**. Alleen geautomatiseerde tests maken duidelijk fictieve records aan in geïsoleerde testbrowsers.

Open **Gegevens & back-ups** en kies XLSX, CSV of een JSON-lijst (maximaal 15 MB). Gebruik de eerste rij als kopregel en het eerste werkblad voor prospects. Oud XLS moet eerst als XLSX of CSV worden opgeslagen. Verwachte kolommen:

| Kolom                     | Betekenis                                            |
| ------------------------- | ---------------------------------------------------- |
| Nr                        | Oorspronkelijke volgorde, geen permanente identifier |
| Bedrijf                   | Verplicht                                            |
| Plaats                    | Vestigingsplaats                                     |
| Telefoon                  | Origineel formaat blijft zichtbaar                   |
| Website                   | Alleen veilige http/https-links                      |
| Sector / Type             | Sector                                               |
| Wat Amocean kan betekenen | Volledige oorspronkelijke kans                       |
| E-mail, Contactpersoon    | Optioneel, niet geraden                              |
| Status, Prioriteit        | Optioneel, Nederlandse labels of interne codes       |

Kolommen worden automatisch herkend en zijn handmatig koppelbaar. Controleer de preview, fouten en waarschuwingen. Ongeldige rijen worden overgeslagen, geldige rijen blijven beschikbaar. Twijfelachtige telefoonnummers blijven zichtbaar maar krijgen geen belactie. Excel kan voorloopnullen verwijderen: sla telefoonnummers bij voorkeur als tekst op.

Duplicaten worden herkend op genormaliseerd telefoonnummer, websitehost of bedrijfsnaam + plaats. Standaard worden ze overgeslagen. U kunt expliciet alleen basisgegevens laten bijwerken of bewust nieuwe records maken. Bijwerken behoudt bestaande statussen, prioriteiten, tags, notities, contactenhistorie en opvolgingen. Controleer matchresultaten bij verschillende vestigingen die een telefoon of domein delen. De oorspronkelijke kans wordt onverkort overgenomen bij nieuwe import; expliciet bijwerken van basisgegevens kan die tekst vervangen.

## Back-ups en export

Maak regelmatig een **volledige JSON-back-up**. Die bevat prospects, alle notities, opvolgingen, belacties, activiteit, e-mailconcepten, profiel en tijdelijke IndexedDB-concepten. UI-weergavevoorkeuren en de actieve belpositie vallen buiten de gegevensback-up.

CSV is Excel-compatibel (UTF-8 BOM, puntkomma), met actuele status, laatste notitie en laatste contactdatum. Excel-export heeft afzonderlijke werkbladen voor prospects, notities, opvolgingen, activiteiten, belacties en e-mailconcepten. Exports beschermen tekst tegen formule-injectie. Alleen JSON-back-ups zijn bedoeld voor een volledig herstel; CSV/Excel zijn leesbare gegevensuitvoer.

**Herstellen:** kies een JSON-back-up, controleer de aantallen en bevestig. Het formaat en alle relaties worden gevalideerd vóór een transactie. Standaard worden ontbrekende gegevens samengevoegd: bestaande statussen en records met hetzelfde ID blijven leidend. Duplicaatbedrijven kunnen aan hun bestaande bedrijf worden gekoppeld. Dit is geen synchronisatie- of conflictresolutiesysteem. Volledig vervangen vraagt expliciet ‘HERSTELLEN’. Wissen vraagt ‘ALLES WISSEN’.

Voor import in een bestaande dataset en vóór herstel/verwijdering start een veiligheidsback-updownload. Controleer dat uw browser downloads toestaat en dat het bestand veilig bewaard is. Een geblokkeerde download kan door een website niet betrouwbaar als opgeslagen bestand worden bevestigd.

## Offline en installatie

1. Bouw de app en gebruik `npm run preview`, of open de gepubliceerde HTTPS-site.
2. Open de app eerst online. De serviceworker bewaart de appbestanden, inclusief routes en import/exportmodules; bedrijfsgegevens staan uitsluitend in IndexedDB.
3. Open de app opnieuw en controleer dat offline herladen werkt.
4. iOS Safari: **Deel → Zet op beginscherm**. Android/Chrome: **Installeren** in het browsermenu.
5. Bij een nieuwe versie verschijnt een melding. Sla werk op en kies **Nu bijwerken**. Gegevens blijven behouden bij een shell-update.

De browser kan gegevens wissen; privémodus kan opslag beperken. PWA-installatie en permanente opslag maken geen cloudback-up. Apparaten synchroniseren niet automatisch. Gebruik een beveiligd eigen apparaat. Lokale browseropslag is geen versleutelde kluis. Telefoongesprekken, mailapps en externe websites hebben hun eigen netwerk- en apparaatvereisten.

Werkelijke installatie op iOS/Android, telefonie en een externe mailclient moeten op het doelapparaat worden gecontroleerd. Geautomatiseerde mobiele tests draaien in Chromium met een mobiele viewport, niet in iOS Safari. Lighthouse-doelen zijn geen gemeten prestatiescore.

## Vercel

Importeer de repository als Vite-project. Gebruik `npm ci`, buildcommando `npm run build`, uitvoermap `dist` en Node 24. `vercel.json` bevat SPA-fallbacks, een Content Security Policy, MIME-bescherming en herlaadbeleid voor HTML/serviceworker. Er zijn geen geheimen nodig. Deploy op de root van het domein. Voor een subpad moeten Vite base, manifest scope/start_url en router basename samen worden aangepast.

## Netlify

Buildcommando `npm run build`, publishdirectory `dist`, Node 24. `public/_redirects` en `public/_headers` worden meegebouwd voor SPA-navigatie en beveiligingsheaders. HTTPS is vereist voor PWA-installatie buiten localhost.

Er is nog niets naar een hostingprovider gepubliceerd; de repository bevat de deploybare productie-uitvoer na `npm run build`.

## Architectuur

- `src/lib/models.ts`: Zod-schema’s, statuslabels, veilige URL’s en telefoonnummers.
- `src/db/database.ts`: versiebeheer, transacties en repositoryfuncties. Schema 1 → 2 wordt getest met een echte oude IndexedDB-database.
- `src/lib/logic.ts`: agenda, wachtrij, zoeken en filters.
- `src/lib/transfer.ts`: lokale import, export en gevalideerd herstel.
- `src/lib/email.ts`: deterministische Nederlandse e-mails zonder netwerkaanroep.
- `src/components`: toegankelijke Radix-dialogen, formulieren en gedeelde prospectwerkruimte.
- `src/pages`: dashboard, directory, bedrijfsprofiel, belmodus, agenda, gegevens en instellingen.
- `src/tests`, `e2e`: unit/componenttests en productie-browsertests.

Er is geen analytics, datasynchronisatie of AI-verzoek. Applicatiecode en fonts worden lokaal geserveerd. De optionele landelijke zoekfunctie stuurt alleen een vaste provinciecode naar de eigen Netlify Function; die raadpleegt OpenStreetMap/Overpass. CRM-records, notities en profielgegevens worden daarbij niet verzonden. Externe website-, tel- en mailto-acties zijn expliciet. Een app garandeert op zichzelf geen AVG-compliance.

## Gecontroleerde oplevering

Op 28 oktober 2026 geslaagd: 47 unit-/componenttests, 14 Chromium-browsertests, strict TypeScript, productiebuild en Prettier-controle. De browserchecks omvatten mobiele CRUD-flows, lokale conceptinvoer, zoeken/filters, belpositie, Excel-werkbladen, herstel in een nieuwe browsercontext, offline herladen, PWA-update met behoud van gegevens en geautomatiseerde axe-controles voor de hoofdschermen en een dialoog. Automatische toegankelijkheidscontroles vervangen geen handmatige screenreadercontrole.

De productie-dependencies hebben geen bekende meldingen in `npm audit --omit=dev`. De volledige dependencyboom heeft vier lage meldingen in de indirecte `deepmerge`/Workbox-buildketen. De voorgestelde automatische oplossing zou de PWA-plugin naar een incompatibele oude versie terugzetten; die downgrade is niet toegepast. Deze buildtools worden niet als onderdeel van de applicatie naar de browser gestuurd. Er wordt geen volledige productierijpheid voor ongeteste doelapparaten of externe hosting geclaimd.

## Amocean.ai-interface en navigatie

De interface gebruikt de aangeleverde Amocean.ai-huisstijl: near-black `#05070D`, oceaanblauw `#0B1B33`, off-white `#F5F7FA`, cyaan `#22D3EE` en groen voor functionele status. Nieuwe profielen openen standaard donker; een bestaande expliciete thema-instelling blijft behouden. De lichte variant blijft beschikbaar. Manrope Variable wordt lokaal meegeleverd. Er zijn geen video’s, externe fontdiensten, canvas-effecten of animatiebibliotheken toegevoegd.

Het dashboard geeft prioriteit aan de volgende actie en agenda. De desktopdirectory gebruikt compacte bedrijfsregels; op mobiel blijven de bel- en statusacties direct bedienbaar. De kleur-, typografie-, spacing-, radius-, shadow- en motiontokens staan in `src/styles/tokens.css`. De transparante crystal/liquid-glass oppervlakken staan in `src/styles/liquid-glass.css`: zichtbare oceaancontouren achter de vakken, reflecterende randen en zwevende navigatie. Zie [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) voor de ontwerpafspraken.

Routes worden afzonderlijk geladen via `src/app/routes.ts`. Interne links laden hun routecode alvast bij aanwijzen, toetsenbordfocus of aanraken; bij databesparingsmodus gebeurt dat niet. Een mislukte voorlaadactie blokkeert een latere navigatie niet. De globale bedrijvenzoeklijst wordt alleen opgevraagd wanneer snelzoeken open is. Gedeelde filters staan in een eigen component, waardoor belmodus niet de volledige directory hoeft te laden. Zoeken houdt de invoer responsief via deferred rendering en gebruikt een notitie-index bij het filteren.

React, IndexedDB en validatie hebben aparte vendorbestanden met inhoudshashes voor hergebruik bij volgende releases. Dit verkleint de opnieuw te downloaden code bij een UI-update; het is geen claim dat de totale eerste download evenredig kleiner is. De browsercheck controleert dat routecode bij focus/hover vooraf laadt, bij de klik wordt hergebruikt en andere routes niet onnodig meelaadt.

### Bedrijfslogo of foto toevoegen

Open een bedrijfsprofiel en kies **Bewerken → Bedrijfslogo of foto**. PNG, JPEG en WebP worden lokaal verkleind en in de browser bewaard. De afbeelding verschijnt bij het bedrijf en gaat mee in een volledige JSON-back-up. Oudere back-ups zonder afbeeldingen blijven bruikbaar. Er worden geen externe logo’s automatisch opgehaald. Details over bestandsgrootte, toegankelijkheid en beweging staan in het design system.

### Nieuw dagoverzicht

Het dashboard is ingedeeld naar dagelijkse acties. **Wie belt u nu?** toont één bedrijf, waarom het prioriteit krijgt en de belknop. **Wat volgt u op?** scheidt vandaag en achterstallig; taken kunnen rechtstreeks worden afgerond. Een gestarte belactie zonder bevestigde uitkomst krijgt een aparte melding. Bedrijfsstatussen en daadwerkelijk afgeronde acties staan lager; uw opgeslagen werk en recente notities staan direct bovenaan. Alle notities en historie zijn bereikbaar via Mijn werk.

Zonder bedrijven toont de app één importstap in plaats van een dashboard vol lege statistieken. Desktopnavigatie scheidt dagelijkse routes en beheer. Mobiel zijn er vijf duidelijke keuzes: Overzicht, Mijn werk, Bedrijven, Agenda en Meer. Belmodus, Gegevens/back-ups en Instellingen staan onder Meer.

Dashboardstatuslinks openen een schoon statusfilter, zodat een eerder bewaarde plaats- of sectorfilter niet onbedoeld bedrijven verbergt. `src/lib/dashboard.ts` berekent de aantallen uit echte records. De aanvullende indelingsregels staan in `src/styles/overview.css`. Browserchecks verifiëren ook het afronden van dashboardtaken, de mobiele Meer-navigatie en een zichtbare belactie op een 390 × 664 viewport zonder scrollen.

## Bedrijven zoeken in heel Nederland

Open **Bedrijven → Bedrijven zoeken** (of **Gegevens & back-ups → Vul uw bedrijvenlijst**) en kies standaard **Heel Nederland → Zoeken & opslaan**. De app haalt de twaalf provincies achter elkaar op. U kunt ook één provincie kiezen, stoppen of mislukte provincies opnieuw proberen. Elke geslaagde provincie wordt direct en atomair opgeslagen; eerdere bedrijven, notities, statussen en opvolgingen blijven behouden. Dit is een optionele online functie: het CRM en bestandimport blijven offline werken.

De bron is **OpenStreetMap via Overpass** (`https://overpass-api.de/api/interpreter`). Er zijn geen API-sleutels nodig. Het is geen compleet bedrijvenregister: alleen genoemde bedrijfsvermeldingen met een bruikbaar telefoonnummer in de geselecteerde categorieën komen mee. Publieke e-mailadressen en websites worden overgenomen wanneer vermeld. Ontbrekende gegevens worden niet geraden. Bron-URL, provincie, adres (indien beschikbaar), ophaaldatum en `© OpenStreetMap-bijdragers · ODbL 1.0` blijven bewaard in bedrijfsprofiel, volledige back-up en CSV/Excel-export. De ophaaldatum is geen verificatiedatum. Zie [OSM-licentie](https://www.openstreetmap.org/copyright) voor hergebruik.

De ophaaldienst staat in `netlify/functions/discover-companies.ts`. Netlify bouwt die mee vanuit `netlify.toml`. Een gewone Vite-preview of statische hosting bevat deze serverfunctie niet; de interface meldt dat expliciet. De functie accepteert alleen twaalf vaste provinciecodes en een GET-verzoek. Geen vrije zoekquery of URL kan als serververzoek worden uitgevoerd. De Overpass-query heeft 22 seconden rekentijd; de externe aanvraag wordt na 26 seconden afgebroken. Publieke resultaten mogen één uur via de CDN worden hergebruikt. Een timeout, fout of gedeeltelijk Overpass-resultaat wordt als mislukt gemeld, nooit als een lege of volledige provincie. Maximaal 8.000 bruikbare vermeldingen en 4 MB aan publieke contactgegevens per provincie per aanvraag; de interface meldt het wanneer een grens bereikt wordt. CRM-standaardwaarden worden pas lokaal toegevoegd om de netwerkrespons klein te houden. Beschikbaarheid en volledigheid van de externe bron zijn niet gegarandeerd.

Opnieuw zoeken slaat bronidentiteiten en overeenkomende contactvermeldingen over. Een gedeelde bedrijfswebsite alleen voegt ketenvestigingen niet samen. Opslag gebruikt bulktransacties en de lijst rendert maximaal 60 kaarten per pagina. Zoeken en branche-/provinciefilters gelden over de volledige opgeslagen lijst.

De oorspronkelijke Overpass-dienst gaf tijdens de landelijke verzameling fouten. De meegeleverde gegevens zijn daarom daadwerkelijk opgehaald via de officiële OpenStreetMap-kaart-API (geselecteerde stadsgebieden) en openbare All the Places-datasets (landelijke vestigingen). De optionele online zoekfunctie blijft aanvullend; de meegeleverde lijst vereist geen handmatige zoek- of importactie.

## Daadwerkelijk verzamelde bedrijvenlijst — 28 oktober 2026

De productie-app voegt bij openen automatisch **11.550 openbare bedrijfsvermeldingen met telefoonnummer** toe. **3.701** vermeldingen bevatten ook een e-mailadres en **9.849** een website. Het gaat om vestigingen/vermeldingen, niet noodzakelijk om evenveel unieke ondernemingen of telefoonnummers. Er zijn twaalf branches en locaties in alle twaalf provincies; 128 vermeldingen hebben onvoldoende gegevens om hun provincie te bepalen. Die provincie blijft leeg.

De snapshots staan in `public/data/company-catalog/`. `manifest.json` bevat de exacte versie, aantallen en SHA-256 per bestand; `source-report.json` bevat per bron de ophaal-URL, datum en bruikbare aantallen. De telling en classificatie zijn afgeleid van de records, niet van demogegevens. Verkeerd als NL gemarkeerde buitenlandse vestigingen zijn waar aantoonbaar uitgesloten; onbruikbare telefoonnummers en duplicaten worden overgeslagen. De lijst is geen compleet Nederlands bedrijvenregister en bereikbaarheid/actuele opening is niet handmatig bevestigd.

De brondata komen van [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL) en [All the Places](https://www.alltheplaces.xyz/) (CC0). De samengestelde catalogus wordt onder ODbL 1.0 aangeboden; zie `public/data/company-catalog/LICENSES.md`. Provincies zijn ruimtelijk bepaald met de officiële CBS/PDOK-grenzen van 2025. De providerbron, ophaaldatum, bronlicentie en beschikbare bronbestanddatum blijven per record behouden. Bronbestanddatums kunnen ouder zijn dan de ophaaldatum.

De browser valideert elk bestand inclusief SHA-256 en slaat het in een transactie op, samen met een importbewijs. Daardoor leidt herladen, opnieuw proberen of twee geopende tabs niet tot herhaalde import. Bestaande gegevens worden niet overschreven. Een expliciete wisactie of vervangend back-upherstel schakelt automatisch opnieuw toevoegen uit; de gebruiker houdt controle over de eigen database. Bestanden worden alleen bij de eerste noodzakelijke import gedownload; daarna staan de bedrijven in IndexedDB. Het CRM blijft bruikbaar tijdens de import en na import ook offline.

Reproduceren van het gecontroleerde catalogusbestand uit de bewaarde downloads kan met `node scripts/build-company-catalog.mjs /workspace/artifacts/company-research`. De ruwe downloads staan buiten Git. Dit script valideert records, gebruikt actuele CBS-grenzen, classificeert branches, verwijdert herhaalde identiteiten en schrijft de catalogus en het bronrapport opnieuw. Voer geen onbedoelde herpublicatie uit zonder de nieuwe aantallen en brondata te controleren. Reguliere `npm run build` doet geen nieuwe scraping en kopieert de meegeleverde snapshots alleen naar `dist`.

De tests gebruiken uitsluitend fictieve fixtures in geïsoleerde databases. De automatische import is daarnaast gecontroleerd met de daadwerkelijk meegeleverde lijst. De CSV- en Excel-exports en volledige back-ups bewaren de contact- en brongegevens.

## Mijn werk: opgeslagen informatie terugvinden op mobiel

**Mijn werk** staat permanent in de mobiele navigatie en desktopzijbalk. Het dashboard begint met snelkoppelingen naar notities, terugbellen, eigen bedrijven en conceptmails. De nieuwste notitie en eerstvolgende afspraak zijn zichtbaar zonder een verborgen historiesectie te openen.

De route `/work` toont alle opgeslagen notities, open en afgeronde terugbelafspraken, gestarte en bevestigde belacties, conceptmails, bedrijven waar eigen werk bij hoort en de bijbehorende activiteiten. Geïmporteerde bronrecords en importactiviteiten vullen de persoonlijke werkstroom niet. Niet-afgemaakte notitie- en gespreksinvoer uit de bestaande instellingen wordt eveneens getoond, met een expliciet label en zonder een verzonnen opslagdatum. Een bewaarde Terugbellen-status zonder aparte taak blijft vindbaar.

Zoeken werkt op volledige notitie-/concepttekst, bedrijfsnaam, telefoon, e-mailadres en status. Filters en zoektekst staan in de URL, zodat teruggaan de zoekcontext herstelt. Links openen de juiste profieltab en richten de aandacht direct op de betreffende notitie, afspraak of belactie. Een specifiek opgeslagen mailconcept wordt geopend op zijn eigen identifier. Teruggaan brengt de gebruiker naar de eerdere Mijn werk-filter. Afspraken kunnen rechtstreeks worden afgerond of heropend; afgeronde afspraken blijven opgeslagen en terug te vinden.

Deze verandering wijzigt **geen databanknaam, schemaversie, entiteitsmodel, catalogusbestand of opslag-/herstelroutine**. De nieuwe verzamelweergaven lezen bestaande records. De mobiele behoudtest vergelijkt de volledige inhoud van prospects, notes, followups, calls, activities, drafts en settings vóór en na zoeken, openen en herladen: de inhoud moet exact gelijk blijven. Alle fixtures blijven geïsoleerd van echte gebruiksgegevens. Gewone handelingen zoals een afspraak afronden gebruiken de bestaande opslagfuncties en vereisen een expliciete gebruikersactie.

De mobiele interface heeft vier grote persoonlijke snelkoppelingen, leesbare tekst, aanraakvlakken van minimaal 44 px en zoekt zonder de volledige bedrijvenlijst te renderen. Zoekresultaten worden in stappen van 30 getoond. Profieltabs staan op kleine schermen in twee kolommen. De bestaande donkere crystal-glasshuisstijl, lichte modus en verminderde beweging blijven ondersteund.

## Studio-afwerking: uitsluitend visuele wijzigingen

`src/styles/studio.css` levert het huidige visuele design system: verfijnde transparante oppervlakken, helderder hiërarchie in tekst en knoppen, zachtere schaduwen, duidelijk geselecteerde filters en een samenhangende mobiele dock. Primaire acties gebruiken een herkenbare aqua-/petrolafwerking. Dezelfde indeling en functies blijven beschikbaar.

Knoppen en interactieve links hebben korte drukfeedback; hoverreacties werken alleen met een muis of vergelijkbare aanwijzer. Modals krijgen op mobiel een paneelbeweging vanaf onderen en op desktop een subtiele schaalbeweging. Elke interactie duurt 150–240 ms. Verminderde beweging schakelt deze effecten uit. Beide thema's en het transparantiefallback blijven ondersteund. Zie `DESIGN_SYSTEM.md` voor de exacte tokens en gebruiksregels.

Deze afwerking wijzigt geen opslagcode, database, routes, gegevensmodellen, catalogus of bedrijfslogica. Opgeslagen notities, afspraken, concepten en bestaande keuzes blijven in dezelfde opslag staan. De bestaande mobiele behoudtest, toegankelijkheidscontroles en volledige browserworkflows controleren de wijzigingen.

## Ontbrekende gegevens onderzoeken

`/recovery` (Meer → Gegevens terugvinden) controleert bestaande app-databases in **de huidige browser en op het huidige siteadres**. Er worden uitsluitend opgesomde bestaande databases geopend met een readonly-transactie; een onverwachte upgrade wordt afgebroken zodat de controle geen ontbrekende database opnieuw aanmaakt. De catalogusimport start niet bij rechtstreeks openen van deze route. Deze pagina wist, vervangt of herstelt geen records automatisch.

De controle toont ongefilterde notities, afspraken, belacties, concepten en bewaarde invoer, inclusief records zonder een nog bestaande bedrijfskoppeling en bekende oudere tabellen. Een veiligheidskopie bevat de ruwe records en bronmetadata, ook als ze niet aan de normale back-upvalidatie voldoen. Dit bestand heeft bewust een eigen recovery-formaat en mag niet als een vervangende back-up worden gebruikt; controle en eventuele omzetting komen vóór herstel. De inhoud wordt niet naar een server verzonden.

Een concrete weergavefout is verholpen: Mijn werk en Agenda sloegen persoonlijke records over wanneer hun bedrijf ontbrak. Die inhoud blijft nu zichtbaar met het label Bedrijf niet gekoppeld, zonder een verzonnen bedrijf te creëren of koppelingen te veranderen. Dit is niet automatisch de verklaring voor elke melding van ontbrekende gegevens. Een leeg resultaat op een nieuw siteadres of in een andere browser bewijst niet dat de oorspronkelijke records zijn verwijderd. Echte herstelbevestiging vereist toegang tot die oorspronkelijke opslag of een eerdere back-up. GitHub en een nieuwe Netlify-deployment bevatten geen kopie van persoonlijke browsergegevens.
