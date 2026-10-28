import type { Prospect, Profile } from "./models";
export function generateEmail(
  p: Prospect,
  profile: Profile,
  template: number,
  tone: string,
  context = { conversation: false, priorEmail: false, note: "" },
) {
  if (template === 2 && !context.conversation)
    throw new Error("Bevestig eerst dat er een gesprek heeft plaatsgevonden.");
  if (template === 4 && !context.priorEmail)
    throw new Error("Bevestig eerst dat u eerder een e-mail heeft gestuurd.");
  const friendly = tone === "Persoonlijk";
  const greeting = p.contactPerson
    ? `${friendly ? "Beste" : "Geachte"} ${p.contactPerson},`
    : `Beste team van ${p.companyName},`;
  const idea =
    p.valueProposition ||
    `Samen bekijken waar software het dagelijkse werk van ${p.companyName} kan vereenvoudigen.`;
  const location = p.city ? ` in ${p.city}` : "";
  const sector = p.sector
    ? `Voor bedrijven in ${p.sector.toLowerCase()} kan het interessant zijn om handmatige processen te vereenvoudigen.`
    : "Mogelijk zijn er processen in uw organisatie die met software eenvoudiger kunnen.";
  const intro = `Vanuit ${profile.company} ontwikkel${profile.name ? " ik" : "en we"} software en automatiseringen voor bedrijven. Voor ${p.companyName}${location} zie ik een mogelijke aanleiding om kennis te maken.`;
  let body = [
    `${intro}\n\nEen idee om samen te verkennen: ${idea}\n\nZou een korte kennismaking van vijftien minuten passen om te bespreken of dit aansluit bij uw organisatie?`,
    `${sector}\n\nEen mogelijke richting voor ${p.companyName}: ${idea}\n\nMet software op maat kunnen we samen onderzoeken hoe dit praktisch kan worden ingericht. Welke onderdelen zouden voor uw team het meest relevant zijn?`,
    `Dank voor het gesprek. Graag zet ik een mogelijke vervolgstap voor ${p.companyName} op een rij.\n\n${idea}${context.note ? "\n\nZoals genoteerd: " + context.note : ""}\n\nZullen we een moment plannen om dit verder te bespreken?`,
    `Graag verken ik met ${p.companyName} hoe een passende softwareoplossing eruit zou kunnen zien.\n\nEen mogelijk onderwerp voor een demonstratie: ${idea}\n\nIn een korte sessie kunnen we uw wensen bespreken en samen bepalen wat zinvol is om te laten zien. Heeft u volgende week ruimte voor een kennismaking?`,
    `Ik kom graag even terug op mijn eerdere e-mail aan ${p.companyName}.\n\nHet idee was: ${idea}\n\nIs dit op dit moment relevant voor uw organisatie? Als een ander moment beter uitkomt, hoor ik dat ook graag.`,
    `${intro}\n\n${idea}\n\nIk weet niet of dit bij uw huidige prioriteiten past. Daarom maak ik graag kort kennis, zonder verplichtingen. Zullen we vijftien minuten plannen om te bekijken of er een passende vervolgstap is?`,
  ][template];
  if (tone === "Kort en krachtig")
    body = `${template === 2 ? "Dank voor het gesprek." : template === 4 ? "Ik kom terug op mijn eerdere e-mail." : `Vanuit ${profile.company} maak ik graag kennis met ${p.companyName}${location}.`}\n\nEen mogelijke richting: ${idea}\n\nZullen we kort bespreken of dit voor uw team relevant is?`;
  if (tone === "Enthousiast maar professioneel")
    body += "\n\nIk denk graag met uw team mee over een passende aanpak.";
  if (body === undefined) throw new Error("Onbekend e-mailsjabloon");
  const question =
    tone === "Consultatief"
      ? "\n\nWaar ziet u zelf de grootste kans om het werk eenvoudiger te maken?"
      : "";
  const signature =
    profile.signature ||
    [
      profile.name,
      profile.company,
      profile.email,
      profile.phone,
      profile.website,
    ]
      .filter(Boolean)
      .join("\n");
  const result = {
    subject: [
      `Kennismaken met ${p.companyName}`,
      `Een mogelijke vervolgstap voor ${p.companyName}`,
      `Naar aanleiding van ons gesprek — ${p.companyName}`,
      `Samen een software-idee verkennen`,
      `Even terugkomen op mijn e-mail`,
      `Een kort idee voor ${p.companyName}`,
    ][template],
    body: `${greeting}\n\n${body}${question}\n\n${friendly ? "Hartelijke groet" : "Met vriendelijke groet"},\n${signature}`,
  };
  return {
    subject: result.subject.replace(/\{\{.*?\}\}/g, ""),
    body: result.body.replace(/\{\{.*?\}\}/g, ""),
  };
}
export function mailto(recipient: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject.replace(/[\r\n]/g, " "))}&body=${encodeURIComponent(body)}`;
}
