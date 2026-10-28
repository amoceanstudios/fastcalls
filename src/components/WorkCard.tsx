import { Link, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  MessageSquare,
  CalendarDays,
  Phone,
  Mail,
  Building2,
  History,
} from "lucide-react";
import { dateLabel, groupFollowUp } from "../lib/logic";
import { useAction } from "./ui";
import { saveFollowUp } from "../db/database";
import { now } from "../lib/models";
import type { WorkItem } from "../lib/personalWork";
const icons = {
  notes: MessageSquare,
  followups: CalendarDays,
  calls: Phone,
  drafts: Mail,
  companies: Building2,
  activity: History,
};
export function WorkCard({
  item,
  compact = false,
}: {
  item: WorkItem;
  compact?: boolean;
}) {
  const location = useLocation();
  const state = { workReturn: location.pathname + location.search };
  const action = useAction();
  const Icon = icons[item.type];
  const when = item.dueAt
    ? [
        item.followup ? groupFollowUp(item.followup) : "",
        dateLabel(item.dueAt, item.dateOnly),
      ]
        .filter(Boolean)
        .join(" · ")
    : item.at
      ? dateLabel(item.at)
      : "Bewaarde invoer";
  return (
    <article
      className={`work-card ${compact ? "work-card--compact" : ""} ${item.completed ? "work-card--completed" : ""}`}
    >
      <div className="work-card-heading">
        <span className="work-kind">
          <Icon size={15} aria-hidden="true" />
          {item.label}
        </span>
        <span className="work-date">{when}</span>
      </div>
      <Link className="work-company-link" to={item.href} state={state}>
        <span>
          <strong>{item.company.companyName}</strong>
          <small>
            {[item.company.city, item.company.phone]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </span>
        <ArrowUpRight size={19} />
      </Link>
      <h3>{item.title}</h3>
      {item.content && (
        <p className={`work-content ${compact ? "work-content--preview" : ""}`}>
          {item.content}
        </p>
      )}
      <Link className="work-open" to={item.href} state={state}>
        {item.working
          ? "Verder schrijven"
          : item.type === "notes"
            ? "Notitie openen"
            : item.type === "drafts"
              ? "Concept openen"
              : item.type === "followups"
                ? "Afspraak openen"
                : item.pending
                  ? "Uitkomst invullen"
                  : "Bekijk bij bedrijf"}
        <ArrowUpRight size={15} />
      </Link>
      {!compact && item.followup && (
        <button
          className="work-complete"
          onClick={() =>
            void action(
              () =>
                saveFollowUp({
                  ...item.followup!,
                  completedAt: item.completed ? null : now(),
                }),
              item.completed ? "Afspraak heropend" : "Afspraak afgerond",
            )
          }
        >
          {item.completed ? "Opnieuw openen" : "Afspraak afronden"}
        </button>
      )}
    </article>
  );
}
