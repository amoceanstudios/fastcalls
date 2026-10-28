import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Dexie from "dexie";
import {
  createProspect,
  normalizePhone,
  safeUrl,
  duplicate,
  defaultProfile,
  uid,
  now,
  type FollowUp,
} from "../lib/models";
import {
  db,
  tables,
  ProspectDatabase,
  saveProspect,
  changeStatus,
  saveNote,
  deleteNote,
  saveFollowUp,
  deleteFollowUp,
  initiateCall,
  confirmCall,
  importProspects,
  saveDraft,
} from "../db/database";
import {
  groupFollowUp,
  callingQueue,
  filterProspects,
  defaultFilters,
  localInput,
} from "../lib/logic";
import { generateEmail, mailto } from "../lib/email";
import {
  readImport,
  autoMapping,
  previewImport,
  toCSV,
  makeBackup,
  validateBackup,
  restoreBackup,
  safeCell,
} from "../lib/transfer";
const company = (name = "Fictief Testbedrijf", extra = {}) =>
  createProspect({
    companyName: name,
    city: "Utrecht",
    phone: "030 123 4567",
    valueProposition: "Een portaal voor planning en werkbonnen.",
    ...extra,
  });
const follow = (prospectId: string, date: Date, extra = {}): FollowUp => ({
  id: uid(),
  prospectId,
  title: "Terugbellen",
  description: "",
  dueAt: date.toISOString(),
  dateOnly: false,
  completedAt: null,
  createdAt: now(),
  ...extra,
});
beforeEach(async () => {
  await db.open();
  for (const t of tables) await t.clear();
});
afterEach(async () => {
  for (const t of tables) await t.clear();
});
describe("Contactgegevens", () => {
  it.each([
    ["030 123 4567", "+31301234567"],
    ["06-12345678", "+31612345678"],
    ["0031 30 1234567", "+31301234567"],
    ["+31 (0)30 1234567", "+31301234567"],
    ["+44 20 1234 5678", "+442012345678"],
    ["112", ""],
    ["0900", ""],
    ["abc", ""],
  ])("normaliseert %s veilig", (input, result) => {
    expect(normalizePhone(input)).toBe(result);
  });
  it("blokkeert uitvoerbare en onveilige URL’s", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("data:text/html,test")).toBe("");
    expect(safeUrl("https://user:password@example.org")).toBe("");
    expect(safeUrl("voorbeeld.nl")).toBe("https://voorbeeld.nl/");
  });
  it("maakt en bewaart een prospect met validatie", async () => {
    const p = company();
    await saveProspect(p);
    expect((await db.prospects.get(p.id))?.phoneNormalized).toBe(
      "+31301234567",
    );
    await expect(saveProspect({ ...p, companyName: "" })).rejects.toThrow();
  });
});
describe("Import", () => {
  it("leest CSV en herkent variaties in kolomnamen", async () => {
    const raw = await readImport(
      new File(
        [
          "BEDRIJF;Plaats;Telefoonnummer;Wat Amocean kan betekenen\nFictief Testbedrijf;Utrecht;0301234567;Een klantenportaal",
        ],
        "test.csv",
      ),
    );
    const result = previewImport(raw, autoMapping(raw.headers), []);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].valueProposition).toBe("Een klantenportaal");
  });
  it("leest een echte XLSX rij", async () => {
    const { default: write } = await import("write-excel-file");
    const blob = await write(
      [
        [
          { value: "Bedrijf" },
          { value: "Telefoon" },
          { value: "Wat Amocean kan betekenen" },
        ],
        [
          { value: "Fictief Excelbedrijf" },
          { value: "0612345678" },
          { value: "Planning en service" },
        ],
      ],
      {},
    );
    const raw = await readImport(new File([blob], "test.xlsx"));
    expect(
      previewImport(raw, autoMapping(raw.headers), []).valid[0].companyName,
    ).toBe("Fictief Excelbedrijf");
  });
  it("vlagt slechte rijen zonder geldige rijen te verliezen", () => {
    const raw = {
      headers: ["Bedrijf", "E-mail"],
      rows: [
        { Bedrijf: "Goed", "E-mail": "" },
        { Bedrijf: "", "E-mail": "" },
        { Bedrijf: "Fout", "E-mail": "geen-email" },
      ],
    };
    const result = previewImport(raw, autoMapping(raw.headers), []);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
  });
  it("herkent duplicaten op telefoon, website en naam met plaats", () => {
    const p = company();
    expect(duplicate(p, company("Ander"))).toBe(true);
    expect(
      duplicate(
        company("A", { phone: "", website: "https://www.voorbeeld.nl" }),
        company("B", { phone: "", website: "https://voorbeeld.nl/" }),
      ),
    ).toBe(true);
    expect(
      duplicate(
        company("FICTIEF  Testbedrijf", { phone: "" }),
        company("fictief testbedrijf", { phone: "" }),
      ),
    ).toBe(true);
  });
  it("behoudt status en notities bij herhaalde import", async () => {
    const p = company();
    await saveProspect(p);
    await changeStatus(p, "INTERESTED");
    await saveNote(p.id, "Niet overschrijven");
    const result = await importProspects([company()]);
    expect(result).toEqual({ added: 0, skipped: 1, updated: 0 });
    expect((await db.prospects.get(p.id))?.status).toBe("INTERESTED");
    expect(await db.notes.count()).toBe(1);
  });
  it("laat corrupte JSON en XLS niet stilzwijgend door", async () => {
    await expect(readImport(new File(["{"], "test.json"))).rejects.toThrow();
    await expect(readImport(new File([""], "test.xls"))).rejects.toThrow("XLS");
  });
});
describe("Lokale verkoopworkflow", () => {
  it("bewaart status na sluiten en heropenen van IndexedDB", async () => {
    const p = company();
    await saveProspect(p);
    await changeStatus(p, "CALLBACK");
    db.close();
    await db.open();
    expect((await db.prospects.get(p.id))?.status).toBe("CALLBACK");
    expect(
      (await db.activities.toArray()).some((a) =>
        a.description.includes("Terugbellen"),
      ),
    ).toBe(true);
  });
  it("maakt, bewerkt en verwijdert notities", async () => {
    const p = company();
    await saveProspect(p);
    await saveNote(p.id, "Eerste gesprek");
    const note = (await db.notes.toArray())[0];
    await saveNote(p.id, "Bewerkt gesprek", note.id);
    expect((await db.notes.get(note.id))?.content).toBe("Bewerkt gesprek");
    expect((await db.notes.get(note.id))?.createdAt).toBe(note.createdAt);
    await deleteNote(note);
    expect(await db.notes.count()).toBe(0);
  });
  it("rondt opvolging af en synchroniseert volgende datum", async () => {
    const p = company();
    await saveProspect(p);
    const f = follow(p.id, new Date(2026, 9, 29, 14));
    await saveFollowUp(f);
    expect((await db.prospects.get(p.id))?.followUpAt).toBe(f.dueAt);
    await saveFollowUp({ ...f, completedAt: now() });
    expect((await db.prospects.get(p.id))?.followUpAt).toBeNull();
    await deleteFollowUp(f);
    expect(await db.followups.count()).toBe(0);
  });
  it("onderscheidt belactie en bevestigd gesprek", async () => {
    const p = company();
    await saveProspect(p);
    const c = await initiateCall(p);
    expect(c.outcome).toBeNull();
    expect((await db.prospects.get(p.id))?.lastContactedAt).toBeNull();
    await confirmCall(c, "SPOKEN", "Gesproken met eigenaar", "INTERESTED");
    expect((await db.prospects.get(p.id))?.lastContactedAt).not.toBeNull();
    expect((await db.prospects.get(p.id))?.status).toBe("INTERESTED");
    expect((await db.notes.toArray())[0].content).toBe(
      "Gesproken met eigenaar",
    );
  });
  it("markeert niet opgenomen niet als werkelijk contact", async () => {
    const p = company();
    await saveProspect(p);
    await confirmCall(await initiateCall(p), "NO_ANSWER", "", "NO_ANSWER");
    expect((await db.prospects.get(p.id))?.lastContactedAt).toBeNull();
  });
  it("bewaart e-mailconcepten", async () => {
    const p = company();
    await saveProspect(p);
    await saveDraft({
      id: "draft",
      prospectId: p.id,
      recipient: "",
      subject: "Test",
      body: "Eigen tekst",
      template: 0,
      tone: "Zakelijk",
      updatedAt: now(),
    });
    db.close();
    await db.open();
    expect((await db.drafts.get("draft"))?.body).toBe("Eigen tekst");
  });
});
describe("Agenda en wachtrij", () => {
  const today = new Date(2026, 9, 28, 10);
  it("groepeert lokaal op kalenderdag", () => {
    expect(groupFollowUp(follow("p", new Date(2026, 9, 27, 23)), today)).toBe(
      "Achterstallig",
    );
    expect(groupFollowUp(follow("p", new Date(2026, 9, 28, 0)), today)).toBe(
      "Vandaag",
    );
    expect(groupFollowUp(follow("p", new Date(2026, 9, 29, 0)), today)).toBe(
      "Morgen",
    );
    expect(groupFollowUp(follow("p", new Date(2026, 10, 3)), today)).toBe(
      "Later",
    );
    expect(
      groupFollowUp(follow("p", today, { completedAt: now() }), today),
    ).toBe("Afgerond");
    expect(localInput(new Date(2026, 9, 28, 0))).toBe("2026-10-28");
  });
  it("geeft achterstallige opvolging voorrang en sluit afgeronde prospects uit", () => {
    const low = company("Vervallen", {
      phone: "",
      priority: "LOW",
      status: "INTERESTED",
    });
    const high = company("Hoge prioriteit", { phone: "", priority: "HIGH" });
    const closed = company("Afgerond", { phone: "", status: "COMPLETED" });
    expect(
      callingQueue(
        [closed, high, low],
        [follow(low.id, new Date(2026, 9, 27))],
        today,
      ).map((p) => p.id),
    ).toEqual([low.id, high.id]);
  });
  it("zoekt diakritisch en filtert gecombineerd", () => {
    const a = company("Één   Bedrijf", {
      sector: "Techniek",
      tags: ["Demo gewenst"],
    });
    const b = company("Ander", { city: "Amsterdam", phone: "" });
    expect(
      filterProspects([a, b], {
        ...defaultFilters,
        search: "een bedrijf demo",
        city: "Utrecht",
        priority: "MEDIUM",
      }),
    ).toEqual([a]);
    expect(
      filterProspects([a, b], { ...defaultFilters, notes: "yes" }),
    ).toHaveLength(0);
  });
});
describe("E-mail", () => {
  it("personaliseert alle zes sjablonen zonder placeholders", () => {
    for (let i = 0; i < 6; i++) {
      const e = generateEmail(company(), defaultProfile, i, "Zakelijk", {
        conversation: true,
        priorEmail: true,
        note: "",
      });
      expect(e.body).toContain("Fictief Testbedrijf");
      expect(e.body).toContain("planning en werkbonnen");
      expect(e.body).not.toContain("{{");
      expect(e.body).not.toContain("info@");
    }
  });
  it("vereist bevestiging van echte context", () => {
    expect(() =>
      generateEmail(company(), defaultProfile, 2, "Zakelijk"),
    ).toThrow("gesprek");
    expect(() =>
      generateEmail(company(), defaultProfile, 4, "Zakelijk"),
    ).toThrow("e-mail");
  });
  it("encodeert mailto en verwijdert headerinjectie", () => {
    const href = mailto(
      "naam@voorbeeld.nl",
      "Test\r\nBcc: ander",
      "regel 1\nregel & 2",
    );
    expect(href).toContain("body=regel%201%0Aregel%20%26%202");
    expect(href).not.toContain("%0D");
  });
});
describe("Export en herstel", () => {
  it("beschermt CSV en Excel cellen tegen formule-injectie", () => {
    expect(safeCell('=HYPERLINK("evil")')).toMatch(/^'/);
    expect(safeCell(" @SUM(1)")).toMatch(/^'/);
    const csv = toCSV([company("=SOM(1)")]);
    expect(csv).toContain("'=SOM(1)");
    expect(csv).toContain("Bedrijf");
  });
  it("herstelt alle gegevens en bewaart lokale wijzigingen bij samenvoegen", async () => {
    const p = company();
    await saveProspect(p);
    await saveNote(p.id, "Belangrijke notitie");
    await saveFollowUp(follow(p.id, new Date(2026, 9, 29)));
    await initiateCall(p);
    const backup = await makeBackup();
    expect(validateBackup(backup).version).toBe(2);
    await changeStatus(p, "INTERESTED");
    await restoreBackup(backup, "merge");
    expect((await db.prospects.get(p.id))?.status).toBe("INTERESTED");
    expect(await db.notes.count()).toBe(1);
    for (const t of tables) await t.clear();
    await restoreBackup(backup);
    expect(await db.prospects.count()).toBe(1);
    expect(await db.notes.count()).toBe(1);
    expect(await db.calls.count()).toBe(1);
    expect(await db.followups.count()).toBe(1);
  });
  it("weigert corrupte back-ups zonder bestaande gegevens te muteren", async () => {
    const p = company();
    await saveProspect(p);
    const b = await makeBackup();
    await expect(
      restoreBackup({ ...b, version: 999 }, "replace"),
    ).rejects.toThrow();
    expect(await db.prospects.count()).toBe(1);
    expect(() =>
      validateBackup({
        ...b,
        notes: [
          {
            id: "n",
            prospectId: "onbekend",
            content: "test",
            createdAt: now(),
            updatedAt: now(),
          },
        ],
      }),
    ).toThrow("verwijzingen");
  });
  it("voert een echte schema-1 migratie naar schema-2 uit", async () => {
    const name = "migration-" + uid();
    const old = new Dexie(name);
    old.version(1).stores({
      prospects: "id,companyName,status,priority,updatedAt",
      notes: "id,prospectId,createdAt",
      followups: "id,prospectId,dueAt",
      calls: "id,prospectId,initiatedAt",
      activities: "id,prospectId,createdAt",
      drafts: "id,prospectId",
      settings: "key",
    });
    await old.open();
    const p = company();
    await old.table("prospects").add({ ...p, phoneNormalized: "" });
    old.close();
    const upgraded = new ProspectDatabase(name);
    await upgraded.open();
    expect((await upgraded.prospects.get(p.id))?.phoneNormalized).toBe(
      "+31301234567",
    );
    await upgraded.delete();
  });
});

describe("Importkeuzes en behoud van werk", () => {
  it("werkt alleen basisgegevens bij na expliciete keuze", async () => {
    const p = company();
    await saveProspect({
      ...p,
      status: "INTERESTED",
      priority: "HIGH",
      tags: ["Demo"],
    });
    await saveNote(p.id, "Behoud deze notitie");
    const incoming = company("Nieuwe handelsnaam", {
      city: "Amsterdam",
      valueProposition: "Nieuwe broninformatie",
    });
    const result = await importProspects([incoming], "update");
    const saved = await db.prospects.get(p.id);
    expect(result.updated).toBe(1);
    expect(saved?.companyName).toBe("Nieuwe handelsnaam");
    expect(saved?.status).toBe("INTERESTED");
    expect(saved?.priority).toBe("HIGH");
    expect(saved?.tags).toEqual(["Demo"]);
    expect(await db.notes.count()).toBe(1);
  });
  it("importeert duplicaten uitsluitend op expliciet verzoek als nieuw", async () => {
    await saveProspect(company());
    const result = await importProspects([company()], "new");
    expect(result.added).toBe(1);
    expect(await db.prospects.count()).toBe(2);
  });
  it("isoleert onvolledige CSV-rijen en behoudt de overige rijen", async () => {
    const raw = await readImport(
      new File(
        [
          "Bedrijf;Plaats;Telefoon\nGoed;Utrecht;0301234567\nOnvolledig;Utrecht\nOok goed;Amersfoort;0612345678",
        ],
        "rijen.csv",
      ),
    );
    const result = previewImport(raw, autoMapping(raw.headers), []);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
  });
  it("neemt expliciete status en prioriteit uit een JSON-lijst over", async () => {
    const raw = await readImport(
      new File(
        [
          JSON.stringify([
            { companyName: "Fictief", status: "INTERESTED", priority: "HIGH" },
          ]),
        ],
        "test.json",
      ),
    );
    const result = previewImport(raw, autoMapping(raw.headers), []);
    expect(result.valid[0].status).toBe("INTERESTED");
    expect(result.valid[0].priority).toBe("HIGH");
  });
  it("neemt invoerconcepten op in een back-up en herstelt deze", async () => {
    await db.settings.put({
      key: "note-draft-test",
      value: "Nog niet opgeslagen notitie",
    });
    const backup = await makeBackup();
    await db.settings.clear();
    await restoreBackup(backup);
    expect((await db.settings.get("note-draft-test"))?.value).toBe(
      "Nog niet opgeslagen notitie",
    );
  });
  it("belt toekomstige opvolgingen niet te vroeg", () => {
    const p = company("Toekomst", { status: "CALLBACK" });
    expect(
      callingQueue(
        [p],
        [follow(p.id, new Date(2026, 10, 10))],
        new Date(2026, 9, 28),
      ),
    ).toEqual([]);
  });
});

describe("Lokale bedrijfsafbeeldingen", () => {
  const raster =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1xoAAAAASUVORK5CYII=";
  it("behoudt een lokaal logo in een volledige back-up en herstel", async () => {
    const p = company("Fictief met logo", { logoDataUrl: raster });
    await saveProspect(p);
    const backup = await makeBackup();
    await db.prospects.clear();
    await restoreBackup(backup);
    expect((await db.prospects.get(p.id))?.logoDataUrl).toBe(raster);
  });
  it("accepteert oudere records zonder logo en weigert actieve of externe afbeeldingen", () => {
    expect(company().logoDataUrl).toBeUndefined();
    expect(() =>
      company("SVG", { logoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }),
    ).toThrow();
    expect(() =>
      company("Extern", { logoDataUrl: "https://tracker.example/logo.png" }),
    ).toThrow();
  });
});
