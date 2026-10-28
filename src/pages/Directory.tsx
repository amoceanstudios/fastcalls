import { useMinute } from "../hooks/useMinute";
import { useState, useMemo, useDeferredValue } from "react";
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
  const [params] = useSearchParams();
  const [saved, setSaved] = usePreference<Filters>(
    "directory-filters",
    defaultFilters,
  );
  const [filters, setFilters] = useState({
    ...defaultFilters,
    ...saved,
    ...(params.get("status") ? { status: params.get("status")! } : {}),
  });
  const [add, setAdd] = useState(false);
  const deferredFilters = useDeferredValue(filters);
  const shown = useMemo(
    () => (data ? filterProspects(data.p, deferredFilters, data.n) : []),
    [data, deferredFilters, minute],
  );
  if (!data) return <p role="status">Prospects laden…</p>;

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">BEDRIJVEN</div>
          <h1>
            Uw prospects<span className="accent">.</span>
          </h1>
          <p>Zoeken, bellen en opvolgen.</p>
        </div>
        <div className="action-row">
          <Link to="/data" className="button">
            <Upload size={16} />
            Importeren
          </Link>
          <button className="primary" onClick={() => setAdd(true)}>
            <Plus size={17} />
            Prospect toevoegen
          </button>
        </div>
      </header>
      <FilterBar
        filters={filters}
        onChange={(f) => {
          setFilters(f);
          setSaved(f);
        }}
        prospects={data.p}
      />
      <div className="results-label">
        <span>
          {shown.length} van {data.p.length} prospects
        </span>
        <span>Uw gegevens, lokaal bewaard</span>
      </div>
      {shown.length ? (
        <div className="prospect-grid">
          {shown.map((p) => (
            <ProspectCard key={p.id} p={p} />
          ))}
        </div>
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
      {add && <ProspectForm onClose={() => setAdd(false)} />}
    </>
  );
}
