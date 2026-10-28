import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  companyQuery,
  normalizeCompanies,
  DiscoveryResponseSchema,
  maxResults,
  type Province,
} from "../lib/companyDiscovery";
import { createProspect } from "../lib/models";
import { db, tables, saveNote, saveProspect } from "../db/database";
import { saveDiscoveredCompanies } from "../db/discovery";
import {
  autoMapping,
  previewImport,
  readImport,
  makeBackup,
  validateBackup,
  toCSV,
} from "../lib/transfer";
import { handleDiscovery } from "../../netlify/functions/discover-companies";

// These are deliberately fictitious records; no live business data is seeded.
const element = (id = 101, tags: Record<string, string> = {}) => ({
  type: "node",
  id,
  tags: {
    name: "Fictief Bronbedrijf",
    amenity: "restaurant",
    phone: "0301234567",
    email: "contact@example.org",
    website: "https://example.org",
    "addr:city": "Utrecht",
    "addr:street": "Fictieve straat",
    "addr:housenumber": "1",
    "addr:postcode": "1234 AB",
    ...tags,
  },
});
const batch = (...elements: unknown[]) =>
  normalizeCompanies({ elements }, "NL-UT", "2026-10-28T09:00:00.000Z");
const request = (query = "province=NL-UT", method = "GET") =>
  new Request(
    `https://example.org/.netlify/functions/discover-companies?${query}`,
    { method },
  );

beforeEach(async () => {
  await Promise.all(tables.map((table) => table.clear()));
});
afterEach(async () => {
  await Promise.all(tables.map((table) => table.clear()));
});

describe("openbare bedrijfsvermeldingen", () => {
  it("neemt alleen aanwezige bruikbare contactgegevens mee, inclusief herkomst", () => {
    const result = batch(
      element(),
      element(102, {
        name: "Fictieve Kapper",
        shop: "hairdresser",
        email: "geen mail",
        website: "javascript:alert(1)",
        "contact:phone": "niet geldig",
      }),
      element(103, { phone: "123" }),
    );
    expect(result.records).toHaveLength(2);
    expect(result.invalid).toBe(1);
    expect(result.records[0]).toMatchObject({
      id: "osm-node-101",
      companyName: "Fictief Bronbedrijf",
      phoneNormalized: "+31301234567",
      email: "contact@example.org",
      sector: "Horeca",
      province: "Utrecht",
      address: "Fictieve straat 1 1234 AB",
      sourceUrl: "https://www.openstreetmap.org/node/101",
      sourceFetchedAt: "2026-10-28T09:00:00.000Z",
      sourceLicense: "© OpenStreetMap-bijdragers · ODbL 1.0",
      status: "TO_CALL",
      contactPerson: "",
      valueProposition: "",
    });
    expect(result.records[1]).toMatchObject({
      email: "",
      website: "",
      sector: "Beauty & wellness",
    });
  });
  it("weigert gedeeltelijke bronresultaten en meldt een resultatenlimiet", () => {
    expect(() =>
      normalizeCompanies(
        { elements: [element()], remark: "runtime timeout" },
        "NL-UT",
      ),
    ).toThrow(/niet volledig/);
    const result = batch(
      ...Array.from({ length: maxResults + 1 }, (_, i) => element(i + 1)),
    );
    expect(result.records).toHaveLength(maxResults);
    expect(result.limited).toBe(true);
  });
  it("herkent ook Nederlandse 0800- en 0900-bedrijfsnummers", () => {
    const records = batch(
      element(1, { phone: "0800-0402" }),
      element(2, { phone: "+31 900 8844" }),
      element(3, { phone: "0800 022 22 20" }),
    ).records;
    expect(records.map((record) => record.phoneNormalized)).toEqual([
      "+318000402",
      "+319008844",
      "+318000222220",
    ]);
  });
  it("bouwt uitsluitend vaste Nederlandse provinciequeries", () => {
    expect(companyQuery("NL-ZH")).toContain('area["ISO3166-2"="NL-ZH"]');
    expect(() => companyQuery('NL-ZH"];out;' as Province)).toThrow();
  });
});

