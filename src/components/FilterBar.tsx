import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { statuses, priorities } from "../lib/models";
import { defaultFilters, type Filters } from "../lib/logic";
export function FilterBar({
  filters,
  onChange,
  prospects,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  prospects: { city: string; sector: string; province?: string }[];
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
          {select(
            "province",
            "Provincie",
            Object.fromEntries(
              [...new Set(prospects.map((p) => p.province || ""))]
                .filter(Boolean)
                .sort()
                .map((province) => [province, province]),
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
