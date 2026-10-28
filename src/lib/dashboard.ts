import { isSameDay, startOfDay } from "date-fns";
import { callingQueue } from "./logic";
import {
  type Prospect,
  type FollowUp,
  type Call,
  type Activity,
  type Note,
} from "./models";
export type DashboardData = {
  prospects: Prospect[];
  followups: FollowUp[];
  calls: Call[];
  activities: Activity[];
  notes: Note[];
};

export function summarizeDashboard(data: DashboardData, today = new Date()) {
  const companies = new Map(
    data.prospects.map((company) => [company.id, company]),
  );
  const open = data.followups
    .filter((task) => !task.completedAt && companies.has(task.prospectId))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const overdue = open.filter(
    (task) => new Date(task.dueAt) < startOfDay(today),
  );
  const dueToday = open.filter((task) =>
    isSameDay(new Date(task.dueAt), today),
  );
  const upcoming = open.find(
    (task) =>
      new Date(task.dueAt) > today && !isSameDay(new Date(task.dueAt), today),
  );
  const scheduledIds = new Set(open.map((task) => task.prospectId));
  const unscheduled = data.prospects.filter(
    (p) =>
      (p.status === "CALLBACK" || p.status === "FOLLOW_UP") &&
      !scheduledIds.has(p.id),
  );
  const queue = callingQueue(data.prospects, open, today);
  const pendingCalls = data.calls
    .filter((call) => !call.outcome && companies.has(call.prospectId))
    .sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt));
  const startedToday = data.calls.filter((call) =>
    isSameDay(new Date(call.initiatedAt), today),
  );
  const confirmedToday = data.calls.filter(
    (call) =>
      call.outcome &&
      call.confirmedAt &&
      isSameDay(new Date(call.confirmedAt), today),
  );
  const next = queue[0];
  const nextTask = next
    ? open.find((task) => task.prospectId === next.id)
    : undefined;
  const reason =
    nextTask && new Date(nextTask.dueAt) < startOfDay(today)
      ? "Achterstallige opvolging"
      : nextTask && isSameDay(new Date(nextTask.dueAt), today)
        ? "Voor vandaag gepland"
        : next?.priority === "HIGH"
          ? "Hoge prioriteit"
          : "Volgende in uw belrij";
  const statusCounts = new Map<Prospect["status"], number>();
  for (const company of data.prospects)
    statusCounts.set(
      company.status,
      (statusCounts.get(company.status) ?? 0) + 1,
    );
  return {
    companies,
    queue,
    next,
    reason,
    overdue,
    dueToday,
    due: [...overdue, ...dueToday],
    upcoming,
    unscheduled,
    pendingCalls,
    statusCounts,
    startedToday: startedToday.length,
    confirmedToday: confirmedToday.length,
    conversationsToday: confirmedToday.filter((call) =>
      ["SPOKEN", "INTERESTED", "CALLBACK"].includes(call.outcome!),
    ).length,
    completedToday: data.followups.filter(
      (task) =>
        task.completedAt && isSameDay(new Date(task.completedAt), today),
    ).length,
  };
}
