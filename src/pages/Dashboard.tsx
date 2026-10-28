import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Phone,
  Users,
  CalendarDays,
  Check,
  Plus,
  Upload,
  Target,
} from "lucide-react";
import { isSameDay } from "date-fns";
import { db } from "../db/database";
import { callingQueue, dateLabel, groupFollowUp } from "../lib/logic";
import { CallButton, Empty, StatusBadge, ProspectCard } from "../components/ui";
import { ProspectForm } from "../components/forms";
export default function Dashboard() {
  const data = useLiveQuery(async () => ({
    p: await db.prospects.toArray(),
    f: await db.followups.toArray(),
    a: await db.activities.orderBy("createdAt").reverse().limit(5).toArray(),
    n: await db.notes.orderBy("createdAt").reverse().limit(3).toArray(),
    c: await db.calls.toArray(),
  }));
  const [add, setAdd] = useState(false);
  const [search, setSearch] = useState("");
  if (!data) return <p role="status">Uw werkstation laden…</p>;
  const { p, f, a, n, c } = data;
  const queue = callingQueue(p, f);
  const next = queue[0];
  const today = new Date();
  const todayCalls = c.filter((c) => isSameDay(new Date(c.initiatedAt), today));
  const confirmed = todayCalls.filter((c) => c.outcome);
  const tasks = f
    .filter(
      (f) =>
        !f.completedAt &&
        ["Vandaag", "Achterstallig"].includes(groupFollowUp(f)),
    )
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const metrics = [
    {
      label: "Totaal prospects",
      value: p.length,
      icon: Users,
      to: "/prospects",
    },
    {
      label: "Nog te bellen",
      value: p.filter((p) => p.status === "TO_CALL").length,
      icon: Phone,
      to: "/prospects?status=TO_CALL",
    },
    {
      label: "Geïnteresseerd",
      value: p.filter((p) => p.status === "INTERESTED").length,
      icon: Target,
      to: "/prospects?status=INTERESTED",
    },
    {
      label: "Opvolging vandaag",
      value: f.filter((f) => !f.completedAt && groupFollowUp(f) === "Vandaag")
        .length,
      icon: CalendarDays,
      to: "/followups",
    },
  ];
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">UW SALESWERKSTATION</div>
          <h1>
            Een goed gesprek
            <br className="mobile-break" /> begint hier
            <span className="accent">.</span>
          </h1>
          <p>Meer aandacht voor uw prospects. Minder administratie.</p>
        </div>
        <button className="primary" onClick={() => setAdd(true)}>
          <Plus size={17} />
          Prospect toevoegen
        </button>
      </header>
      <div className="metric-grid">
        {metrics.map((m) => (
          <Link className="metric" key={m.label} to={m.to}>
            <div>
              <span>{m.label}</span>
              <m.icon size={18} />
            </div>
            <strong>{m.value}</strong>
            <span className="metric-link">
              Bekijk overzicht <ArrowUpRight size={14} />
            </span>
          </Link>
        ))}
      </div>
      {!p.length ? (
        <section className="welcome-panel">
          <div className="welcome-copy">
            <span className="eyebrow">KLAAR VOOR HET EERSTE GESPREK</span>
            <h2>
              Uw volgende kans
              <br />
              begint met een lijst.
            </h2>
            <p>
              Importeer uw bedrijven uit Excel of CSV. Bel, maak notities en
              houd elke vervolgstap bij — ook zonder internet.
            </p>
            <Link className="button lime" to="/data">
              <Upload size={18} />
              Importeer uw prospects <ArrowRight size={18} />
            </Link>
            <span className="small">
              Geen cloudopslag. Uw gegevens blijven op dit apparaat.
            </span>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-mark">
              a
              <span>
                <ArrowUpRight size={90} />
              </span>
            </div>
            <span className="art-caption">
              Van eerste contact
              <br />
              naar nieuwe mogelijkheden.
            </span>
          </div>
        </section>
      ) : (
        <section className="next-panel">
          <div>
            <span className="eyebrow">
              VOLGENDE PROSPECT <span className="live-dot" />
            </span>
            {next ? (
              <>
                <h2>{next.companyName}</h2>
                <p className="muted">
                  {[next.city, next.sector].filter(Boolean).join(" · ")}
                </p>
                <StatusBadge p={next} />
                <p className="opportunity">
                  {next.valueProposition ||
                    "Bekijk het bedrijf en verken samen de mogelijkheden."}
                </p>
                <div className="action-row">
                  <CallButton p={next} large />
                  <Link
                    className="button ghost-light"
                    to={`/prospects/${next.id}`}
                  >
                    Bekijk bedrijf <ArrowUpRight size={17} />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2>Alles bijgewerkt.</h2>
                <p>Er staan nu geen bedrijven klaar voor een belactie.</p>
                <Link to="/followups" className="button lime">
                  Bekijk opvolgingen <ArrowRight size={17} />
                </Link>
              </>
            )}
          </div>
          <div className="next-side">
            <div className="round-phone">
              <Phone size={40} />
            </div>
            <p>
              Eén gesprek kan
              <br />
              het verschil maken.
            </p>
            <Link to="/calling">
              Open belmodus <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-title">
            <h2>
              Vandaag op de agenda <span className="count">{tasks.length}</span>
            </h2>
            <Link to="/followups" aria-label="Alle opvolgingen">
              <ArrowUpRight size={20} />
            </Link>
          </div>
          {tasks.length ? (
            tasks.slice(0, 5).map((t) => (
              <Link
                to={`/prospects/${t.prospectId}`}
                key={t.id}
                className="task-row"
              >
                <span
                  className={`task-dot ${groupFollowUp(t) === "Achterstallig" ? "overdue" : ""}`}
                >
                  <CalendarDays size={17} />
                </span>
                <span>
                  <strong>
                    {p.find((p) => p.id === t.prospectId)?.companyName}
                  </strong>
                  <small>
                    {t.title} · {dateLabel(t.dueAt, t.dateOnly)}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </Link>
            ))
          ) : (
            <div className="quiet-empty">
              <Check size={26} />
              <strong>Een lege agenda. Een frisse start.</strong>
              <p>Geplande opvolgingen verschijnen hier.</p>
            </div>
          )}
          <Link className="text-link" to="/followups">
            Alle opvolgingen bekijken <ArrowRight size={15} />
          </Link>
        </section>
        <section className="panel progress-panel">
          <div className="section-title">
            <h2>Uw dag in beweging</h2>
            <span className="badge neutral">Vandaag</span>
          </div>
          <div className="progress-number">
            {todayCalls.length}
            <span>belacties gestart</span>
          </div>
          <div className="progress-track">
            <div
              style={{
                width: `${todayCalls.length ? (confirmed.length / todayCalls.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="small muted">
            {confirmed.length} uitkomsten bevestigd ·{" "}
            {todayCalls.length - confirmed.length} nog vast te leggen
          </p>
          <div className="progress-stats">
            <span>
              <strong>
                {
                  confirmed.filter((c) =>
                    ["SPOKEN", "INTERESTED", "CALLBACK"].includes(c.outcome!),
                  ).length
                }
              </strong>
              Gesprekken
            </span>
            <span>
              <strong>
                {
                  f.filter(
                    (f) =>
                      f.completedAt &&
                      isSameDay(new Date(f.completedAt), today),
                  ).length
                }
              </strong>
              Opvolgingen afgerond
            </span>
          </div>
          <Link className="button full" to="/calling">
            <Phone size={16} />
            Ga naar belmodus <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-title">
            <h2>Recente activiteit</h2>
            <span className="small muted">Lokaal bijgehouden</span>
          </div>
          {a.length ? (
            a.map((item) => (
              <Link
                className="activity-row"
                key={item.id}
                to={`/prospects/${item.prospectId}`}
              >
                <span className="activity-dot" />
                <div>
                  <strong>
                    {p.find((p) => p.id === item.prospectId)?.companyName}
                  </strong>
                  <p>{item.description}</p>
                  <small>{dateLabel(item.createdAt)}</small>
                </div>
              </Link>
            ))
          ) : (
            <p className="muted small padded">
              Uw eerste acties verschijnen hier. Alles wordt automatisch lokaal
              bewaard.
            </p>
          )}
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Snel naar een bedrijf</h2>
            <Users size={18} />
          </div>
          <input
            aria-label="Snel prospects zoeken"
            placeholder="Zoek op bedrijfsnaam of plaats…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            p
              .filter((p) =>
                `${p.companyName} ${p.city}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .slice(0, 5)
              .map((p) => (
                <Link className="task-row" key={p.id} to={`/prospects/${p.id}`}>
                  <strong>{p.companyName}</strong>
                  <ArrowRight size={16} />
                </Link>
              ))
          ) : (
            <div className="mini-stats">
              <span>
                <b>{p.filter((p) => p.lastContactedAt).length}</b> bedrijven
                gesproken
              </span>
              <span>
                <b>{p.filter((p) => p.status === "PROPOSAL_SENT").length}</b>{" "}
                offertes gestuurd
              </span>
              <span>
                <b>
                  {
                    f.filter(
                      (f) =>
                        !f.completedAt && groupFollowUp(f) === "Achterstallig",
                    ).length
                  }
                </b>{" "}
                achterstallige opvolgingen
              </span>
            </div>
          )}
          {n.length > 0 && (
            <>
              <h3>Laatste notitie</h3>
              <Link
                to={`/prospects/${n[0].prospectId}`}
                className="note-preview"
              >
                {n[0].content}
              </Link>
            </>
          )}
        </section>
      </div>
      {f.some((f) => !f.completedAt) && (
        <p className="small muted">
          Volgende geplande opvolging:{" "}
          {dateLabel(
            [...f]
              .filter((f) => !f.completedAt)
              .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0].dueAt,
          )}
        </p>
      )}
      {add && <ProspectForm onClose={() => setAdd(false)} />}
    </>
  );
}
