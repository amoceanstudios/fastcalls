import { Link } from "react-router-dom";
import { Reveal } from "../components/Reveal";
import { useMinute } from "../hooks/useMinute";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, CalendarDays } from "lucide-react";
import { db } from "../db/database";
import { type FollowUp } from "../lib/models";
import { groupFollowUp, dateLabel } from "../lib/logic";
import { FollowUpForm } from "../components/forms";
import { FollowUpRow } from "../components/ProspectWorkspace";
import { Empty } from "../components/ui";
export default function Followups() {
  useMinute();
  const data = useLiveQuery(async () => ({
    p: await db.prospects.toArray(),
    f: (await db.followups.toArray()).sort((a, b) =>
      a.dueAt.localeCompare(b.dueAt),
    ),
  }));
  const [edit, setEdit] = useState<FollowUp | "new" | null>(null);
  if (!data) return <p>Laden…</p>;
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
          onClick={() => setEdit("new")}
        >
          <Plus size={17} />
          Opvolging plannen
        </button>
      </header>
      {!data.f.length ? (
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
      {edit && (
        <FollowUpForm
          prospects={data.p}
          followup={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
