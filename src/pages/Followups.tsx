import { Link } from "react-router-dom";
import { Reveal } from "../components/Reveal";
import { useMinute } from "../hooks/useMinute";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, CalendarDays } from "lucide-react";
import { db } from "../db/database";
import { type FollowUp, statuses } from "../lib/models";
import { groupFollowUp, dateLabel } from "../lib/logic";
import { FollowUpForm } from "../components/forms";
import { FollowUpRow } from "../components/ProspectWorkspace";
import { Empty, StatusBadge } from "../components/ui";
export default function Followups() {
  useMinute();
  const data = useLiveQuery(async () => ({
    p: await db.prospects.toArray(),
    n: await db.notes.count(),
    f: (await db.followups.toArray()).sort((a, b) =>
      a.dueAt.localeCompare(b.dueAt),
    ),
  }));
  const [edit, setEdit] = useState<FollowUp | "new" | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>();
  if (!data) return <p>Laden…</p>;
  const scheduled = new Set(
    data.f.filter((f) => !f.completedAt).map((f) => f.prospectId),
  );
  const savedStatuses = data.p.filter(
    (p) =>
      (p.status === "CALLBACK" || p.status === "FOLLOW_UP") &&
      !scheduled.has(p.id),
  );
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">GEEN KANS UIT HET OOG</div>
          <h1>
            Opvolgingen<span className="accent">.</span>
          </h1>
          <p>De juiste aandacht, op het juiste moment.</p>
        </div>
        <button
          className="primary"
          disabled={!data.p.length}
          onClick={() => {
            setSelectedCompany(undefined);
            setEdit("new");
          }}
        >
          <Plus size={17} />
          Opvolging plannen
        </button>
      </header>
      <p className="info-box">
        {data.f.length} losse afspraken ·{" "}
        {savedStatuses.filter((p) => p.status === "CALLBACK").length}{" "}
        terugbelstatussen ·{" "}
        {savedStatuses.filter((p) => p.status === "FOLLOW_UP").length}{" "}
        opvolgstatussen zonder losse afspraak.{" "}
        <Link to="/work?filter=notes">
          {data.n} opgeslagen notities bekijken
        </Link>
      </p>
      {!data.f.length && !savedStatuses.length ? (
        <Empty
          title="Ruimte voor een vervolgstap"
          description="Plan een terugbelmoment vanuit een bedrijf, of voeg hier een opvolging toe."
        >
          <CalendarDays size={30} />
        </Empty>
      ) : (
        [
          "Achterstallig",
          "Vandaag",
          "Morgen",
          "Deze week",
          "Later",
          "Afgerond",
        ].map((group) => {
          const rows = data.f.filter((f) => groupFollowUp(f) === group);
          return (
            rows.length > 0 && (
              <Reveal className="panel followup-group" key={group}>
                <h2 className={group === "Achterstallig" ? "red" : ""}>
                  {group} <span className="count">{rows.length}</span>
                </h2>
                {rows.map((f) => {
                  const p = data.p.find((p) => p.id === f.prospectId);
                  return p ? (
                    <FollowUpRow
                      key={f.id}
                      f={f}
                      p={p}
                      onEdit={() => setEdit(f)}
                    />
                  ) : (
                    <article className="work-card" key={f.id}>
                      <p className="small muted">
                        Bedrijf niet gekoppeld · opgeslagen afspraak
                      </p>
                      <h3>{f.title}</h3>
                      <p>{f.description}</p>
                      <p className="small">{dateLabel(f.dueAt, f.dateOnly)}</p>
                      <Link className="button" to="/recovery">
                        Gegevens veiligstellen
                      </Link>
                    </article>
                  );
                })}
              </Reveal>
            )
          );
        })
      )}
      {savedStatuses.length > 0 && (
        <section
          className="panel followup-group saved-followup-statuses"
          aria-labelledby="saved-followup-statuses-title"
        >
          <h2 id="saved-followup-statuses-title">
            Opgeslagen terugbellen en opvolgen{" "}
            <span className="count">{savedStatuses.length}</span>
          </h2>
          <p className="small muted">
            Deze keuzes zijn bewaard bij het bedrijf. Er is nog geen losse
            kalenderafspraak aangemaakt; er is niets opnieuw ingepland.
          </p>
          {savedStatuses.map((p) => (
            <article className="saved-followup-status" key={p.id}>
              <div>
                <Link to={`/prospects/${p.id}?tab=followups`}>
                  <strong>{p.companyName}</strong>
                </Link>
                <p className="small muted">
                  {[p.city, p.phone].filter(Boolean).join(" · ")}
                </p>
                <StatusBadge p={p} />
                {p.followUpAt && (
                  <p className="small">
                    Bewaarde datum: {dateLabel(p.followUpAt)}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedCompany(p.id);
                  setEdit("new");
                }}
              >
                Datum plannen
              </button>
            </article>
          ))}
        </section>
      )}
      {edit && (
        <FollowUpForm
          prospects={data.p}
          prospectId={selectedCompany}
          followup={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
