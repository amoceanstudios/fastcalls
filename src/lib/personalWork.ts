import {
  normalizeText,
  outcomes,
  statuses,
  type Prospect,
  type Note,
  type FollowUp,
  type Call,
  type Draft,
  type Activity,
} from "./models";
export type WorkFilter =
  "all" | "notes" | "followups" | "calls" | "drafts" | "companies" | "activity";
export const workFilters: Record<WorkFilter, string> = {
  all: "Alles",
  notes: "Notities",
  followups: "Terugbellen",
  calls: "Belhistorie",
  drafts: "Conceptmails",
  companies: "Mijn bedrijven",
  activity: "Activiteit",
};
export type PersonalWorkData = {
  prospects: Prospect[];
  notes: Note[];
  followups: FollowUp[];
  calls: Call[];
  drafts: Draft[];
  activities: Activity[];
  settings: { key: string; value: unknown }[];
};
export type WorkItem = {
  id: string;
  type: Exclude<WorkFilter, "all">;
  company: Prospect;
  title: string;
  content: string;
  at: string | null;
  href: string;
  label: string;
  completed?: boolean;
  dueAt?: string;
  dateOnly?: boolean;
  followup?: FollowUp;
  working?: boolean;
  pending?: boolean;
};
const imported = new Set(["IMPORTED", "IMPORT_UPDATED"]);
const companyChanges = new Set(["STATUS_CHANGED", "PROSPECT_UPDATED"]);
const url = (p: Prospect, tab: string, hash = "") =>
  `/prospects/${encodeURIComponent(p.id)}?tab=${tab}${hash}`;
