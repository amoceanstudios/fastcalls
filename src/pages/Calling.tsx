import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  Phone,
} from "lucide-react";
import { db } from "../db/database";
import {
  callingQueue,
  defaultFilters,
  filterProspects,
  type Filters,
} from "../lib/logic";
import { Empty, usePreference } from "../components/ui";
import ProspectWorkspace from "../components/ProspectWorkspace";
import { FilterBar } from "./Directory";
import { defaultProfile } from "../lib/models";
type Session = {
  ids: string[];
  index: number;
  startedAt: string;
  paused: boolean;
  reviewed: string[];
};
const newSession = (): Session => ({
  ids: [],
  index: 0,
  startedAt: new Date().toISOString(),
  paused: false,
  reviewed: [],
});
export default function Calling() {
  const data = useLiveQuery(async () => ({
    p: await db.prospects.toArray(),
    f: await db.followups.toArray(),
    n: await db.notes.toArray(),
    c: await db.calls.toArray(),
    profile: (await db.settings.get("profile"))?.value as
      typeof defaultProfile | undefined,
  }));
  const [session, setSession] = usePreference<Session>(
    "calling-session",
    newSession(),
  );
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const candidates = data
    ? callingQueue(
        filterProspects(data.p, filters, data.n).filter((p) =>
          data.profile?.queue === "new"
            ? p.status === "TO_CALL"
            : data.profile?.queue === "high"
              ? p.priority === "HIGH"
              : true,
        ),
        data.f,
      )
    : [];
  const current = data?.p.find((p) => p.id === session.ids[session.index]);
  const eligible = new Set(candidates.map((p) => p.id));
  useEffect(() => {
    if (!session.ids.length && candidates.length) {
      setSession({
        ...session,
        ids: candidates.map((p) => p.id),
        reviewed: [candidates[0].id],
      });
    }
  }, [candidates.map((p) => p.id).join(","), session.ids.length]);
  const reset = () =>
    setSession({
      ...newSession(),
      ids: candidates.map((p) => p.id),
      reviewed: candidates[0] ? [candidates[0].id] : [],
    });
  const move = (direction: number) => {
    let index = session.index + direction;
    while (index >= 0 && index < session.ids.length) {
      const id = session.ids[index];
      if (direction < 0 || eligible.has(id)) {
        setSession({
          ...session,
          index,
          reviewed: [...new Set([...session.reviewed, id])],
        });
        return;
      }
      index += direction;
    }
    if (direction > 0) setSession({ ...session, index: session.ids.length });
  };
  if (!data) return <p>Laden…</p>;
  const calls = data.c.filter((c) => c.initiatedAt >= session.startedAt);
  const followups = data.f.filter((f) => f.createdAt >= session.startedAt);
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">ÉÉN BEDRIJF. ALLE AANDACHT.</div>
          <h1>
            Belmodus<span className="accent">.</span>
          </h1>
          <p>Een helder ritme voor uw volgende gesprekken.</p>
        </div>
        <button
          onClick={() => setSession({ ...session, paused: !session.paused })}
        >
          {session.paused ? <Play size={16} /> : <Pause size={16} />}{" "}
          {session.paused ? "Hervatten" : "Pauzeren"}
        </button>
      </header>
      <div className="session-stats">
        {[
          [session.reviewed.length, "bekeken"],
          [calls.length, "belacties"],
          [
            calls.filter((c) =>
              ["SPOKEN", "INTERESTED", "CALLBACK"].includes(c.outcome ?? ""),
            ).length,
            "gesprekken",
          ],
          [
            calls.filter((c) => c.outcome === "NO_ANSWER").length,
            "niet opgenomen",
          ],
          [
            calls.filter((c) => c.outcome === "INTERESTED").length,
            "geïnteresseerd",
          ],
          [followups.length, "opvolgingen"],
        ].map(([n, l]) => (
          <span key={l}>
            <b>{n}</b>
            {l}
          </span>
        ))}
      </div>
      <FilterBar prospects={data.p} filters={filters} onChange={setFilters} />
      <div className="queue-toolbar">
        <span>
          {Math.min(session.index + 1, session.ids.length)} /{" "}
          {session.ids.length} in deze sessie
        </span>
        <button onClick={reset}>
          <RotateCcw size={15} />
          Nieuwe wachtrij met deze filters
        </button>
      </div>
      {session.paused ? (
        <Empty
          title="Even op adem komen"
          description="Uw positie en voortgang zijn bewaard."
        >
          <button
            className="primary"
            onClick={() => setSession({ ...session, paused: false })}
          >
            Sessie hervatten
          </button>
        </Empty>
      ) : current ? (
        <>
          <div className="calling-controls">
            <button disabled={session.index === 0} onClick={() => move(-1)}>
              <ArrowLeft size={16} />
              Vorige
            </button>
            <span className="small muted">
              {eligible.has(current.id)
                ? "Klaar voor de volgende actie"
                : "Deze prospect voldoet niet meer aan de wachtrijfilters"}
            </span>
            <button onClick={() => move(1)}>
              Overslaan / volgende <ArrowRight size={16} />
            </button>
          </div>
          <ProspectWorkspace key={current.id} p={current} calling />
        </>
      ) : (
        <Empty
          title="Wachtrij afgerond"
          description="U heeft alle bedrijven in deze wachtrij bekeken, of er zijn geen passende prospects."
        >
          <button onClick={reset}>
            <RotateCcw size={16} />
            Nieuwe wachtrij
          </button>
          <Link className="button" to="/prospects">
            Bekijk prospects
          </Link>
        </Empty>
      )}
    </>
  );
}
