// Build the reviewed public catalogue from downloaded source snapshots.
// Input files stay outside the repository; no contact data is invented.
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { build } from "esbuild";
const input = resolve(
  process.argv[2] || "/workspace/artifacts/company-research",
);
const output = resolve("public/data/company-catalog");
const helperPath = join(tmpdir(), "amocean-catalog-build-helpers.mjs");
await build({
  stdin: {
    contents:
      'export {normalizeCompanies, classifyBusiness, companyIdentityKeys, provinces} from "./src/lib/companyDiscovery"; export {createProspect,normalizePhone,safeUrl} from "./src/lib/models"; export {CatalogRecordSchema,CatalogManifestSchema} from "./src/lib/bundledCatalog";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: helperPath,
});
const {
  normalizeCompanies,
  classifyBusiness,
  companyIdentityKeys,
  provinces,
  createProspect,
  normalizePhone,
  safeUrl,
  CatalogRecordSchema,
  CatalogManifestSchema,
} = await import(pathToFileURL(helperPath));
const readJson = async (file) =>
  JSON.parse(await readFile(join(input, file), "utf8"));
const osmReport = await readJson("osm-download-report.json");
const atpReports = [
  ...(await readJson("atp-download-report.json")),
  ...(await readJson("atp-retry-report.json")),
];
const atpReport = new Map(atpReports.map((entry) => [entry.name, entry]));
const boundaries = (await readJson("provinces-2025.geojson")).features;
function inRing(point, ring) {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function provinceFor(point) {
  if (!Array.isArray(point) || point.length < 2) return "";
  for (const boundary of boundaries) {
    const polygons =
      boundary.geometry.type === "MultiPolygon"
        ? boundary.geometry.coordinates
        : [boundary.geometry.coordinates];
    if (
      polygons.some(
        (rings) =>
          inRing(point, rings[0]) &&
          !rings.slice(1).some((ring) => inRing(point, ring)),
      )
    ) {
      const name = boundary.properties.statnaam;
      return name === "Fryslân" ? "Friesland" : name;
    }
  }
  return "";
}
const str = (value) =>
  Array.isArray(value)
    ? value.join(";")
    : typeof value === "string"
      ? value
      : "";
const phoneFor = (value) =>
  str(value)
    .split(/[;,]/)
    .map((part) => part.trim())
    .find((part) => normalizePhone(part)) || "";
const postcodeFor = (value) =>
  str(value)
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/^(\d{4})([A-Z]{2})$/, "$1 $2");
const emailFor = (value) =>
  str(value)
    .split(/[;,]/)
    .map((part) => part.trim().replace(/^mailto:/i, ""))
    .find((part) => {
      try {
        createProspect({ companyName: "validation", email: part });
        return Boolean(part);
      } catch {
        return false;
      }
    }) || "";
const candidates = [];
let invalid = 0;
let outsideNetherlands = 0;
const sourceReports = [];
for (const report of osmReport.filter((item) => !item.error)) {
  const raw = await readJson(`osm/${report.city}.json`);
  for (const element of raw.elements) {
    if (element.tags["addr:postcode"])
      element.tags["addr:postcode"] = postcodeFor(
        element.tags["addr:postcode"],
      );
  }
  const normalized = normalizeCompanies(raw, report.province, report.fetchedAt);
  if (normalized.limited)
    throw new Error(
      "OSM source unexpectedly exceeds its maximum; split it before publishing.",
    );
  candidates.push(...normalized.records);
  invalid += normalized.invalid;
  sourceReports.push({
    type: "openstreetmap",
    area: report.city,
    url: report.source,
    fetchedAt: report.fetchedAt,
    sourceRecords: raw.elements.length,
    usable: normalized.records.length,
  });
}
for (const file of (await readdir(join(input, "atp")))
  .filter((file) => file.endsWith(".geojson"))
  .sort()) {
  const slug = file.replace(/\.geojson$/, "");
  const report = atpReport.get(slug);
  if (!report || report.error) continue;
  const data = await readJson(`atp/${file}`);
  const date = str(data.dataset_attributes?.["spider:collection_time"]).slice(
    0,
    10,
  );
  let usable = 0;
  for (const feature of data.features || []) {
    const t = feature.properties || {};
    if (str(t["addr:country"]).toUpperCase() !== "NL") continue;
    const phone = phoneFor(t["contact:phone"]) || phoneFor(t.phone);
    const province = provinceFor(feature.geometry?.coordinates);
    const location = feature.geometry?.coordinates;
    const fullAddress = str(t["addr:full"]);
    // Provider country tags occasionally misclassify foreign branches as NL.
    if (
      ["BE", "DE", "FR", "GB", "LU"].includes(
        str(t["addr:state"]).toUpperCase(),
      ) ||
      /\b(?:BE\s+\d{4}|DE\s+\d{5}|BELGIUM|BELGI[EË]|GERMANY)\b/i.test(
        fullAddress,
      ) ||
      (Array.isArray(location) &&
        location.length >= 2 &&
        !province &&
        !/^\d{4}\s?[A-Z]{2}$/i.test(str(t["addr:postcode"])) &&
        !normalizePhone(phone).startsWith("+31"))
    ) {
      outsideNetherlands++;
      continue;
    }
    const brand = str(t.brand);
    const outletName = str(t.name) || brand;
    const name =
      brand && !outletName.toLowerCase().includes(brand.toLowerCase())
        ? `${brand} · ${outletName}`
        : outletName;
    if (!phone || !name.trim()) {
      invalid++;
      continue;
    }
    const providerId =
      str(feature.id) ||
      str(t.ref) ||
      JSON.stringify([
        t["addr:city"],
        t["addr:street"],
        t["addr:housenumber"],
        feature.geometry,
      ]);
    const digest = createHash("sha256")
      .update(slug + ":" + providerId)
      .digest("hex")
      .slice(0, 24);
    try {
      const record = createProspect({
        id: `atp-${slug}-${digest}`,
        companyName: name.trim().slice(0, 500),
        city: str(t["addr:city"]),
        province,
        address: [
          str(t["addr:street"]),
          str(t["addr:housenumber"]),
          postcodeFor(t["addr:postcode"]),
        ]
          .filter(Boolean)
          .join(" "),
        phone,
        email: emailFor(t["contact:email"]) || emailFor(t.email),
        website: safeUrl(str(t.website).split(";")[0]),
        sector: classifyBusiness(t),
        source: "alltheplaces",
        sourceUrl: report.source + "#feature=" + encodeURIComponent(providerId),
        sourceFetchedAt: report.fetchedAt,
        sourceLicense: "All the Places · CC0 1.0",
        ...(date ? { sourceDatasetDate: date } : {}),
      });
      candidates.push(record);
      usable++;
    } catch {
      invalid++;
    }
  }
  sourceReports.push({
    type: "alltheplaces",
    dataset: slug,
    url: report.source,
    fetchedAt: report.fetchedAt,
    datasetDate: date,
    sourceRecords: data.features?.length || 0,
    usable,
  });
}
// Stable identifiers and matching contact/address identities remove repeated
// listings; a shared chain website alone never discards another branch.
const identities = new Set();
const records = [];
let duplicates = 0;
for (const candidate of candidates) {
  const keys = companyIdentityKeys(candidate);
  if (keys.some((key) => identities.has(key))) {
    duplicates++;
    continue;
  }
  keys.forEach((key) => identities.add(key));
  records.push(CatalogRecordSchema.parse(candidate));
}
records.sort(
  (a, b) =>
    (a.sector || "").localeCompare(b.sector || "", "nl") ||
    (a.province || "").localeCompare(b.province || "", "nl") ||
    a.companyName.localeCompare(b.companyName, "nl") ||
    a.id.localeCompare(b.id),
);
if (!records.length)
  throw new Error(
    "No actual company records collected; refusing to publish an empty catalogue.",
  );
const summary = {
  count: records.length,
  withPhone: records.filter((r) => normalizePhone(r.phone)).length,
  withEmail: records.filter((r) => r.email).length,
  withWebsite: records.filter((r) => r.website).length,
  duplicatesRemoved: duplicates,
  invalidOrMissingPhone: invalid,
  outsideNetherlandsExcluded: outsideNetherlands,
  bySector: Object.fromEntries(
    [...new Set(records.map((r) => r.sector))]
      .sort()
      .map((sector) => [
        sector,
        records.filter((r) => r.sector === sector).length,
      ]),
  ),
  byProvince: Object.fromEntries(
    [...new Set(records.map((r) => r.province || "Niet bepaald"))]
      .sort()
      .map((province) => [
        province,
        records.filter((r) => (r.province || "Niet bepaald") === province)
          .length,
      ]),
  ),
  bySource: Object.fromEntries(
    ["openstreetmap", "alltheplaces"].map((source) => [
      source,
      records.filter((r) => r.source === source).length,
    ]),
  ),
};
const generatedAt = new Date().toISOString();
const hash = createHash("sha256").update(JSON.stringify(records)).digest("hex");
const version = `nl-${generatedAt.slice(0, 10).replaceAll("-", "")}-${hash.slice(0, 12)}`;
await mkdir(output, { recursive: true });
const shards = [];
for (let start = 0; start < records.length; start += 1000) {
  const subset = records.slice(start, start + 1000);
  const file = `companies-${String(shards.length + 1).padStart(3, "0")}.json`;
  const text = JSON.stringify(subset) + "\n";
  await writeFile(join(output, file), text);
  shards.push({
    file,
    count: subset.length,
    sha256: createHash("sha256").update(text).digest("hex"),
  });
}
const manifest = CatalogManifestSchema.parse({
  version,
  generatedAt,
  count: records.length,
  withEmail: summary.withEmail,
  shards,
});
await writeFile(
  join(output, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  join(output, "source-report.json"),
  JSON.stringify(
    {
      generatedAt,
      version,
      ...summary,
      scope:
        "Dutch public business listings from the successfully downloaded national All the Places datasets and selected OSM city areas. Not a complete Dutch business register; phone/email reachability not manually verified.",
      provinceClassification:
        "CBS/PDOK 2025 province boundaries; unmatched coordinates remain unassigned.",
      provinceBoundarySource:
        "https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0",
      failedSources: atpReports
        .filter((entry) => entry.error && !atpReport.get(entry.name)?.fetchedAt)
        .map((entry) => ({
          dataset: entry.name,
          url: entry.source,
          error: entry.error,
        })),
      sources: sourceReports,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  join(output, "LICENSES.md"),
  `# Public company catalogue\n\nCombined catalogue: Open Database License (ODbL) 1.0, https://opendatacommons.org/licenses/odbl/1-0/.\n\nOpenStreetMap-derived records: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright.\n\nAll the Places records: released under CC0 1.0; see https://github.com/alltheplaces/alltheplaces/blob/master/LICENSE and https://www.alltheplaces.xyz/. Individual original company websites remain linked from the records where supplied.\n\nProvince attribution uses CBS/PDOK 2025 boundaries. Those boundaries are not redistributed in this catalogue.\n\nSource URLs, retrieval timestamps, available dataset dates and per-record source licences accompany the records. See source-report.json for exact collection scope and counts. Inclusion does not verify present-day operation, phone reachability or email deliverability. No contacts have been invented.\n`,
);
console.log(JSON.stringify({ version, ...summary }, null, 2));
