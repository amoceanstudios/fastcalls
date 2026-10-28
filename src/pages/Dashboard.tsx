import { useDeferredValue, useMemo, useRef, useState } from "react";
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
  Search,
  Clock3,
  MessageSquare,
  Activity,
  ChevronDown,
  CheckCheck,
  ArrowDownToLine,
  Settings2,
} from "lucide-react";
import { db, saveFollowUp } from "../db/database";
import { now, normalizeText, type FollowUp } from "../lib/models";
import { summarizeDashboard } from "../lib/dashboard";
import { dateLabel } from "../lib/logic";
import { Reveal } from "../components/Reveal";
import { Illustration } from "../components/Illustration";
import { CompanyMark } from "../components/CompanyMark";
import { CallButton, StatusBadge, useAction } from "../components/ui";
import { ProspectForm } from "../components/forms";
import { useMinute } from "../hooks/useMinute";

type AgendaFilter = "all" | "overdue" | "today";
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
  const deferredSearch = useDeferredValue(search);
  const [filter, setFilter] = useState<AgendaFilter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const agendaTitle = useRef<HTMLHeadingElement>(null);
  const action = useAction();
  const summary = useMemo(
    () => (data ? summarizeDashboard(data) : null),
    [data, minute],
  );
  const results = useMemo(() => {
    const term = normalizeText(deferredSearch);
    return term && data
      ? data.prospects
          .filter((company) =>
            normalizeText(
              `${company.companyName} ${company.city} ${company.sector} ${company.phone} ${company.contactPerson}`,
            ).includes(term),
          )
          .slice(0, 5)
      : [];
  }, [data, deferredSearch]);
  if (!data || !summary) return <p role="status">Overzicht laden…</p>;
  const { prospects, activities, notes } = data;
  const { next, companies, pendingCalls } = summary;
  const agenda =
    filter === "overdue"
      ? summary.overdue
      : filter === "today"
        ? summary.dueToday
        : summary.due;
  const stages = [
    { status: "TO_CALL" as const, label: "Nog te bellen" },
    { status: "INTERESTED" as const, label: "Geïnteresseerd" },
    { status: "PROPOSAL_SENT" as const, label: "Offerte gestuurd" },
    { status: "CUSTOMER" as const, label: "Klant geworden" },
  ];
  const complete = async (task: FollowUp) => {
    setBusy(task.id);
    const saved = await action(
      () => saveFollowUp({ ...task, completedAt: now() }),
      "Opvolging afgerond",
    );
    setBusy(null);
    if (saved)
      requestAnimationFrame(() =>
        agendaTitle.current?.focus({ preventScroll: true }),
      );
  };
  return (
    <div className="sales-overview">
      <header className="page-header overview-header">
        <div>
          <div className="eyebrow">UW WERKDAG</div>
          <h1>Overzicht</h1>
          <p>
            {new Intl.DateTimeFormat("nl-NL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}{" "}
            <span aria-hidden="true">·</span> Dit vraagt uw aandacht.
          </p>
        </div>
        <div
          className={`overview-tools ${!prospects.length ? "overview-tools--empty" : ""}`}
        >
          {prospects.length > 0 && (
            <div className="overview-search">
              <label className="search-box">
                <Search size={17} />
                <input
                  aria-label="Snel prospects zoeken"
                  placeholder="Zoek een bedrijf…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              {search && (
                <div
                  className="overview-search-results"
                  role="region"
                  aria-label="Gevonden bedrijven"
                >
                  {results.length ? (
                    results.map((company) => (
                      <Link key={company.id} to={`/prospects/${company.id}`}>
                        <span>
                          <strong>{company.companyName}</strong>
                          <small>{company.city}</small>
                        </span>
                        <ArrowUpRight size={16} />
                      </Link>
                    ))
                  ) : (
                    <p>Geen bedrijven gevonden.</p>
                  )}
                </div>
              )}
            </div>
          )}
          <button onClick={() => setAdd(true)}>
            <Plus size={16} />
            Bedrijf toevoegen
          </button>
        </div>
      </header>
      {!prospects.length ? (
        <>
          <Reveal className="welcome-panel overview-welcome">
            <div className="welcome-copy">
              <span className="eyebrow">1 · UW EERSTE STAP</span>
              <h2>
                Uw bedrijvenlijst erin.
                <br />
                Uw werkdag op orde.
              </h2>
              <p>
                Importeer uw Excel- of CSV-bestand. Daarna ziet u direct wie u
                kunt bellen en wat opvolging vraagt.
              </p>
              <Link className="button primary large" to="/data">
                <Upload size={18} />
                Bedrijvenlijst importeren
                <ArrowRight size={17} />
              </Link>
              <span className="small muted">
                Geen gegevens aangeleverd? Voeg ook handmatig een bedrijf toe.
              </span>
            </div>
            <div className="overview-welcome-art">
              <Illustration kind="onboarding" />
            </div>
          </Reveal>
          <div className="overview-setup" aria-label="Zo werkt uw dashboard">
            {[
              {
                number: "01",
                title: "Bedrijven toevoegen",
                text: "Importeer uw eigen lijst of voeg een bedrijf toe.",
                icon: Upload,
              },
              {
                number: "02",
                title: "Het volgende gesprek",
                text: "Uw eerstvolgende belactie staat direct klaar.",
                icon: Phone,
              },
              {
                number: "03",
                title: "Geen opvolging vergeten",
                text: "Vandaag en achterstallig krijgen een eigen plek.",
                icon: CalendarDays,
              },
            ].map((step) => (
              <div key={step.number}>
                <span className="setup-number">{step.number}</span>
                <step.icon size={19} />
                <h2>{step.title}</h2>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
          <div className="overview-setup-links">
            <Link to="/settings">
              <Settings2 size={16} />
              Afzenderprofiel instellen
              <ArrowUpRight size={15} />
            </Link>
            <Link to="/data">
              <ArrowDownToLine size={16} />
              Gegevens en back-ups
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </>
      ) : (
        <>
          {pendingCalls[0] && (
            <div className="pending-call-notice" role="status">
              <span className="notice-symbol">
                <MessageSquare size={19} />
              </span>
              <div>
                <strong>
                  {pendingCalls.length === 1
                    ? "Eén beluitkomst staat nog open"
                    : `${pendingCalls.length} beluitkomsten staan nog open`}
                </strong>
                <p>
                  {companies.get(pendingCalls[0].prospectId)?.companyName} · Leg
                  vast wat er werkelijk is gebeurd.
                </p>
              </div>
              <Link
                className="button"
                to={`/prospects/${pendingCalls[0].prospectId}`}
              >
                Uitkomst vastleggen
                <ArrowRight size={15} />
              </Link>
            </div>
          )}
          <div className="overview-workspace">
            <Reveal
              className="panel focus-company"
              aria-label="Uw volgende belactie"
            >
              <div className="overview-section-heading">
                <span className="section-number">01</span>
                <h2>Wie belt u nu?</h2>
                {next && <StatusBadge p={next} />}
              </div>
              {next ? (
                <>
                  <div className="focus-company-name">
                    <CompanyMark p={next} />
                    <div>
                      <span className="focus-reason">
                        <span /> {summary.reason}
                      </span>
                      <h3>{next.companyName}</h3>
                      <p>
                        {[next.city, next.sector].filter(Boolean).join(" · ") ||
                          "Bedrijfsgegevens nog aanvullen"}
                      </p>
                    </div>
                  </div>
                  <div className="focus-actions">
                    <CallButton p={next} large />
                    <Link className="button" to={`/prospects/${next.id}`}>
                      Open bedrijfsprofiel
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  <div className="focus-opportunity">
                    <span>KANS VOOR AMOCEAN</span>
                    <p>
                      {next.valueProposition ||
                        "Open het bedrijf om de mogelijkheden en contactgegevens aan te vullen."}
                    </p>
                  </div>
                  <div className="focus-footer">
                    <span>
                      {summary.queue.length}{" "}
                      {summary.queue.length === 1 ? "bedrijf" : "bedrijven"} in
                      uw belrij
                    </span>
                    <Link to="/calling">
                      Verder in belmodus
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </>
              ) : (
                <div className="focus-empty">
                  <Illustration kind="success" />
                  <h3>Uw belrij is bijgewerkt.</h3>
                  <p>Er staat nu geen bedrijf klaar voor een belactie.</p>
                  <Link className="button" to="/prospects">
                    Bekijk alle bedrijven
                    <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </Reveal>
            <Reveal
              className="panel overview-agenda"
              aria-label="Uw opvolgingen"
            >
              <div className="overview-section-heading">
                <span className="section-number">02</span>
                <h2 ref={agendaTitle} tabIndex={-1}>
                  Wat volgt u op?
                </h2>
                <Link className="text-link" to="/followups">
                  Agenda
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div
                className="agenda-filters"
                role="group"
                aria-label="Opvolgingen filteren"
              >
                {(
                  [
                    { key: "all", label: "Alles", count: summary.due.length },
                    {
                      key: "overdue",
                      label: "Te laat",
                      count: summary.overdue.length,
                    },
                    {
                      key: "today",
                      label: "Vandaag",
                      count: summary.dueToday.length,
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    aria-pressed={filter === item.key}
                    onClick={() => setFilter(item.key)}
                  >
                    {item.label}
                    <span>{item.count}</span>
                  </button>
                ))}
              </div>
              <div className="agenda-items">
                {agenda.length ? (
                  agenda.slice(0, 5).map((task) => {
                    const late = summary.overdue.some(
                      (item) => item.id === task.id,
                    );
                    return (
                      <div className="overview-task" key={task.id}>
                        <button
                          className="check-button"
                          disabled={busy !== null}
                          aria-label={`Opvolging afronden: ${task.title}`}
                          onClick={() => void complete(task)}
                        >
                          <Check size={14} />
                        </button>
                        <Link to={`/prospects/${task.prospectId}`}>
                          <strong>
                            {companies.get(task.prospectId)?.companyName}
                          </strong>
                          <span>{task.title}</span>
                        </Link>
                        <span className={`task-when ${late ? "late" : ""}`}>
                          {late
                            ? new Intl.DateTimeFormat("nl-NL", {
                                day: "numeric",
                                month: "short",
                              }).format(new Date(task.dueAt))
                            : task.dateOnly
                              ? "Hele dag"
                              : new Intl.DateTimeFormat("nl-NL", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }).format(new Date(task.dueAt))}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="agenda-empty">
                    <CheckCheck size={24} />
                    <strong>
                      {filter === "overdue"
                        ? "Geen achterstallige opvolgingen"
                        : filter === "today"
                          ? "Geen opvolgingen voor vandaag"
                          : "Alles bijgewerkt voor vandaag"}
                    </strong>
                    <p>
                      {summary.upcoming
                        ? `Volgende: ${companies.get(summary.upcoming.prospectId)?.companyName} · ${dateLabel(summary.upcoming.dueAt, summary.upcoming.dateOnly)}`
                        : "Plan een vervolgstap vanuit een bedrijfsprofiel."}
                    </p>
                  </div>
                )}
              </div>
              <Link className="agenda-footer" to="/followups">
                {summary.due.length > 5
                  ? `Alle ${summary.due.length} openstaande opvolgingen`
                  : "Alle opvolgingen bekijken"}
                <ArrowRight size={15} />
              </Link>
            </Reveal>
          </div>
          <div className="overview-bottom">
            <Reveal className="panel overview-pipeline">
              <div className="overview-section-heading">
                <h2>Bedrijfsstatussen</h2>
                <Link className="text-link" to="/prospects">
                  {prospects.length === 1
                    ? "1 bedrijf"
                    : `Alle ${prospects.length} bedrijven`}
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="status-stages">
                {stages.map((stage) => (
                  <Link
                    to={`/prospects?status=${stage.status}`}
                    key={stage.status}
                  >
                    <span className={`stage-dot stage-${stage.status}`} />
                    <strong>
                      {summary.statusCounts.get(stage.status) ?? 0}
                    </strong>
                    <span>{stage.label}</span>
                  </Link>
                ))}
              </div>
            </Reveal>
            <Reveal className="panel overview-progress">
              <div className="overview-section-heading">
                <h2>Vandaag gedaan</h2>
                <span className="small muted">Uit uw historie</span>
              </div>
              <dl>
                <div>
                  <dt>Belacties gestart</dt>
                  <dd>{summary.startedToday}</dd>
                </div>
                <div>
                  <dt>Gesprekken bevestigd</dt>
                  <dd>{summary.conversationsToday}</dd>
                </div>
                <div>
                  <dt>Opvolgingen afgerond</dt>
                  <dd>{summary.completedToday}</dd>
                </div>
              </dl>
            </Reveal>
          </div>
          <Reveal className="panel overview-history">
            <details>
              <summary>
                <Activity size={17} />
                <span>Recente activiteit</span>
                <span className="small muted">
                  {activities.length}{" "}
                  {activities.length === 1 ? "recente actie" : "recente acties"}
                </span>
                <ChevronDown size={16} />
              </summary>
              {activities.length ? (
                activities.map((item) => (
                  <Link
                    className="activity-row"
                    key={item.id}
                    to={`/prospects/${item.prospectId}`}
                  >
                    <span className="activity-dot" />
                    <div>
                      <strong>
                        {companies.get(item.prospectId)?.companyName}
                      </strong>
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
            </details>
            <details>
              <summary>
                <MessageSquare size={17} />
                <span>Laatste notities</span>
                <span className="small muted">
                  {notes.length} recente{" "}
                  {notes.length === 1 ? "notitie" : "notities"}
                </span>
                <ChevronDown size={16} />
              </summary>
              {notes.length ? (
                notes.map((note) => (
                  <Link
                    className="history-note"
                    to={`/prospects/${note.prospectId}`}
                    key={note.id}
                  >
                    <strong>
                      {companies.get(note.prospectId)?.companyName}
                    </strong>
                    <p>{note.content}</p>
                    <small>{dateLabel(note.updatedAt)}</small>
                  </Link>
                ))
              ) : (
                <p className="muted small padded">
                  Nog geen notities opgeslagen.
                </p>
              )}
            </details>
          </Reveal>
        </>
      )}
      {add && <ProspectForm onClose={() => setAdd(false)} />}
    </div>
  );
}
