import { useMinute } from "../hooks/useMinute";
import { useState, useMemo, useDeferredValue, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams, Link } from "react-router-dom";
import { Plus, Upload } from "lucide-react";
import { db } from "../db/database";
import { FilterBar } from "../components/FilterBar";
import { filterProspects, defaultFilters, type Filters } from "../lib/logic";
import { Empty, ProspectCard, usePreference } from "../components/ui";
import { ProspectForm } from "../components/forms";
export default function Directory() {
  const minute = useMinute();
  const data = useLiveQuery(async () => ({
    p: await db.prospects.toArray(),
    n: await db.notes.toArray(),
  }));
  const [params, setParams] = useSearchParams();
  const incomingStatus = params.get("status");
  const [saved, setSaved] = usePreference<Filters>(
    "directory-filters",
    defaultFilters,
  );
  const [filters, setFilters] = useState<Filters>(() =>
    incomingStatus
      ? { ...defaultFilters, status: incomingStatus }
      : { ...defaultFilters, ...saved },
  );
  useEffect(() => {
    if (incomingStatus)
      setFilters({ ...defaultFilters, status: incomingStatus });
  }, [incomingStatus]);
  const [add, setAdd] = useState(false);
  const [grouped, setGrouped] = usePreference<boolean>(
    "directory-grouped",
    true,
  );
  const deferredFilters = useDeferredValue(filters);
  const shown = useMemo(
    () => (data ? filterProspects(data.p, deferredFilters, data.n) : []),
    [data, deferredFilters, minute],
  );
  const branches = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of data?.p ?? []) {
      if (p.sector) counts.set(p.sector, (counts.get(p.sector) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b, "nl"));
  }, [data]);
  const groups = useMemo(() => {
    const result = new Map<string, typeof shown>();
    for (const p of shown) {
      const sector = p.sector || "Nog geen branche";
      const items = result.get(sector) ?? [];
      items.push(p);
      result.set(sector, items);
    }
    return [...result].sort(([a], [b]) => a.localeCompare(b, "nl"));
  }, [shown]);
  const updateFilters = (f: Filters) => {
    setFilters(f);
    setSaved(f);
    if (params.has("status")) {
      const next = new URLSearchParams(params);
      next.delete("status");
      setParams(next, { replace: true });
    }
  };
  if (!data) return <p role="status">Prospects laden…</p>;

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">BEDRIJVEN</div>
          <h1>Bedrijven</h1>
          <p>Zoeken, bellen en opvolgen.</p>
        </div>
        <div className="action-row">
          <Link to="/data" className="button">
            <Upload size={16} />
            Importeren
          </Link>
          <button className="primary" onClick={() => setAdd(true)}>
            <Plus size={17} />
            Bedrijf toevoegen
          </button>
        </div>
      </header>
      {branches.length > 0 && (
        <section className="branch-picker" aria-label="Bedrijven per branche">
          <h2>Kies een branche</h2>
          <div className="branch-buttons">
            <button
              aria-pressed={!filters.sector}
              onClick={() => updateFilters({ ...filters, sector: "" })}
            >
              Alle branches <span className="count">{data.p.length}</span>
            </button>
            {branches.map(([sector, count]) => (
              <button
                key={sector}
                aria-pressed={filters.sector === sector}
                onClick={() => updateFilters({ ...filters, sector })}
              >
                {sector} <span className="count">{count}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <FilterBar
        filters={filters}
        onChange={updateFilters}
        prospects={data.p}
      />
      <div className="results-label">
        <span>
          {shown.length} van {data.p.length} bedrijven
        </span>
        <label className="branch-group-toggle">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(event) => setGrouped(event.target.checked)}
          />
          Groeperen per branche
        </label>
      </div>
      {shown.length ? (
        grouped ? (
          <div className="branch-groups">
            {groups.map(([sector, prospects]) => (
              <section key={sector} aria-label={sector}>
                <h2 className="branch-heading">
                  {sector} <span className="count">{prospects.length}</span>
                </h2>
                <div className="prospect-grid">
                  {prospects.map((p) => (
                    <ProspectCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="prospect-grid">
            {shown.map((p) => (
              <ProspectCard key={p.id} p={p} />
            ))}
          </div>
        )
      ) : (
        <Empty
          illustration={data.p.length ? "search" : "empty"}
          title={
            data.p.length
              ? "Geen bedrijven gevonden"
              : "Uw eerste prospect wacht"
          }
          description={
            data.p.length
              ? "Pas uw zoekopdracht of filters aan."
              : "Importeer uw Excel-bestand of voeg handmatig een bedrijf toe."
          }
        >
          <button className="primary" onClick={() => setAdd(true)}>
            <Plus size={16} />
            Bedrijf toevoegen
          </button>
        </Empty>
      )}
      <p className="small muted">
        Wijzigingen worden op dit apparaat bewaard. Exporteer een back-up via{" "}
        <Link to="/data">Gegevens &amp; back-ups</Link> om alles veilig mee te
        nemen.
      </p>
      {add && <ProspectForm onClose={() => setAdd(false)} />}
    </>
  );
}
