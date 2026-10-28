# Amocean Prospect OS · Design system

Een donkere, creatieve saleswerkruimte met een rustige basis, cyaan als primair accent en kleine oceanische details. Een bestaande lichte of systeemvoorkeur blijft behouden. Het ontwerp gebruikt echte lokale gegevens en eerlijke actiestatussen.

## Tokens

De basistokens staan in `src/styles/tokens.css`, de crystal-structuur in `src/styles/liquid-glass.css` en de huidige semantische afwerking in `src/styles/studio.css`. De Studio-laag wordt als laatste geladen en is de actuele bron voor oppervlak-, tekst-, actie- en motionwaarden.

| Onderdeel        | Keuze                                                         |
| ---------------- | ------------------------------------------------------------- |
| Achtergrond      | Near-black `#060A12`                                          |
| Oppervlak        | Oceaanblauw `#0D1828`, subtiel lichtere verdiepingen          |
| Primaire tekst   | Off-white `#F3F7FC`                                           |
| Secundaire tekst | `#B0BFD1`, leesbaar op donkere oppervlakken                   |
| Primaire actie   | Cyaan Aqua-gradient `#A4F6FF` → `#35D5E9`, donkere tekst      |
| Status           | Groen voor bevestigde positieve status, rood voor fouten      |
| Lettertype       | Manrope Variable, lokaal gehost, `font-display: swap`         |
| Typografie       | 12/13/15 px voor tekst; mobiele invoer 16 px; titels 30–42 px |
| Spatiëring       | 4, 8, 12, 16, 20, 24, 32, 40 px                               |
| Hoekradii        | 14, 24, 30 px; pillen 999 px                                  |
| Beweging         | 150/200/240 ms; `cubic-bezier(.2,.8,.2,1)`                    |
| Schaduw          | Rustige paneelschaduw, aparte tokens voor zwevende lagen      |

Op mobiel blijven tekstinvoervelden 16 px om ongewenste browserzoom te voorkomen. De kleine lettergroottes dienen voor aanvullende labels; belangrijke bedrijfsinformatie en acties hebben een hogere hiërarchie.

## Glassmorphism

De actuele richting is **crystal / liquid glass**: transparante kaarten, tellers, invoervelden en zwevende navigatie boven een zichtbare oceaanachtergrond. De glaspanelen combineren een donkere basistint met 25% alpha, lichte reflecties, een heldere bovenrand en een dunne contour. De transparantie zit in de achtergrondlagen, nooit in de tekst.

De achtergrond bestaat uit statische CSS-gradients en grote gebogen contouren. Er zijn geen geanimeerde filters, canvas-effecten of muisvolgende vervormingen. Blur is maximaal 6 px; mobiele kaarten gebruiken 3 px. Prospectregels gebruiken geen backdrop-filter, zodat een lange lijst niet voor iedere regel een extra blurlaag krijgt.

De sidebar, header en mobiele navigatie zweven los van de schermrand. De eerstvolgende actie staat boven de glazen statistiekkaarten. De lichte variant heeft transparante witte oppervlakken met donkere tekst. Ontbrekende filterondersteuning en de systeemvoorkeur voor verminderde transparantie krijgen een beter dekkende variant.

## Informatiehiërarchie

- Bovenaan één volgend bedrijf met de primaire belactie, naast de agenda voor vandaag en achterstallig.
- Een nog onbekende beluitkomst wordt apart getoond, zonder een gesprek te suggereren.
- Onder de werkruimte: filterbare bedrijfsstatussen en de werkelijk geregistreerde activiteit van vandaag.
- Historie en notities blijven bereikbaar via duidelijke uitklapbare secties.
- Geen bedrijven: één importstartpunt met korte uitleg, zonder lege statistiekvakken.
- Desktop scheidt **Dagelijks** en **Beheer**; mobiel toont vier dagelijkse routes en **Meer** voor gegevens en instellingen.
- De belactie staat op een normale mobiele viewport boven de vaste navigatie. Bedrijfsgegevens en opvolgingen blijven via directe links bereikbaar.

