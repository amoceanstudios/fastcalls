import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { db, tables, saveProspect } from "../db/database";
import {
  createProspect,
  defaultProfile,
  now,
  uid,
  type Prospect,
} from "../lib/models";
import { planCompanyRestore } from "../lib/backupMerge";
import { restoreBackup, validateBackup } from "../lib/transfer";
import { buildPersonalWork } from "../lib/personalWork";
import { summarizeDashboard } from "../lib/dashboard";
const source = (id: string, fields: Partial<Prospect> = {}) =>
  createProspect({
    id,
    companyName: `Fictief ${id}`,
    city: "Utrecht",
    address: `Teststraat ${id}`,
    phone: "",
    website: "https://example.org",
    source: "openstreetmap",
    ...fields,
  });
const backup = (prospects: Prospect[], extras = {}) =>
  validateBackup({
    format: "amocean-prospect-os",
    version: 2,
    exportedAt: now(),
    prospects,
    notes: [],
    followups: [],
    calls: [],
    drafts: [],
    activities: [],
    profile: defaultProfile,
    settings: [],
    ...extras,
  });
beforeEach(async () => {
  await Promise.all(tables.map((t) => t.clear()));
});
afterEach(async () => {
  await Promise.all(tables.map((t) => t.clear()));
});
describe("Veilig herstel op een vooraf geladen catalogus", () => {
  it("kiest exact dezelfde identifier vóór een andere vestiging met dezelfde website", () => {
    const one = source("one"),
      two = source("two");
    const plan = planCompanyRestore(
      [one, two],
      [one, { ...two, status: "CALLBACK" }],
      new Set(),
      new Set([two.id]),
    );
    expect(plan.idMap.get(two.id)).toBe(two.id);
    expect(plan.restored).toHaveLength(1);
    expect(plan.restored[0].id).toBe(two.id);
  });
  it("herstelt terugbel- en opvolgstatussen op onbewerkte bronrecords zonder kalenderafspraken te verzinnen", async () => {
    const one = source("one"),
      two = source("two");
    await db.prospects.bulkAdd([one, two]);
    const note = {
      id: uid(),
      prospectId: two.id,
      content: "Exact bewaarde persoonlijke tekst",
      createdAt: now(),
      updatedAt: now(),
    };
    const b = backup(
      [
        { ...one, status: "CALLBACK" },
        { ...two, status: "FOLLOW_UP" },
      ],
      { notes: [note] },
    );
    const result = await restoreBackup(b);
    expect(result.workflowsRestored).toBe(2);
    expect(result.totals).toMatchObject({
      callbacks: 1,
      followUpStatuses: 1,
      notes: 1,
      followups: 0,
    });
    expect(await db.notes.get(note.id)).toEqual(note);
    expect((await restoreBackup(b)).workflowsRestored).toBe(0);
    expect(await db.notes.count()).toBe(1);
  });
  it("behoudt nieuwere eigen keuzes, ook een handmatig teruggezette Te bellen-status", async () => {
    const one = source("one"),
      two = source("two", { status: "CUSTOMER" });
    await db.prospects.bulkAdd([one, two]);
    await saveProspect(one);
    const result = await restoreBackup(
      backup([
        { ...one, status: "CALLBACK" },
        { ...two, status: "FOLLOW_UP" },
      ]),
    );
    expect(result.workflowsRestored).toBe(0);
    expect((await db.prospects.get(one.id))?.status).toBe("TO_CALL");
    expect((await db.prospects.get(two.id))?.status).toBe("CUSTOMER");
  });
  it("bewaart losse datumvelden en verschillende bedrijven met een gedeelde ketenwebsite", async () => {
    const one = source("one", {
        status: "CALLBACK",
        followUpAt: "2026-11-21T11:00:00.000Z",
      }),
      two = source("two");
    const b = backup([one, two], {
      notes: [
        {
          id: uid(),
          prospectId: two.id,
          content: "Hoort bij de tweede vestiging",
          createdAt: now(),
          updatedAt: now(),
        },
      ],
    });
    await restoreBackup(b);
    expect(await db.prospects.count()).toBe(2);
    expect((await db.prospects.get(one.id))?.followUpAt).toBe(one.followUpAt);
    expect((await db.notes.toArray())[0].prospectId).toBe(two.id);
  });
  it("maakt alle 14 statuskeuzes vindbaar zonder persoonlijke records te wijzigen", () => {
    const prospects = Array.from({ length: 14 }, (_, i) =>
      source(String(i), { status: i < 12 ? "CALLBACK" : "FOLLOW_UP" }),
    );
    const data = {
      prospects,
      notes: [],
      followups: [],
      calls: [],
      drafts: [],
      activities: [],
      settings: [],
    };
    const before = JSON.stringify(data);
    expect(buildPersonalWork(data).openFollowups).toBe(14);
    expect(summarizeDashboard(data).unscheduled).toHaveLength(14);
    expect(JSON.stringify(data)).toBe(before);
  });
});
