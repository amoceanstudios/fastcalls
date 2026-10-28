import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams, Link } from "react-router-dom";
import { Search, SlidersHorizontal, Plus, Upload, X } from "lucide-react";
import { db } from "../db/database";
import { statuses, priorities } from "../lib/models";
import { filterProspects, defaultFilters, type Filters } from "../lib/logic";
import { Empty, ProspectCard, usePreference } from "../components/ui";
import { ProspectForm } from "../components/forms";
export function FilterBar({
  filters,
  onChange,
  prospects,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  prospects: { city: string; sector: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const count = Object.entries(filters).filter(
    ([k, v]) => !["search", "sort"].includes(k) && v,
  ).length;
  const select = (
    key: keyof Filters,
    label: string,
    values: Record<string, string>,
  ) => (
    <label className="filter-label">
      {label}
      <select
        value={filters[key]}
        onChange={(e) => onChange({ ...filters, [key]: e.target.value })}
      >
        <option value="">Alles</option>
        {Object.entries(values).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="filter-bar">
      <div className="search-row">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Prospects doorzoeken"
            placeholder="Zoek bedrijf, plaats, sector of kans…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </label>
        <button
          className={count ? "selected" : ""}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={16} />
          Filters {count > 0 && <span className="count">{count}</span>}
        </button>
        <select
          aria-label="Sorteren"
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value })}
        >
          {Object.entries({
            original: "Excel-volgorde",
            az: "Bedrijf A–Z",
            za: "Bedrijf Z–A",
            city: "Plaats",
            priority: "Prioriteit",
            updated: "Recent bijgewerkt",
            followup: "Volgende opvolging",
            new: "Nog niet gesproken",
          }).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {expanded && (
        <div className="filters-grid">
          {select("status", "Status", statuses)}
          {select(
            "sector",
            "Sector",
            Object.fromEntries(
              [...new Set(prospects.map((p) => p.sector))]
                .filter(Boolean)
                .sort()
                .map((s) => [s, s]),
            ),
          )}
          {select(
            "city",
            "Plaats",
            Object.fromEntries(
              [...new Set(prospects.map((p) => p.city))]
                .filter(Boolean)
                .sort()
                .map((s) => [s, s]),
            ),
          )}
          {select("priority", "Prioriteit", priorities)}
          {select("followup", "Opvolging", {
            Achterstallig: "Achterstallig",
            Vandaag: "Vandaag",
            Morgen: "Morgen",
            none: "Geen opvolging",
          })}
          {select("called", "Gesproken", {
            yes: "Gesproken",
            no: "Nog niet gesproken",
          })}
          {select("notes", "Notities", {
            yes: "Met notities",
            no: "Zonder notities",
          })}
          {select("contact", "Contactpersoon", {
            yes: "Bekend",
            no: "Onbekend",
          })}
        </div>
      )}
      {count > 0 && (
        <button
          className="text-link"
          onClick={() =>
            onChange({ ...defaultFilters, search: filters.search })
          }
        >
          <X size={14} />
          Wis alle filters ({count})
        </button>
      )}
    </div>
  );
}
export default function Directory() {
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
  if (!data) return <p role="status">Prospects laden…</p>;
  const shown = filterProspects(data.p, filters, data.n);
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">VAN LIJST NAAR GESPREK</div>
          <h1>
            Uw prospects<span className="accent">.</span>
          </h1>
          <p>Alle bedrijven, kansen en vervolgstappen op één plek.</p>
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
