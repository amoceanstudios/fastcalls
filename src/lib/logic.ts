import { isSameDay, addDays, endOfWeek, startOfDay } from "date-fns";
import {
  normalizeText,
  type Prospect,
  type FollowUp,
  type Note,
} from "./models";
export const dateLabel = (value: string, dateOnly = false) =>
  new Intl.DateTimeFormat(
    "nl-NL",
    dateOnly
      ? { day: "numeric", month: "short", year: "numeric" }
      : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  ).format(new Date(value));
export const localInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function groupFollowUp(f: FollowUp, today = new Date()): string {
  if (f.completedAt) return "Afgerond";
  const due = new Date(f.dueAt);
  if (due < startOfDay(today)) return "Achterstallig";
  if (isSameDay(due, today)) return "Vandaag";
  if (isSameDay(due, addDays(today, 1))) return "Morgen";
  if (due <= endOfWeek(today, { weekStartsOn: 1 })) return "Deze week";
  return "Later";
}
const closed = (p: Prospect) =>
  ["NOT_INTERESTED", "COMPLETED", "CUSTOMER"].includes(p.status);
export function callingQueue(
  prospects: Prospect[],
  followups: FollowUp[],
  today = new Date(),
): Prospect[] {
  const due = new Map<string, number>();
  for (const f of followups.filter((f) => !f.completedAt)) {
    const t = new Date(f.dueAt).getTime();
    if (t < (due.get(f.prospectId) ?? Infinity)) due.set(f.prospectId, t);
  }
  const end = addDays(startOfDay(today), 1).getTime();
  const score = (p: Prospect) =>
    due.has(p.id) && due.get(p.id)! < end
      ? 0
      : due.has(p.id)
        ? 3
        : ["TO_CALL", "NO_ANSWER", "CALLBACK", "FOLLOW_UP"].includes(p.status)
          ? p.priority === "HIGH"
            ? 1
            : 2
          : 3;
  return prospects
    .filter((p) => !closed(p) && score(p) < 3)
    .sort(
      (a, b) =>
        score(a) - score(b) ||
        (score(a) === 0
          ? (due.get(a.id) ?? Infinity) - (due.get(b.id) ?? Infinity)
          : 0) ||
        { HIGH: 0, MEDIUM: 1, LOW: 2 }[a.priority] -
          { HIGH: 0, MEDIUM: 1, LOW: 2 }[b.priority] ||
        (a.originalNumber ?? Infinity) - (b.originalNumber ?? Infinity) ||
        a.companyName.localeCompare(b.companyName, "nl"),
    );
}
export type Filters = {
  search: string;
  status: string;
  sector: string;
  city: string;
  priority: string;
  followup: string;
  called: string;
  notes: string;
  contact: string;
  sort: string;
};
export const defaultFilters: Filters = {
  search: "",
  status: "",
  sector: "",
  city: "",
  priority: "",
  followup: "",
  called: "",
  notes: "",
  contact: "",
  sort: "original",
};
export function filterProspects(
  prospects: Prospect[],
  filters: Filters,
  notes: Note[] = [],
  today = new Date(),
): Prospect[] {
  const terms = normalizeText(filters.search).split(" ").filter(Boolean);
  return prospects
    .filter((p) => {
      const hay = normalizeText(
        [
          p.companyName,
          p.city,
          p.sector,
          p.phone,
          p.phoneNormalized,
          p.website,
          p.valueProposition,
          p.contactPerson,
          ...p.tags,
        ].join(" "),
      );
      const hasNotes = notes.some((n) => n.prospectId === p.id);
      const day = p.followUpAt
        ? groupFollowUp(
            { dueAt: p.followUpAt, completedAt: null } as FollowUp,
            today,
          )
        : "";
      return (
        terms.every((t) => hay.includes(t)) &&
        (!filters.status || p.status === filters.status) &&
        (!filters.sector || p.sector === filters.sector) &&
        (!filters.city || p.city === filters.city) &&
        (!filters.priority || p.priority === filters.priority) &&
        (!filters.followup ||
          (filters.followup === "none"
            ? !p.followUpAt
            : day === filters.followup)) &&
        (!filters.called ||
          (filters.called === "yes"
            ? !!p.lastContactedAt
            : !p.lastContactedAt)) &&
        (!filters.notes || (filters.notes === "yes" ? hasNotes : !hasNotes)) &&
        (!filters.contact ||
          (filters.contact === "yes" ? !!p.contactPerson : !p.contactPerson))
      );
    })
    .sort((a, b) => {
      switch (filters.sort) {
        case "az":
          return a.companyName.localeCompare(b.companyName, "nl");
        case "za":
          return b.companyName.localeCompare(a.companyName, "nl");
        case "city":
          return a.city.localeCompare(b.city, "nl");
        case "priority":
          return (
            { HIGH: 0, MEDIUM: 1, LOW: 2 }[a.priority] -
            { HIGH: 0, MEDIUM: 1, LOW: 2 }[b.priority]
          );
        case "updated":
          return b.updatedAt.localeCompare(a.updatedAt);
        case "followup":
          return (a.followUpAt ?? "9999").localeCompare(b.followUpAt ?? "9999");
        case "new":
          return Number(!!a.lastContactedAt) - Number(!!b.lastContactedAt);
        default:
          return (
            (a.originalNumber ?? Infinity) - (b.originalNumber ?? Infinity) ||
            a.companyName.localeCompare(b.companyName, "nl")
          );
      }
    });
}
export const templates = [
  "Eerste kennismaking",
  "Concrete mogelijkheid",
  "Na een gesprek",
  "Uitnodiging voor een demo",
  "Opvolging zonder reactie",
  "Kort en direct",
];
export const tones = [
  "Zakelijk",
  "Persoonlijk",
  "Kort en krachtig",
  "Consultatief",
  "Enthousiast maar professioneel",
];
