import { z } from "zod";
import {
  createProspect,
  normalizePhone,
  normalizeText,
  ProspectSchema,
  safeUrl,
  type Prospect,
} from "./models";

export const provinces = {
  "NL-DR": "Drenthe",
  "NL-FL": "Flevoland",
  "NL-FR": "Friesland",
  "NL-GE": "Gelderland",
  "NL-GR": "Groningen",
  "NL-LI": "Limburg",
  "NL-NB": "Noord-Brabant",
  "NL-NH": "Noord-Holland",
  "NL-OV": "Overijssel",
  "NL-UT": "Utrecht",
  "NL-ZE": "Zeeland",
  "NL-ZH": "Zuid-Holland",
} as const;
export type Province = keyof typeof provinces;
export const provinceCodes = Object.keys(provinces) as Province[];
export function isProvince(value: string): value is Province {
  return Object.hasOwn(provinces, value);
}
export const sourceLicense = "© OpenStreetMap-bijdragers · ODbL 1.0";
export const maxResults = 8000;

// Only fixed, Dutch province codes reach Overpass. Never interpolate user queries.
export function companyQuery(province: Province) {
  if (!isProvince(province)) throw new Error("Onbekende provincie.");
  const business = [
    '[~"^(shop|craft|office|healthcare|industrial)$"~"."]',
    '["amenity"~"^(restaurant|cafe|bar|pub|fast_food|food_court|ice_cream|biergarten|dentist|doctors|clinic|veterinary|pharmacy|hospital|bank|fuel|car_wash|car_rental|driving_school|childcare)$"]',
    '["tourism"~"^(hotel|motel|hostel|guest_house|apartment|chalet|camp_site|caravan_site|theme_park|attraction)$"]',
    '["leisure"~"^(fitness_centre|sports_centre|golf_course|bowling_alley|dance)$"]',
  ];
  return `[out:json][timeout:22][maxsize:67108864];area["ISO3166-2"="${province}"]->.region;(${business.map((selector) => `nwr(area.region)["name"]${selector}[~"^(phone|contact:phone)$"~"."];`).join("")});out tags;`;
}

const ElementSchema = z.object({
  type: z.enum(["node", "way", "relation"]),
  id: z.number().int().positive().safe(),
  tags: z.record(z.string(), z.string()),
});
export const OverpassSchema = z.object({
  elements: z.array(z.unknown()).max(100000),
  remark: z.string().optional(),
});
export function classifyBusiness(t: Record<string, string>): string {
  const has = (key: string, values: string[]) => values.includes(t[key]);
  if (has("shop", ["hairdresser", "beauty", "massage", "tattoo", "cosmetics"]))
    return "Beauty & wellness";
  if (
    has("shop", [
      "car",
      "car_repair",
      "car_parts",
      "tyres",
      "motorcycle",
      "motorcycle_repair",
    ]) ||
    has("amenity", ["fuel", "car_wash", "car_rental", "driving_school"])
  )
    return "Automotive";
  if (
    has("amenity", [
      "restaurant",
      "cafe",
      "bar",
      "pub",
      "fast_food",
      "food_court",
      "ice_cream",
      "biergarten",
    ])
  )
    return "Horeca";
  if (
    t.healthcare ||
    has("amenity", [
      "dentist",
      "doctors",
      "clinic",
      "veterinary",
      "pharmacy",
      "hospital",
      "childcare",
    ]) ||
    has("shop", ["medical_supply", "optician", "hearing_aids"])
  )
    return "Zorg";
  if (t.office === "estate_agent") return "Vastgoed";
  if (
    t.amenity === "bank" ||
    has("office", ["insurance", "financial", "financial_advisor", "accountant"])
  )
    return "Financiële dienstverlening";
  if (t.leisure) return "Sport & fitness";
  if (t.tourism) return "Toerisme & verblijf";
  if (
    has("craft", [
      "electrician",
      "plumber",
      "carpenter",
      "builder",
      "painter",
      "roofer",
      "hvac",
      "tiler",
      "gardener",
      "glaziery",
    ]) ||
    has("shop", ["trade", "building_materials", "hardware"])
  )
    return "Bouw & installatie";
  if (t.shop) return "Winkels & retail";
  if (t.office) return "Zakelijke dienstverlening";
  if (t.craft) return "Ambacht & productie";
  return "Industrie";
}
const firstPhone = (input: string) =>
  input
    .split(/[;,]/)
    .map((part) => part.trim())
    .find((part) => normalizePhone(part)) ?? "";