export function buildPersonalWork(data: PersonalWorkData) {
  const companies = new Map(data.prospects.map((p) => [p.id, p]));
  const items: WorkItem[] = [];
  const worked = new Set<string>();
  const add = (item: WorkItem) => {
    items.push(item);
    worked.add(item.company.id);
  };
  for (const n of data.notes) {
    const p = companies.get(n.prospectId);
    if (p)
      add({
        id: `note:${n.id}`,
        type: "notes",
        company: p,
        title: "Opgeslagen notitie",
        content: n.content,
        at: n.updatedAt,
        href: url(p, "notes", `#note-${encodeURIComponent(n.id)}`),
        label: "Notitie",
      });
  }
  for (const f of data.followups) {
    const p = companies.get(f.prospectId);
    if (p)
      add({
        id: `followup:${f.id}`,
        type: "followups",
        company: p,
        title: f.title,
        content: f.description,
        at: f.completedAt || f.createdAt,
        href: url(p, "followups", `#followup-${encodeURIComponent(f.id)}`),
        label: f.completedAt ? "Afgerond" : "Terugbellen / opvolgen",
        completed: Boolean(f.completedAt),
        dueAt: f.dueAt,
        dateOnly: f.dateOnly,
        followup: f,
      });
  }
  for (const c of data.calls) {
    const p = companies.get(c.prospectId);
    if (p)
      add({
        id: `call:${c.id}`,
        type: "calls",
        company: p,
        title: c.outcome ? outcomes[c.outcome] : "Uitkomst nog invullen",
        content: c.summary,
        at: c.confirmedAt || c.initiatedAt,
        href: c.outcome
          ? url(p, "calls", `#call-${encodeURIComponent(c.id)}`)
          : `${url(p, "calls")}&call=${encodeURIComponent(c.id)}#call-summary`,
        pending: !c.outcome,
        label: c.outcome ? "Belhistorie" : "Gestarte belactie",
      });
  }
  for (const d of data.drafts) {
    const p = companies.get(d.prospectId);
    if (p)
      add({
        id: `draft:${d.id}`,
        type: "drafts",
        company: p,
        title: d.subject || "Concept zonder onderwerp",
        content: [d.recipient, d.body].filter(Boolean).join("\n"),
        at: d.updatedAt,
        href: `${url(p, "notes")}&draft=${encodeURIComponent(d.id)}`,
        label: "Concept · niet verstuurd",
      });
  }
  for (const setting of data.settings) {
    const prefix = setting.key.startsWith("note-draft-")
      ? "note-draft-"
      : setting.key.startsWith("call-summary-")
        ? "call-summary-"
        : null;
    if (!prefix || typeof setting.value !== "string" || !setting.value.trim())
      continue;
    const p = companies.get(setting.key.slice(prefix.length));
    if (p)
      add({
        id: `working:${setting.key}`,
        type: prefix === "note-draft-" ? "notes" : "calls",
        company: p,
        title:
          prefix === "note-draft-"
            ? "Verder met uw notitie"
            : "Verder met uw gespreksnotitie",
        content: setting.value,
        at: null,
        href: url(
          p,
          prefix === "note-draft-" ? "notes" : "calls",
          prefix === "note-draft-" ? "#note-input" : "#call-summary",
        ),
        label: "Invoer bewaard · nog niet definitief opgeslagen",
        working: true,
      });
  }
  const changes = new Map<string, Activity>();
  for (const activity of data.activities) {
    const p = companies.get(activity.prospectId);
    if (!p || imported.has(activity.type)) continue;
    worked.add(p.id);
    if (
      companyChanges.has(activity.type) &&
      (!changes.has(p.id) || changes.get(p.id)!.createdAt < activity.createdAt)
    )
      changes.set(p.id, activity);
    items.push({
      id: `activity:${activity.id}`,
      type: "activity",
      company: p,
      title: activity.description,
      content: "",
      at: activity.createdAt,
      href: url(p, "activity"),
      label: "Opgeslagen actie",
    });
  }
  for (const p of data.prospects) if (p.status !== "TO_CALL") worked.add(p.id);
  for (const id of worked) {
    const p = companies.get(id);
    if (!p) continue;
    const change = changes.get(id);
    items.push({
      id: `company:${p.id}`,
      type: "companies",
      company: p,
      title: statuses[p.status],
      content:
        change?.description ||
        "Uw notities, gesprekken en afspraken staan bij dit bedrijf.",
      at: change?.createdAt || p.updatedAt,
      href: url(p, "notes"),
      label: "Mijn bedrijf",
    });
    // A saved CALLBACK status must remain findable even without a scheduled task.
    if (
      p.status === "CALLBACK" &&
      !data.followups.some((f) => f.prospectId === p.id && !f.completedAt)
    )
      items.push({
        id: `callback:${p.id}`,
        type: "followups",
        company: p,
        title: p.followUpAt ? "Terugbellen" : "Terugbellen · datum nog plannen",
        content:
          "Dit bedrijf staat op Terugbellen. Er is nog geen openstaande afspraak gepland.",
        at: p.updatedAt,
        href: url(p, "followups"),
        label: p.followUpAt ? "Terugbellen" : "Terugbellen zonder datum",
        dueAt: p.followUpAt || undefined,
        completed: false,
      });
  }
  items.sort(
    (a, b) =>
      Number(Boolean(b.working)) - Number(Boolean(a.working)) ||
      (b.at || "").localeCompare(a.at || "") ||
      a.id.localeCompare(b.id),
  );
  const counts = Object.fromEntries(
    Object.keys(workFilters).map((key) => [
      key,
      key === "all"
        ? items.filter((item) => item.type !== "activity").length
        : items.filter((item) => item.type === key).length,
    ]),
  ) as Record<WorkFilter, number>;
  return {
    items,
    counts,
    companyCount: worked.size,
    openFollowups: items.filter(
      (item) => item.type === "followups" && !item.completed,
    ).length,
  };
}
export function filterPersonalWork(
  items: WorkItem[],
  filter: WorkFilter,
  search: string,
  showCompleted = true,
) {
  const terms = normalizeText(search).split(" ").filter(Boolean);
  const result = items.filter(
    (item) =>
      (filter === "all" ? item.type !== "activity" : item.type === filter) &&
      (showCompleted || !item.completed) &&
      terms.every((term) =>
        normalizeText(
          [
            item.company.companyName,
            item.company.city,
            item.company.phone,
            item.company.email,
            item.company.sector,
            statuses[item.company.status],
            item.title,
            item.content,
            item.label,
          ].join(" "),
        ).includes(term),
      ),
  );
  return filter === "followups"
    ? result.sort(
        (a, b) =>
          Number(Boolean(a.completed)) - Number(Boolean(b.completed)) ||
          (a.dueAt || "9999").localeCompare(b.dueAt || "9999"),
      )
    : result;
}
