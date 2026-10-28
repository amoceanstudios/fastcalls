import { afterEach, describe, expect, it } from "vitest";
import {
  readExistingDatabase,
  recoveryItems,
  type StorageRecoveryReport,
} from "../lib/storageRecovery";
import { buildPersonalWork } from "../lib/personalWork";
import { now } from "../lib/models";
const databaseName = "amocean-recovery-fictitious-test";
afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(databaseName);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
});
describe("Gegevens terugvinden zonder te schrijven", () => {
  it("maakt een ontbrekende database niet opnieuw aan", async () => {
    await expect(readExistingDatabase(databaseName)).rejects.toThrow();
    expect(
      (await indexedDB.databases()).some((db) => db.name === databaseName),
    ).toBe(false);
  });
  it("leest oudere tabellen en verweesde records zonder die te verbergen of te wijzigen", async () => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open(databaseName, 4);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("notes", { keyPath: "id" });
        r.result.createObjectStore("followUps", { keyPath: "id" });
      };
      r.onsuccess = () => {
        const d = r.result;
        const t = d.transaction(["notes", "followUps"], "readwrite");
        t.objectStore("notes").put({
          id: "old-note",
          prospectId: "missing",
          content: "Mijn echte tekst blijft exact intact",
        });
        t.objectStore("followUps").put({
          id: "old-task",
          companyId: "missing",
          title: "Terugbellen",
          description: "Oudere opgeslagen afspraak",
        });
        t.oncomplete = () => {
          d.close();
          resolve();
        };
        t.onerror = () => reject(t.error);
      };
      r.onerror = () => reject(r.error);
    });
    const first = await readExistingDatabase(databaseName);
    const report: StorageRecoveryReport = {
      format: "amocean-readonly-recovery",
      version: 1,
      origin: "https://example.org",
      capturedAt: now(),
      databases: [first],
      localDrafts: {},
      errors: [],
      enumerationSupported: true,
    };
    const items = recoveryItems(report);
    expect(items).toHaveLength(2);
    expect(items[0].companyName).toBe("Bedrijf niet gekoppeld");
    expect(
      items.some(
        (item) => item.content === "Mijn echte tekst blijft exact intact",
      ),
    ).toBe(true);
    expect(await readExistingDatabase(databaseName)).toEqual(first);
  });
  it("Mijn werk toont ook notities en afspraken zonder bedrijfskoppeling", () => {
    const stamp = now();
    const data = {
      prospects: [],
      notes: [
        {
          id: "saved-note",
          prospectId: "old-company",
          content: "Niet wegfilteren",
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
      followups: [
        {
          id: "saved-task",
          prospectId: "old-company",
          title: "Mijn terugbelafspraak",
          description: "Bewaren",
          dueAt: stamp,
          dateOnly: false,
          completedAt: null,
          createdAt: stamp,
        },
      ],
      calls: [],
      drafts: [],
      activities: [],
      settings: [],
    };
    const before = JSON.stringify(data);
    const work = buildPersonalWork(data);
    expect(work.counts.notes).toBe(1);
    expect(work.counts.followups).toBe(1);
    expect(work.companyCount).toBe(0);
    expect(
      work.items.every(
        (item) => item.company.missing && item.href === "/recovery",
      ),
    ).toBe(true);
    expect(JSON.stringify(data)).toBe(before);
  });
});
