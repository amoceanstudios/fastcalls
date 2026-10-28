import { webcrypto, createHash } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  CatalogRecordSchema,
  CatalogManifestSchema,
  catalogDisabledKey,
  catalogReceiptKey,
  validateCatalogShard,
} from "../lib/bundledCatalog";
import { applyCatalogShard } from "../db/bundledCatalog";
import { db, tables, saveProspect, saveNote } from "../db/database";
import { clearData } from "../components/ui";
import { createProspect } from "../lib/models";
import {
  makeBackup,
  validateBackup,
  restoreBackup,
  toCSV,
  readImport,
  previewImport,
  autoMapping,
} from "../lib/transfer";
const record = () =>
  CatalogRecordSchema.parse(
    createProspect({
      id: "atp-fictieve-test-001",
      companyName: "Fictief Catalogusbedrijf",
      city: "Utrecht",
      province: "Utrecht",
      address: "Fictieve straat 1 1234 AB",
      phone: "+31 30 1234567",
      email: "contact@example.org",
      sector: "Horeca",
      source: "alltheplaces",
      sourceUrl: "https://example.org/bron#vestiging=1",
      sourceFetchedAt: "2026-10-28T12:00:00.000Z",
      sourceLicense: "All the Places · CC0 1.0",
      sourceDatasetDate: "2026-10-10",
    }),
  );
beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  await Promise.all(tables.map((table) => table.clear()));
});
afterEach(async () => {
  await Promise.all(tables.map((table) => table.clear()));
  vi.unstubAllGlobals();
});

describe("meegeleverde echte bedrijvenlijst", () => {
  it("controleert bestandshash, recordaantal en dubbele identifiers voordat opslag begint", async () => {
    const text = JSON.stringify([record()]);
    const shard = {
      file: "companies-001.json",
      count: 1,
      sha256: createHash("sha256").update(text).digest("hex"),
    };
    expect(await validateCatalogShard(text, shard)).toHaveLength(1);
    await expect(validateCatalogShard(text + " ", shard)).rejects.toThrow(
      /onvolledig/,
    );
    await expect(
      validateCatalogShard(text, { ...shard, count: 2 }),
    ).rejects.toThrow(/aantallen/);
    const duplicateText = JSON.stringify([record(), record()]);
    await expect(
      validateCatalogShard(duplicateText, {
        ...shard,
        count: 2,
        sha256: createHash("sha256").update(duplicateText).digest("hex"),
      }),
    ).rejects.toThrow(/aantallen/);
  });
  it("weigert manifestpaden buiten de vaste catalogus en onjuiste totaalaantallen", () => {
    const base = {
      version: "nl-test",
      generatedAt: "2026-10-28T12:00:00.000Z",
      count: 1,
      withEmail: 1,
      shards: [
        { file: "companies-001.json", count: 1, sha256: "0".repeat(64) },
      ],
    };
    expect(CatalogManifestSchema.safeParse(base).success).toBe(true);
    expect(CatalogManifestSchema.safeParse({ ...base, count: 2 }).success).toBe(
      false,
    );
    expect(
      CatalogManifestSchema.safeParse({
        ...base,
        shards: [{ ...base.shards[0], file: "../../private.json" }],
      }).success,
    ).toBe(false);
  });
  it("voegt maar één keer toe bij gelijktijdige import en bewaart verkoopgegevens", async () => {
    const input = [record()];
    const results = await Promise.all([
      applyCatalogShard("nl-test", "companies-001.json", input),
      applyCatalogShard("nl-test", "companies-001.json", input),
    ]);
    expect(results.reduce((sum, r) => sum + r.added, 0)).toBe(1);
    expect(await db.prospects.count()).toBe(1);
    expect(
      await db.settings.get(catalogReceiptKey("nl-test", "companies-001.json")),
    ).toBeDefined();
    await saveProspect({
      ...createProspect(input[0]),
      status: "CUSTOMER",
      email: "eigen@example.org",
    });
    await saveNote(input[0].id, "Eigen contactnotitie");
    await applyCatalogShard("nl-next", "companies-001.json", input);
    expect(await db.prospects.get(input[0].id)).toMatchObject({
      status: "CUSTOMER",
      email: "eigen@example.org",
    });
    expect(await db.notes.count()).toBe(1);
    expect(
      (await db.activities.toArray()).find((item) => item.type === "IMPORTED")
        ?.description,
    ).toContain("All the Places");
  });
  it("laat expliciet gewiste gegevens weg, ook na een nieuwe catalogusversie", async () => {
    await applyCatalogShard("nl-test", "companies-001.json", [record()]);
    await clearData();
    expect((await db.settings.get(catalogDisabledKey))?.value).toBe(true);
    expect(
      (await applyCatalogShard("nl-next", "companies-001.json", [record()]))
        .disabled,
    ).toBe(true);
    expect(await db.prospects.count()).toBe(0);
  });
  it("schrijft geen importbewijs of halve batch bij ongeldige brongegevens", async () => {
    await expect(
      applyCatalogShard("nl-test", "companies-001.json", [
        { ...record(), phone: "ongeldig" },
      ]),
    ).rejects.toThrow();
    expect(await db.prospects.count()).toBe(0);
    expect(
      await db.settings.get(catalogReceiptKey("nl-test", "companies-001.json")),
    ).toBeUndefined();
  });
  it("behoudt bron, licentie en bronbestanddatum in back-ups en exports", async () => {
    await applyCatalogShard("nl-test", "companies-001.json", [record()]);
    const backup = validateBackup(await makeBackup());
    expect(backup.prospects[0]).toMatchObject({
      source: "alltheplaces",
      sourceLicense: "All the Places · CC0 1.0",
      sourceDatasetDate: "2026-10-10",
    });
    // Replacement is explicit: the automatic catalogue may not add unrelated records afterwards.
    await restoreBackup(backup, "replace");
    expect((await db.settings.get(catalogDisabledKey))?.value).toBe(true);
    const csv = toCSV(backup.prospects);
    expect(csv).toContain("2026-10-10");
    const raw = await readImport(
      new File([csv], "bedrijven.csv", { type: "text/csv" }),
    );
    expect(
      previewImport(raw, autoMapping(raw.headers), []).valid[0]
        .sourceDatasetDate,
    ).toBe("2026-10-10");
  });
});
