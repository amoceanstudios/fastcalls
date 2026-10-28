import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  CalendarDays,
  Building2,
  Mail,
  ArrowRight,
} from "lucide-react";
import { buildPersonalWork, type PersonalWorkData } from "../lib/personalWork";
import { WorkCard } from "./WorkCard";
export function PersonalOverview({ data }: { data: PersonalWorkData }) {
  const work = useMemo(() => buildPersonalWork(data), [data]);
  const note = work.items.find((item) => item.type === "notes");
  const upcoming = work.items
    .filter((item) => item.type === "followups" && !item.completed)
    .sort((a, b) => (a.dueAt || "9999").localeCompare(b.dueAt || "9999"))[0];
  const shortcuts = [
    {
      filter: "notes",
      label: "Mijn notities",
      count: work.counts.notes,
      icon: MessageSquare,
    },
    {
      filter: "followups",
      label: "Terugbellen",
      count: work.openFollowups,
      icon: CalendarDays,
    },
    {
      filter: "companies",
      label: "Mijn bedrijven",
      count: work.companyCount,
      icon: Building2,
    },
    {
      filter: "drafts",
      label: "Conceptmails",
      count: work.counts.drafts,
      icon: Mail,
    },
  ];
  return (
    <section
      className="personal-overview"
      aria-labelledby="personal-overview-title"
    >
      <div className="personal-section-title">
        <div>
          <h2 id="personal-overview-title">Uw opgeslagen werk</h2>
          <p>Direct terug naar wat u hebt bewaard.</p>
        </div>
        <Link to="/work">
          Alles bekijken
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="personal-shortcuts">
        {shortcuts.map((item) => (
          <Link to={`/work?filter=${item.filter}`} key={item.filter}>
            <item.icon size={20} />
            <strong>{item.count}</strong>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
      {(note || upcoming) && (
        <div className="personal-previews">
          {note && <WorkCard item={note} compact />}
          {upcoming && <WorkCard item={upcoming} compact />}
        </div>
      )}
      {!note && !upcoming && (
        <p className="small muted personal-hint">
          Uw notities en terugbelafspraken verschijnen hier zodra u ze bij een
          bedrijf opslaat.
        </p>
      )}
    </section>
  );
}
