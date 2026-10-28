# Amocean Prospect OS · Design system

Een donkere, creatieve saleswerkruimte met een rustige basis, cyaan als primair accent en kleine oceanische details. Een bestaande lichte of systeemvoorkeur blijft behouden. Het ontwerp gebruikt echte lokale gegevens en eerlijke actiestatussen.

## Tokens

De basistokens staan in `src/styles/tokens.css`; de crystal-oppervlakken en hun overrides staan in `src/styles/liquid-glass.css`.

| Onderdeel        | Keuze                                                         |
| ---------------- | ------------------------------------------------------------- |
| Achtergrond      | Near-black `#05070D`                                          |
| Oppervlak        | Oceaanblauw `#0A111E`, subtiel lichtere verdiepingen          |
| Primaire tekst   | Off-white `#F5F7FA`                                           |
| Secundaire tekst | `#A2B0C3`, leesbaar op donkere oppervlakken                   |
| Primaire actie   | Cyaan `#22D3EE`, donkere tekst                                |
| Status           | Groen voor bevestigde positieve status, rood voor fouten      |
| Lettertype       | Manrope Variable, lokaal gehost, `font-display: swap`         |
| Typografie       | 11/13/14 px voor aanvullende tekst en invoer; titels 30–40 px |
| Spatiëring       | 4, 8, 12, 16, 20, 24, 32, 40 px                               |
| Hoekradii        | 6, 10, 16, 22 px; pillen 999 px                               |
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
