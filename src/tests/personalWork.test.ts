import { describe, it, expect } from "vitest";
import {
  buildPersonalWork,
  filterPersonalWork,
  type PersonalWorkData,
} from "../lib/personalWork";
import { createProspect, now, uid } from "../lib/models";
const p = createProspect({
  companyName: "Fictief Eigen Bedrijf",
  city: "Utrecht",
  phone: "0301234567",
});
const base = (): PersonalWorkData => ({
  prospects: [p],
  notes: [],
  followups: [],
  calls: [],
  drafts: [],
  activities: [],
  settings: [],
});
describe("Persoonlijk opgeslagen werk", () => {
  it("houdt de geïmporteerde catalogus uit Mijn werk en neemt alle oudere notities mee", () => {
    const data = base();
    data.prospects.push(
      createProspect({ companyName: "Fictief Geïmporteerd" }),
    );
    data.activities = [
      {
        id: uid(),
        prospectId: data.prospects[1].id,
        type: "IMPORTED",
        description: "Openbare vermelding",
        createdAt: now(),
      },
    ];
    expect(buildPersonalWork(data).companyCount).toBe(0);
    data.notes = Array.from({ length: 8 }, (_, i) => ({
      id: uid(),
      prospectId: p.id,
      content:
        i === 0
          ? "Café afspraak: eigenaar vraagt een offerte"
          : "Andere notitie " + i,
      createdAt: `2026-10-${String(10 + i).padStart(2, "0")}T10:00:00.000Z`,
      updatedAt: `2026-10-${String(10 + i).padStart(2, "0")}T10:00:00.000Z`,
    }));
    const work = buildPersonalWork(data);
    expect(work.counts.notes).toBe(8);
    expect(work.companyCount).toBe(1);
    const found = filterPersonalWork(work.items, "notes", "cafe offerte");
    expect(found).toHaveLength(1);
    expect(found[0].href).toContain(`#note-${data.notes[0].id}`);
  });
  it("vindt een opgeslagen terugbelstatus zonder aparte taak en behoudt een bekende datum", () => {
    const data = base();
    data.prospects = [
      { ...p, status: "CALLBACK", followUpAt: "2026-11-01T12:00:00.000Z" },
    ];
    const work = buildPersonalWork(data);
    expect(work.openFollowups).toBe(1);
    expect(work.items.find((i) => i.type === "followups")?.dueAt).toBe(
      "2026-11-01T12:00:00.000Z",
    );
    data.followups = [
      {
        id: uid(),
        prospectId: p.id,
        title: "Terugbellen",
        description: "Bestaande afspraak",
        dueAt: "2026-11-01T12:00:00.000Z",
        dateOnly: false,
        completedAt: null,
        createdAt: now(),
      },
    ];
    expect(buildPersonalWork(data).counts.followups).toBe(1);
  });
  it("houdt afgeronde afspraken vindbaar en plaatst ze na open afspraken", () => {
    const data = base();
    const task = {
      id: uid(),
      prospectId: p.id,
      title: "Open afspraak",
      description: "",
      dueAt: "2026-11-01T12:00:00.000Z",
      dateOnly: false,
      completedAt: null,
      createdAt: now(),
    };
    data.followups = [
      {
        ...task,
        id: uid(),
        title: "Afgerond",
        dueAt: "2026-10-01T12:00:00.000Z",
        completedAt: now(),
      },
      task,
    ];
    const work = buildPersonalWork(data);
    const found = filterPersonalWork(work.items, "followups", "");
    expect(found.map((i) => i.title)).toEqual(["Open afspraak", "Afgerond"]);
    expect(filterPersonalWork(work.items, "followups", "", false)).toHaveLength(
      1,
    );
  });
  it("vindt opgeslagen invoer zonder een verzonnen opslagdatum en koppelt het juiste concept", () => {
    const data = base();
    data.settings = [
      { key: `note-draft-${p.id}`, value: "Nog niet afgemaakte notitie" },
      { key: `call-summary-${p.id}`, value: "Gespreksinvoer" },
      { key: "directory-filters", value: { search: "geen notitie" } },
    ];
    data.drafts = [
      {
        id: "ouder-concept",
        prospectId: p.id,
        recipient: "contact@example.org",
        subject: "Voorstel",
        body: "Exact opgeslagen bericht",
        template: 0,
        tone: "Zakelijk",
        updatedAt: now(),
      },
    ];
    const work = buildPersonalWork(data);
    expect(work.items.filter((i) => i.working)).toHaveLength(2);
    expect(
      work.items.filter((i) => i.working).every((i) => i.at === null),
    ).toBe(true);
    expect(work.items.find((i) => i.type === "drafts")?.href).toContain(
      "draft=ouder-concept",
    );
    expect(
      filterPersonalWork(work.items, "all", "exact opgeslagen bericht"),
    ).toHaveLength(1);
  });
  it("leest bestaande records zonder ook maar één waarde te wijzigen", () => {
    const data = base();
    data.notes = [
      {
        id: uid(),
        prospectId: p.id,
        content: "Blijft exact behouden",
        createdAt: now(),
        updatedAt: now(),
      },
    ];
    data.calls = [
      {
        id: uid(),
        prospectId: p.id,
        initiatedAt: now(),
        outcome: null,
        confirmedAt: null,
        summary: "",
        durationSeconds: null,
      },
    ];
    const before = JSON.stringify(data);
    const work = buildPersonalWork(data);
    for (const filter of [
      "all",
      "notes",
      "followups",
      "calls",
      "drafts",
      "companies",
      "activity",
    ] as const)
      filterPersonalWork(work.items, filter, "");
    expect(JSON.stringify(data)).toBe(before);
    expect(work.items.find((i) => i.type === "calls")?.title).toBe(
      "Uitkomst nog invullen",
    );
    expect(work.items.find((i) => i.type === "calls")?.href).toContain(
      `call=${data.calls[0].id}#call-summary`,
    );
  });
});
