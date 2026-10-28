import { describe, it, expect } from "vitest";
import { summarizeDashboard, type DashboardData } from "../lib/dashboard";
import { createProspect, uid, type FollowUp, type Call } from "../lib/models";
const today = new Date(2026, 9, 28, 11);
const stamp = (day: number, hour = 10) =>
  new Date(2026, 9, day, hour).toISOString();
const base = (): DashboardData => ({
  prospects: [],
  followups: [],
  calls: [],
  notes: [],
  activities: [],
});
const task = (
  prospectId: string,
  day: number,
  completedAt: string | null = null,
): FollowUp => ({
  id: uid(),
  prospectId,
  title: "Fictieve terugbelafspraak",
  description: "",
  dueAt: stamp(day),
  dateOnly: false,
  completedAt,
  createdAt: stamp(26),
});
const call = (prospectId: string, fields: Partial<Call> = {}): Call => ({
  id: uid(),
  prospectId,
  initiatedAt: stamp(28),
  outcome: null,
  confirmedAt: null,
  summary: "",
  durationSeconds: null,
  ...fields,
});
describe("Dagoverzicht", () => {
  it("zet achterstallig boven vandaag en scheidt afgeronde en toekomstige taken", () => {
    const p = createProspect({ companyName: "Fictief bedrijf" });
    const data = base();
    data.prospects = [p];
    const late = task(p.id, 27),
      due = task(p.id, 28),
      future = task(p.id, 29);
    data.followups = [future, task(p.id, 26, stamp(28)), due, late];
    const summary = summarizeDashboard(data, today);
    expect(summary.due.map((item) => item.id)).toEqual([late.id, due.id]);
    expect(summary.upcoming?.id).toBe(future.id);
    expect(summary.completedToday).toBe(1);
  });
  it("legt uit waarom een geïnteresseerde prospect eerst teruggebeld moet worden", () => {
    const due = createProspect({
      companyName: "Fictief opvolgen",
      status: "INTERESTED",
      priority: "LOW",
    });
    const high = createProspect({
      companyName: "Fictief nieuw",
      priority: "HIGH",
    });
    const data = base();
    data.prospects = [high, due];
    data.followups = [task(due.id, 27)];
    const summary = summarizeDashboard(data, today);
    expect(summary.next?.id).toBe(due.id);
    expect(summary.reason).toBe("Achterstallige opvolging");
    expect(summary.statusCounts.get("INTERESTED")).toBe(1);
  });
  it("onderscheidt belacties, bevestigde gesprekken en nog onbekende uitkomsten", () => {
    const p = createProspect({ companyName: "Fictieve gesprekspartner" });
    const data = base();
    data.prospects = [p];
    const pending = call(p.id);
    data.calls = [
      pending,
      call(p.id, {
        initiatedAt: stamp(27),
        outcome: "SPOKEN",
        confirmedAt: stamp(28),
      }),
      call(p.id, { outcome: "NO_ANSWER", confirmedAt: stamp(28) }),
      call("missing"),
    ];
    const summary = summarizeDashboard(data, today);
    expect(summary.startedToday).toBe(3);
    expect(summary.conversationsToday).toBe(1);
    expect(summary.confirmedToday).toBe(2);
    expect(summary.pendingCalls.map((item) => item.id)).toEqual([pending.id]);
  });
  it("toont geen gesloten bedrijven als volgende actie en kan leeg beginnen", () => {
    const data = base();
    data.prospects = [
      createProspect({ companyName: "Fictief afgerond", status: "COMPLETED" }),
      createProspect({
        companyName: "Fictief niet interessant",
        status: "NOT_INTERESTED",
      }),
    ];
    expect(summarizeDashboard(data, today).next).toBeUndefined();
    const empty = summarizeDashboard(base(), today);
    expect(empty.queue).toEqual([]);
    expect(empty.startedToday).toBe(0);
    expect(empty.pendingCalls).toEqual([]);
  });
});