De indeling staat in `src/styles/overview.css`; de berekeningen voor het dagoverzicht staan in `src/lib/dashboard.ts`.

## Beweging

- Knoppen reageren met een kleine verplaatsing of schaalverandering.
- Tabs animeren hun kleur en onderstreping.
- Kaarten, secties en e-mailconcepten verschuiven kort bij binnenkomst.
- Scroll-reveal gebruikt een eenmalige IntersectionObserver, zonder scroll-eventloop of parallax.
- Inhoud blijft volledig leesbaar tijdens de beweging: tekst vervaagt niet naar een laag contrast. Alleen de decoratieve modalachtergrond mag vervagen.
- `prefers-reduced-motion` schakelt alle beweging en hovertransformaties uit; inhoud blijft zichtbaar en bedienbaar.
- Er is geen animatiebibliotheek, canvasachtergrond, automatische video of kunstmatige generatievertraging.

De e-mailgenerator werkt deterministisch en offline. De korte overgang presenteert de nieuwe tekst; die suggereert geen externe AI-aanroep.

## Illustraties

`src/components/Illustration.tsx` bevat originele, herbruikbare vectoren voor onboarding, lege resultaten, zoeken, fouten en successen. Ze delen dunne lijnen, een zachte oceanische kleurverloopvulling en kleine signaalaccenten. De illustraties zijn decoratief (`aria-hidden`); alle betekenis staat in gewone HTML-tekst.

## Bedrijfsafbeeldingen

Via **Bedrijfsprofiel → Bewerken → Bedrijfslogo of foto** kan de gebruiker een eigen PNG, JPEG of WebP kiezen. Er worden geen logo’s, favicons of stockfoto’s automatisch bij externe partijen opgehaald.

- Maximaal 3 MB bronbestand en 16 megapixels.
- Verwerking in de browser naar maximaal 192 × 192 px, met behoud van de verhouding.
- Opslag als compacte rasterafbeelding in IndexedDB; werkt offline.
- SVG en externe beeld-URL’s worden niet als opgeslagen bedrijfsafbeelding geaccepteerd.
- Volledige JSON-back-ups bewaren de afbeelding; CSV/Excel blijven compacte tekstexports.
- Het optionele veld `logoDataUrl` vereist geen database-indexmigratie en oudere records/back-ups blijven geldig.

## Toegankelijkheid

Behoud AA-tekstcontrast, een zichtbare focusring en grote aanraakvlakken. Dialogen gebruiken Radix focus trapping, herstellen de focus bij sluiten en tonen meldingen binnen de modal, zodat schermlezers deze kunnen bereiken. Een status wordt altijd ook met tekst aangeduid.

Geautomatiseerde browserchecks testen contrast op de hoofdschermen, keyboard/focus, lokale afbeeldingopslag, animatieduur en verminderde beweging. Handmatige controle met een schermlezer en op echte doelapparaten blijft zinvol.

Manrope wordt onder de OFL-licentie meegeleverd; zie `public/fonts/LICENSE-Manrope.txt`.

## Persoonlijke informatie eerst

Het dashboard geeft opgeslagen notities, terugbelafspraken, eigen bedrijven en conceptmails voorrang boven het doorwerken van de volledige catalogus. Mijn werk staat permanent in de mobiele navigatie: Overzicht · Mijn werk · Bedrijven · Agenda · Meer. Belmodus en beheer staan in Meer. Persoonlijke kaarten tonen het bedrijf, soort opgeslagen informatie, datum en inhoud; links gaan naar de juiste bestaande record. Afgeronde afspraken blijven zichtbaar en heropenbaar.