const firstEmail = (input: string) =>
  input
    .split(/[;,]/)
    .map((part) => part.trim().replace(/^mailto:/i, ""))
    .find((part) => z.email().safeParse(part).success) ?? "";
export function normalizeCompanies(
  input: unknown,
  province: Province,
  fetchedAt = new Date().toISOString(),
) {
  const data = OverpassSchema.parse(input);
  // An Overpass timeout may return both a partial list and a remark. Never
  // describe that partial response as a completed province.
  if (data.remark)
    throw new Error(
      "De bron kon deze provincie niet volledig ophalen. Probeer het later opnieuw.",
    );
  const records: Prospect[] = [];
  let invalid = 0;
  const ids = new Set<string>();
  for (const raw of data.elements) {
    const parsed = ElementSchema.safeParse(raw);
    if (!parsed.success) {
      invalid++;
      continue;
    }
    const { type, id, tags: t } = parsed.data;
    const phone = firstPhone(
      [t["contact:phone"], t.phone].filter(Boolean).join(";"),
    );
    if (
      !t.name?.trim() ||
      !phone ||
      t.shop === "vacant" ||
      ["yes", "1"].includes(t.disused) ||
      ["yes", "1"].includes(t.abandoned)
    ) {
      invalid++;
      continue;
    }
    const key = `osm-${type}-${id}`;
    if (ids.has(key)) continue;
    ids.add(key);
    records.push(
      createProspect({
        id: key,
        companyName: t.name.trim().slice(0, 500),
        city: t["addr:city"] || t["addr:town"] || t["addr:village"] || "",
        province: provinces[province],
        address: [t["addr:street"], t["addr:housenumber"], t["addr:postcode"]]
          .filter(Boolean)
          .join(" "),
        phone,
        email: firstEmail(
          [t["contact:email"], t.email].filter(Boolean).join(";"),
        ),
        website: safeUrl(
          (t["contact:website"] || t.website || "").split(";")[0].trim(),
        ),
        sector: classifyBusiness(t),
        source: "openstreetmap",
        sourceUrl: `https://www.openstreetmap.org/${type}/${id}`,
        sourceFetchedAt: fetchedAt,
        sourceLicense,
      }),
    );
  }
  return {
    records: records.slice(0, maxResults),
    invalid,
    limited: records.length > maxResults,
  };
}

// Public contact data only. Local workflow fields and repeated defaults are not
// sent over the network; the browser supplies them when adding a new prospect.
export const PublicCompanySchema = ProspectSchema.pick({
  id: true,
  companyName: true,
  city: true,
  province: true,
  address: true,
  phone: true,
  email: true,
  website: true,
  sector: true,
  sourceUrl: true,
  sourceFetchedAt: true,
  sourceLicense: true,
});
export const DiscoveryResponseSchema = z.object({
  province: z.string().refine(isProvince),
  records: z.array(PublicCompanySchema).max(maxResults),
  invalid: z.number().int().nonnegative(),
  limited: z.boolean(),
});

// Do not merge chain branches just because they share a national website or
// switchboard. OSM identity, or a matching company plus address/phone, is needed.
export function companyIdentityKeys(p: Prospect): string[] {
  const name = normalizeText(p.companyName);
  return [
    `id:${p.id}`,
    ...(p.sourceUrl ? [`source:${p.sourceUrl}`] : []),
    ...(p.phoneNormalized && (p.address || p.source !== "openstreetmap")
      ? [
          `phone:${name}:${p.phoneNormalized}:${normalizeText(p.city)}:${normalizeText(p.address || "")}`,
        ]
      : []),
    ...(p.address && p.city
      ? [`address:${name}:${normalizeText(p.address)}:${normalizeText(p.city)}`]
      : []),
  ];
}
