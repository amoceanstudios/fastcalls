# Amocean Prospect OS · Design system

Een donkere, creatieve saleswerkruimte met een rustige basis, cyaan als primair accent en kleine oceanische details. Een bestaande lichte of systeemvoorkeur blijft behouden. Het ontwerp gebruikt echte lokale gegevens en eerlijke actiestatussen.

## Tokens

De bron staat in `src/styles/tokens.css`.

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

Alleen de sticky header, modals en mobiele verkoopactiebalk krijgen een subtiel transparant oppervlak. De ondergrond is bijna dekkend om contrast te behouden. Blur is maximaal 6 px; geen blur op de paginaachtergrond, kaarten of prospectlijst. Zonder ondersteuning blijven de vlakken bruikbaar.

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
