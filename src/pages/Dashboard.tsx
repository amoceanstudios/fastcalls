import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Phone,
  CalendarDays,
  Plus,
  Upload,
  Check,
} from "lucide-react";
import { isSameDay } from "date-fns";
import { db } from "../db/database";
import { callingQueue, dateLabel, groupFollowUp } from "../lib/logic";
import { CallButton, StatusBadge } from "../components/ui";
import { ProspectForm } from "../components/forms";
import { useMinute } from "../hooks/useMinute";

export default function Dashboard() {
  const minute = useMinute();
  const data = useLiveQuery(async () => ({
    prospects: await db.prospects.toArray(),
    followups: await db.followups.toArray(),
    activities: await db.activities
      .orderBy("createdAt")
      .reverse()
      .limit(5)
      .toArray(),
    notes: await db.notes.orderBy("createdAt").reverse().limit(3).toArray(),
    calls: await db.calls.toArray(),
  }));
  const [add, setAdd] = useState(false);
  const [search, setSearch] = useState("");
  const summary = useMemo(() => {
    if (!data) return null;
    const today = new Date();
    const { prospects, followups, calls } = data;
    const todayCalls = calls.filter((call) =>
      isSameDay(new Date(call.initiatedAt), today),
    );
    const confirmed = todayCalls.filter((call) => call.outcome);
    const tasks = followups
      .filter(
        (task) =>
          !task.completedAt &&
          ["Vandaag", "Achterstallig"].includes(groupFollowUp(task)),
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    return {
      next: callingQueue(prospects, followups)[0],
      tasks,
      todayCalls,
      confirmed,
      conversations: confirmed.filter((call) =>
        ["SPOKEN", "INTERESTED", "CALLBACK"].includes(call.outcome!),
      ).length,
      completed: followups.filter(
        (task) =>
          task.completedAt && isSameDay(new Date(task.completedAt), today),
      ).length,
      companyNames: new Map(
        prospects.map((prospect) => [prospect.id, prospect.companyName]),
      ),
      nextScheduled: followups
        .filter((task) => !task.completedAt && new Date(task.dueAt) > today)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0],
      overdue: tasks.filter((task) => groupFollowUp(task) === "Achterstallig")
        .length,
    };
  }, [data, minute]);
  if (!data || !summary) return <p role="status">Overzicht laden…</p>;
  const { prospects, activities, notes } = data;
  const { next, tasks, todayCalls, confirmed, companyNames } = summary;
  const metrics = [
    { label: "Prospects", value: prospects.length, to: "/prospects" },
    {
      label: "Te bellen",
      value: prospects.filter((p) => p.status === "TO_CALL").length,
      to: "/prospects?status=TO_CALL",
    },
    {
      label: "Geïnteresseerd",
      value: prospects.filter((p) => p.status === "INTERESTED").length,
      to: "/prospects?status=INTERESTED",
    },
    {
      label: "Opvolging vandaag",
      value: tasks.length - summary.overdue,
      to: "/followups",
    },
  ];
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">WERKRUIMTE</div>
          <h1>Overzicht</h1>
          <p>Uw volgende actie, op één plek.</p>
        </div>
        <button className="primary" onClick={() => setAdd(true)}>
          <Plus size={16} />
          Prospect toevoegen
        </button>
      </header>
      <div className="metric-grid">
        {metrics.map((metric) => (
          <Link className="metric" key={metric.label} to={metric.to}>
            <span className="metric-label">{metric.label}</span>
            <strong>{metric.value}</strong>
            <ArrowUpRight className="metric-arrow" size={15} />
          </Link>
        ))}
      </div>
      {!prospects.length ? (
        <section className="welcome-panel">
          <div className="welcome-copy">
            <span className="eyebrow">AAN DE SLAG</span>
            <h2>
              Uw eerste gesprek begint
              <br />
              met uw bedrijvenlijst.
            </h2>
            <p>
              Importeer Excel of CSV. Daarna staan bellen, notities en opvolging
              direct klaar.
            </p>
            <Link className="button primary" to="/data">
              <Upload size={16} />
              Bedrijvenlijst importeren
              <ArrowRight size={16} />
            </Link>
            <span className="small muted">
              Alle gegevens blijven op dit apparaat.
            </span>
          </div>
          <div className="onboarding-steps" aria-label="Aan de slag">
            <div>
              <span>01</span>
              <p>
                <strong>Importeer</strong>Uw bedrijven, ongewijzigd overgenomen.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Maak contact</strong>Bel direct vanuit een
                bedrijfsprofiel.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Volg op</strong>Leg het gesprek en de volgende stap
                vast.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="next-panel">
          <div className="next-copy">
            <div className="section-title">
              <span className="eyebrow">VOLGENDE ACTIE</span>
              {next && <StatusBadge p={next} />}
            </div>
            {next ? (
              <>
                <h2>{next.companyName}</h2>
                <p className="muted next-meta">
                  {[next.city, next.sector].filter(Boolean).join(" · ")}
                </p>
                <p className="opportunity">
                  {next.valueProposition ||
                    "Bekijk het bedrijf en verken samen de mogelijkheden."}
                </p>
                <div className="action-row wrap">
                  <CallButton p={next} large />
                  <Link className="button" to={`/prospects/${next.id}`}>
                    Bekijk bedrijf
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2>Alles bijgewerkt.</h2>
                <p className="muted">
                  Er staan nu geen prospects klaar voor een belactie.
                </p>
                <Link className="button" to="/followups">
                  Bekijk opvolgingen
                  <ArrowRight size={16} />
                </Link>
              </>
            )}
          </div>
          <Link className="calling-shortcut" to="/calling">
            <span className="shortcut-icon">
              <Phone size={19} />
            </span>
            <div>
              <strong>Belmodus</strong>
              <p>
                Eén bedrijf tegelijk.
                <br />
                Alle aandacht voor het gesprek.
              </p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        </section>
      )}
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-title">
            <h2>
              Op de agenda<span className="count">{tasks.length}</span>
            </h2>
            <Link className="text-link" to="/followups">
              Alles bekijken
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {tasks.length ? (
            tasks.slice(0, 5).map((task) => (
              <Link
                className="task-row"
                key={task.id}
                to={`/prospects/${task.prospectId}`}
              >
                <span
                  className={`task-dot ${groupFollowUp(task) === "Achterstallig" ? "overdue" : ""}`}
                >
                  <CalendarDays size={16} />
                </span>
                <span>
                  <strong>{companyNames.get(task.prospectId)}</strong>
                  <small>
                    {task.title} · {dateLabel(task.dueAt, task.dateOnly)}
                  </small>
                </span>
                <ArrowUpRight size={15} />
              </Link>
            ))
          ) : (
            <div className="quiet-empty">
              <Check size={20} />
              <strong>Geen opvolgingen voor vandaag</strong>
              <p>Plan een volgende stap vanuit een bedrijf.</p>
            </div>
          )}
          {!tasks.length && summary.nextScheduled && (
            <Link
              className="task-row"
              to={`/prospects/${summary.nextScheduled.prospectId}`}
            >
              <span className="task-dot">
                <CalendarDays size={16} />
              </span>
              <span>
                <strong>
                  {companyNames.get(summary.nextScheduled.prospectId)}
                </strong>
                <small>
                  Volgende opvolging ·{" "}
                  {dateLabel(
                    summary.nextScheduled.dueAt,
                    summary.nextScheduled.dateOnly,
                  )}
                </small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
          )}
          {summary.overdue > 0 && (
            <p className="small red">{summary.overdue} achterstallig</p>
          )}
        </section>
        <section className="panel progress-panel">
          <div className="section-title">
            <h2>Vandaag</h2>
            <span className="small muted">Uw activiteit</span>
          </div>
          <div className="progress-number">
            {todayCalls.length}
            <span>belacties gestart</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Bevestigde beluitkomsten"
            aria-valuemin={0}
            aria-valuemax={Math.max(todayCalls.length, 1)}
            aria-valuenow={confirmed.length}
          >
            <div
              style={{
                width: `${todayCalls.length ? (confirmed.length / todayCalls.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="small muted">
            {confirmed.length} bevestigd ·{" "}
            {todayCalls.length - confirmed.length} nog vast te leggen
          </p>
          <div className="progress-stats">
            <span>
              <strong>{summary.conversations}</strong>Gesprekken
            </span>
            <span>
              <strong>{summary.completed}</strong>Opvolgingen afgerond
            </span>
            <span>
              <strong>
                {prospects.filter((p) => p.status === "PROPOSAL_SENT").length}
              </strong>
              Offertes (totaal)
            </span>
          </div>
        </section>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-title">
            <h2>Recente activiteit</h2>
          </div>
          {activities.length ? (
            activities.map((item) => (
              <Link
                className="activity-row"
                key={item.id}
                to={`/prospects/${item.prospectId}`}
              >
                <span className="activity-dot" />
                <div>
                  <strong>{companyNames.get(item.prospectId)}</strong>
                  <p>{item.description}</p>
                  <small>{dateLabel(item.createdAt)}</small>
                </div>
              </Link>
            ))
          ) : (
            <p className="muted small padded">
              Uw eerste acties verschijnen hier.
            </p>
          )}
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Snel naar een bedrijf</h2>
          </div>
          <input
            aria-label="Snel prospects zoeken"
            placeholder="Bedrijfsnaam of plaats…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search &&
            prospects
              .filter((p) =>
                `${p.companyName} ${p.city}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .slice(0, 5)
              .map((prospect) => (
                <Link
                  className="task-row"
                  key={prospect.id}
                  to={`/prospects/${prospect.id}`}
                >
                  <strong>{prospect.companyName}</strong>
                  <ArrowRight size={15} />
                </Link>
              ))}
          {notes[0] && (
            <>
              <h3>Laatste notitie</h3>
              <Link
                className="note-preview"
                to={`/prospects/${notes[0].prospectId}`}
              >
                {notes[0].content}
              </Link>
            </>
          )}
          {!notes.length && !search && (
            <p className="muted small padded">
              Zoek direct in uw eigen bedrijvenlijst.
            </p>
          )}
        </section>
      </div>
      {add && <ProspectForm onClose={() => setAdd(false)} />}
    </>
  );
}