`src/styles/personal-work.css` bevat de responsieve indeling. Op mobiel vormen vier snelkoppelingen een raster van twee kolommen. Zoekfilters hebben expliciete labels en aantallen, geen betekenis die alleen van een pictogram of kleur afhangt. Werkresultaten tonen volledige tekst; alleen dashboardvoorbeelden gebruiken een korte tekstuitsnede met een duidelijke link. De zoekbalk blijft bereikbaar tijdens scrollen. Profieltabs hebben ruime aanraakvlakken in twee kolommen. Focus wordt bij een directe recordlink naar die record verplaatst en teruggaan behoudt de zoekcontext. Er is geen opslagmigratie of reset aan deze weergavewijziging gekoppeld.

## AMOCEAN Studio · visuele afwerking

Deze laag is uitsluitend presentatief: dezelfde routes, schermindeling, knoppen, formulieren en opgeslagen gegevens. `src/main.tsx` voegt alleen de stylesheet toe. Geen wijziging aan componentlogica, gegevensschema, database, seeddata, zoekfilters of opslaghandelingen.

| Rol                | Donker                         | Licht                          |
| ------------------ | ------------------------------ | ------------------------------ |
| Basis              | `#060A12`                      | `#EDF3F8`                      |
| Primair oppervlak  | `rgb(13 24 40 / 54%)`          | `rgb(255 255 255 / 64%)`       |
| Opaque fallback    | `#0D1828`                      | `#F9FCFF`                      |
| Verhoogd oppervlak | `#101D30`                      | `#F5FAFF`                      |
| Tekst              | `#F3F7FC`                      | `#122337`                      |
| Aanvullende tekst  | `#B0BFD1`                      | `#4B5D70`                      |
| Accent             | `#81E9F6`                      | `#086B83`                      |
| Primaire actie     | Aqua-gradient met donkere inkt | Petrol-gradient met witte inkt |

Het oppervlaktesysteem onderscheidt transparante kaarten, rustigere invoervelden en beter afgeschermde verhoogde lagen voor menu's en modals. Afgeronde hoeken, een verfijnde lichte bovenrand en één zachte schaduw geven diepte. De grote achtergrondringen zijn vervangen door een rustige, statische lichtverdeling. Iconen in persoonlijke snelkoppelingen staan in kleine gekleurde vakken; aantallen gebruiken tabulaire cijfers. Koppen hebben een duidelijke zwaardere hiërarchie. Het bestaande lokaal gehoste Manrope blijft behouden.

Motiontokens: **150 ms** voor drukken, focus, kleur en randen; **200 ms** voor hoverdiepte; **240 ms** voor introductie en dialogen. Easing is `cubic-bezier(0.16, 1, 0.3, 1)` voor uitlopende beweging en `cubic-bezier(0.2, 0.8, 0.2, 1)` voor indrukken. Drukfeedback gebruikt schaal 0,98 en hooguit 1 px verplaatsing. Hover optillen geldt alleen bij een precieze aanwijzer. Interactieve links reageren eveneens kort. Er zijn geen doorlopende animaties, JavaScript-animatielussen, extra bibliotheken of routewissels toegevoegd.

Op mobiel opent een dialoog visueel vanaf de onderrand, met de bestaande sluitknop, focusafhandeling en toetsenbordbediening. Desktop behoudt een gecentreerde dialoog met een korte schaalbeweging. Tekst en kaarten blijven tijdens het verschijnen volledig opaak; alleen de decoratieve achtergrond-overlay mag vervagen. De mobiele dock krijgt een actieve achtergrond voor het volledige navigatie-item en behoudt dezelfde vijf keuzes.

`prefers-reduced-motion` schakelt alle animaties en transitions uit, inclusief druk- en hoververplaatsingen. `prefers-reduced-transparency` en ontbrekende backdrop-filterondersteuning krijgen solide oppervlakken. Blur blijft 4 px op desktop en 2 px op mobiel voor bestaande panelen; navigatie gebruikt de reeds aanwezige beperkte blur. Invoer blijft op mobiel 16 px om onbedoeld inzoomen te voorkomen. Aanraakvlakken en focusranden blijven minimaal 44 px respectievelijk 2 px. Beweging maskeert nooit inhoud of een opslagstatus.
