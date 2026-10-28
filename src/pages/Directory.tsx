import { useMinute } from "../hooks/useMinute";
import { useState, useMemo, useDeferredValue, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams, Link } from "react-router-dom";
import { Plus, Upload, Search } from "lucide-react";
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
  const resultsRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const pageSize = 60;
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
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(shown.length / pageSize) - 1),
  );
  const pageItems = useMemo(
    () => shown.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [shown, safePage],
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
    for (const p of pageItems) {
      const sector = p.sector || "Nog geen branche";
      const items = result.get(sector) ?? [];
      items.push(p);
      result.set(sector, items);
    }
    return [...result].sort(([a], [b]) => a.localeCompare(b, "nl"));
  }, [pageItems]);
  const updateFilters = (f: Filters) => {
    setPage(0);
    setFilters(f);
    setSaved(f);
    if (params.has("status")) {
      const next = new URLSearchParams(params);
      next.delete("status");
      setParams(next, { replace: true });
    }
  };
  const changePage = (next: number) => {
    setPage(next);
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ block: "start" });
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
          <Link to="/data#discover" className="button">
            <Search size={16} />
            Bedrijven zoeken
          </Link>
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
      <div className="results-label" ref={resultsRef} tabIndex={-1}>
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
            {pageItems.map((p) => (
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
              : "Zoek bedrijven in heel Nederland, importeer uw lijst of voeg handmatig een bedrijf toe."
          }
        >
          <button className="primary" onClick={() => setAdd(true)}>
            <Plus size={16} />
            Bedrijf toevoegen
          </button>
        </Empty>
      )}
      {shown.length > pageSize && (
        <nav className="directory-pagination" aria-label="Bedrijvenpagina’s">
          <button
            disabled={safePage === 0}
            onClick={() => changePage(safePage - 1)}
          >
            Vorige
          </button>
          <span role="status">
            Pagina {safePage + 1} van {Math.ceil(shown.length / pageSize)} ·{" "}
            {safePage * pageSize + 1}–
            {Math.min((safePage + 1) * pageSize, shown.length)} van{" "}
            {shown.length}
          </span>
          <button
            disabled={(safePage + 1) * pageSize >= shown.length}
            onClick={() => changePage(safePage + 1)}
          >
            Volgende
          </button>
        </nav>
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