describe("Netlify-ophaaldienst", () => {
  it("weigert vrije invoer en mutaties voordat een externe aanvraag start", async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(
      (await handleDiscovery(request("province=https://example.org"), fetcher))
        .status,
    ).toBe(400);
    expect(
      (await handleDiscovery(request("province=NL-UT", "POST"), fetcher))
        .status,
    ).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("geeft gevalideerde publieke resultaten terug zonder CRM-data te ontvangen", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ elements: [element()] }));
    const response = await handleDiscovery(request(), fetcher);
    expect(response.status).toBe(200);
    const body = DiscoveryResponseSchema.parse(await response.json());
    expect(body.records).toHaveLength(1);
    expect(body.records[0]).not.toHaveProperty("status");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://overpass-api.de/api/interpreter");
    expect(String(options?.body)).toContain("ISO3166");
    expect(response.headers.get("cache-control")).toContain("s-maxage=3600");
  });
  it("onderscheidt bezette, gedeeltelijke en onbereikbare bronnen van nul resultaten", async () => {
    for (const mock of [
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("busy", { status: 429 })),
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ elements: [element()], remark: "timeout" }),
        ),
      vi.fn<typeof fetch>().mockRejectedValue(new Error("network")),
    ]) {
      const response = await handleDiscovery(request(), mock);
      expect([429, 502]).toContain(response.status);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toHaveProperty("error");
    }
    const empty = await handleDiscovery(
      request(),
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ elements: [] })),
    );
    expect(empty.status).toBe(200);
    expect((await empty.json()).records).toEqual([]);
  });
});

describe("lokale landelijke opslag", () => {
  it("slaat een batch één keer op en behoudt bestaande verkoopgegevens en notities", async () => {
    const records = batch(element()).records;
    expect(await saveDiscoveredCompanies(records)).toEqual({
      added: 1,
      skipped: 0,
    });
    await saveProspect({
      ...records[0],
      status: "CUSTOMER",
      email: "eigen@example.org",
    });
    await saveNote(records[0].id, "Eigen notitie behouden");
    expect(await saveDiscoveredCompanies(records)).toEqual({
      added: 0,
      skipped: 1,
    });
    expect(await db.prospects.get(records[0].id)).toMatchObject({
      status: "CUSTOMER",
      email: "eigen@example.org",
    });
    expect(await db.notes.count()).toBe(1);
  });
  it("behoudt verschillende ketenvestigingen met gedeelde website en telefoon", async () => {
    const records = batch(
      element(101),
      element(102, { "addr:housenumber": "2" }),
      element(103, {
        "addr:street": "",
        "addr:housenumber": "",
        "addr:postcode": "",
      }),
      element(104, {
        "addr:street": "",
        "addr:housenumber": "",
        "addr:postcode": "",
      }),
    ).records;
    expect(await saveDiscoveredCompanies(records)).toEqual({
      added: 4,
      skipped: 0,
    });
    expect(await db.prospects.count()).toBe(4);
  });
  it("bewaart geen halve batch en laat bestaande bedrijven intact bij ongeldige invoer", async () => {
    const existing = createProspect({ companyName: "Fictief Bestaand" });
    await saveProspect(existing);
    const records = batch(element()).records;
    await expect(
      saveDiscoveredCompanies([
        ...records,
        { ...records[0], id: "other", email: "ongeldig" },
      ]),
    ).rejects.toThrow();
    expect(await db.prospects.count()).toBe(1);
  });
  it("houdt adres, bron en licentie vast in back-up en CSV-rondgang", async () => {
    const records = batch(element(101, { phone: "+31 30 1234567" })).records;
    await saveDiscoveredCompanies(records);
    const backup = validateBackup(await makeBackup());
    expect(backup.prospects[0].sourceLicense).toContain("ODbL");
    const raw = await readImport(
      new File([toCSV(records)], "bedrijven.csv", { type: "text/csv" }),
    );
    const imported = previewImport(raw, autoMapping(raw.headers), []);
    expect(imported.errors).toEqual([]);
    expect(imported.valid[0]).toMatchObject({
      address: records[0].address,
      phone: "+31 30 1234567",
      phoneNormalized: "+31301234567",
      province: "Utrecht",
      sourceUrl: records[0].sourceUrl,
      sourceFetchedAt: records[0].sourceFetchedAt,
      sourceLicense: records[0].sourceLicense,
      source: "openstreetmap",
    });
  });
});
