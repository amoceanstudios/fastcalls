import { useMinute } from "../hooks/useMinute";
import { useDeferredValue, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, Download, ArrowRight } from "lucide-react";
import { usePersonalWork } from "../hooks/usePersonalWork";
import {
  buildPersonalWork,
  filterPersonalWork,
  workFilters,
  type WorkFilter,
} from "../lib/personalWork";
import { WorkCard } from "../components/WorkCard";
import { Empty, useAction } from "../components/ui";
import { downloadBackup } from "../lib/transfer";
export default function MyWork() {
  useMinute();
  const data = usePersonalWork();
  const [params, setParams] = useSearchParams();
  const action = useAction();
  const requested = params.get("filter") || "all";
  const filter: WorkFilter = Object.hasOwn(workFilters, requested)
    ? (requested as WorkFilter)
    : "all";
  const search = params.get("q") || "";
  const deferred = useDeferredValue(search);
  const [limit, setLimit] = useState(30);
  const completed = params.get("completed") !== "hide";
  const work = useMemo(() => (data ? buildPersonalWork(data) : null), [data]);
  const shown = useMemo(
    () =>
      work ? filterPersonalWork(work.items, filter, deferred, completed) : [],
    [work, filter, deferred, completed],
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "q" });
    setLimit(30);
  };
  if (!data || !work) return <p role="status">Uw opgeslagen werk laden…</p>;
  return (
    <div className="personal-work">
      <header className="page-header">
        <div>
          <div className="eyebrow">ALLES WAT U HEEFT BEWAARD</div>
          <h1>Mijn werk</h1>
          <p>Notities, terugbellen en eerder opgeslagen acties op één plek.</p>
        </div>
        <button
          onClick={() =>
            void action(() => downloadBackup(), "Back-updownload gestart")
          }
        >
          <Download size={16} />
          Back-up maken
        </button>
      </header>
      <div className="info-box work-storage-note">
        <span>
          In deze browser:{" "}
          <strong>{data.notes.length} opgeslagen notities</strong> en{" "}
          <strong>{data.followups.length} afspraken</strong>.{" "}
          <Link to="/recovery">Gegevens ontbreken? Controleer de opslag.</Link>
        </span>
      </div>
      {(search || filter !== "all" || !completed) && (
        <button
          className="work-reset"
          onClick={() => {
            setParams({});
            setLimit(30);
          }}
        >
          Alle opgeslagen items tonen · filters wissen
        </button>
      )}
      {work.items.some((item) => item.company.missing) && (
        <p className="info-box">
          Er staan ook opgeslagen items zonder bedrijfskoppeling in uw opslag.
          Die inhoud wordt hieronder weer getoond.{" "}
          <Link to="/recovery">Veiligstellen</Link>
        </p>
      )}
      <div className="work-search">
        <label className="search-box">
          <Search size={19} />
          <input
            aria-label="Mijn opgeslagen werk doorzoeken"
            placeholder="Zoek in notities, bedrijven of afspraken…"
            value={search}
            onChange={(event) => update("q", event.target.value)}
          />
        </label>
      </div>
      <div
        className="work-filters"
        role="group"
        aria-label="Mijn werk filteren"
      >
        {Object.entries(workFilters).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            onClick={() => update("filter", key === "all" ? "" : key)}
          >
            {label}
            <span className="count">{work.counts[key as WorkFilter]}</span>
          </button>
        ))}
      </div>
      <div className="work-results-label">
        <p role="status">
          {shown.length} {shown.length === 1 ? "resultaat" : "resultaten"}
          {search ? ` voor “${search}”` : " in uw opgeslagen werk"}
        </p>
        {filter === "followups" && (
          <label>
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) =>
                update("completed", e.target.checked ? "" : "hide")
              }
            />
            Ook afgeronde afspraken
          </label>
        )}
      </div>
      {shown.length ? (
        <div className="work-list">
          {shown.slice(0, limit).map((item) => (
            <WorkCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            search
              ? "Geen resultaat voor deze zoekopdracht"
              : filter === "all"
                ? "Uw eigen werk verschijnt hier"
                : `Nog geen ${workFilters[filter].toLowerCase()} gevonden`
          }
          description={
            search
              ? "Zoek op een woord uit de notitie, de bedrijfsnaam of een telefoonnummer."
              : "Alles wat u bij een bedrijf opslaat blijft hier terug te vinden. De landelijke bedrijvenlijst staat apart onder Bedrijven."
          }
        >
          <Link className="button" to="/prospects">
            Naar bedrijven
            <ArrowRight size={16} />
          </Link>
        </Empty>
      )}
      {shown.length > limit && (
        <button className="work-load-more" onClick={() => setLimit(limit + 30)}>
          Volgende 30 resultaten tonen ({shown.length - limit} over)
        </button>
      )}
      <p className="small muted work-storage-note">
        Uw bestaande gegevens blijven bewaard in dezelfde browseropslag. Een
        volledige back-up bevat ook uw notities, terugbelafspraken en concepten.
      </p>
    </div>
  );
}
