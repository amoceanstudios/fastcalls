import { useEffect, useMemo, useState } from "react";
import {
  Download,
  RefreshCw,
  Search,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  inspectBrowserStorage,
  recoveryItems,
  type StorageRecoveryReport,
  type RecoveredItem,
} from "../lib/storageRecovery";
import { download } from "../lib/transfer";
import { normalizeText } from "../lib/models";
const labels = {
  notes: "Notities",
  followups: "Terugbellen / opvolgen",
  calls: "Belacties",
  drafts: "Conceptmails",
};
export default function StorageRecovery() {
  const [report, setReport] = useState<StorageRecoveryReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | RecoveredItem["kind"]>("all");
  const [limit, setLimit] = useState(30);
  const scan = async () => {
    setBusy(true);
    setError("");
    try {
      setReport(await inspectBrowserStorage());
    } catch {
      setError(
        "De browseropslag kon niet worden gecontroleerd. Uw gegevens zijn niet gewijzigd.",
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void scan();
  }, []);
  const items = useMemo(() => (report ? recoveryItems(report) : []), [report]);
  const shown = useMemo(
    () =>
      items.filter(
        (item) =>
          (kind === "all" || item.kind === kind) &&
          normalizeText(
            `${item.companyName} ${item.title} ${item.content} ${item.reference}`,
          ).includes(normalizeText(search)),
      ),
    [items, kind, search],
  );
  return (
    <div className="personal-work recovery-page">
      <Link to="/work" className="back-link">
        <ArrowLeft size={16} />
        Mijn werk
      </Link>
      <header className="page-header">
        <div>
          <div className="eyebrow">ALLEEN LEZEN · GEGEVENS BEHOUDEN</div>
          <h1>Gegevens terugvinden</h1>
          <p>
            Controleer wat deze browser echt heeft opgeslagen, zonder
            zoekfilters of bedrijfskoppelingen.
          </p>
        </div>
      </header>
      <div className="info-box">
        <ShieldCheck size={20} />
        <span>
          Deze controle leest bestaande opslag. Er wordt niets gewist, vervangen
          of opnieuw geïmporteerd. De veiligheidskopie bevat ook niet-gekoppelde
          en oudere gegevens.
        </span>
      </div>
      <p className="small work-storage-note">
        Dit siteadres:{" "}
        <strong className="recovery-origin">{location.origin}</strong>. Een
        ander siteadres, apparaat of browser heeft eigen lokale opslag. Deze
        pagina kan die andere opslag niet op afstand lezen.
      </p>
      <div className="action-row wrap">
        <button onClick={() => void scan()} disabled={busy}>
          <RefreshCw size={16} />
          {busy ? "Browseropslag controleren…" : "Opnieuw controleren"}
        </button>
        <button
          className="primary"
          disabled={!report || busy}
          onClick={() =>
            report &&
            download(
              JSON.stringify(report, null, 2),
              `amocean-veiligheidskopie-${new Date().toISOString().slice(0, 10)}.json`,
            )
          }
        >
          <Download size={16} />
          Alles veiligstellen
        </button>
      </div>
      {error && (
        <p role="alert" className="work-storage-note">
          {error}
        </p>
      )}
      {report && (
        <>
          <div
            className="work-filters recovery-counts"
            role="group"
            aria-label="Opgeslagen browsergegevens"
          >
            <button
              aria-pressed={kind === "all"}
              onClick={() => {
                setKind("all");
                setLimit(30);
              }}
            >
              Alles {items.length}
            </button>
            {Object.entries(labels).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={kind === key}
                onClick={() => {
                  setKind(key as RecoveredItem["kind"]);
                  setLimit(30);
                }}
              >
                {label} {items.filter((item) => item.kind === key).length}
              </button>
            ))}
          </div>
          <p role="status">
            {report.databases.length} databestanden gecontroleerd ·{" "}
            {items.length} persoonlijke items gevonden.
          </p>
          {report.errors.map((message, i) => (
            <p role="alert" key={i}>
              {message}
            </p>
          ))}
          <label className="search-box recovery-search">
            <Search size={18} />
            <input
              aria-label="Alle opgeslagen gegevens doorzoeken"
              placeholder="Zoek in alle gevonden tekst…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setLimit(30);
              }}
            />
          </label>
          {shown.length ? (
            <div className="work-list">
              {shown.slice(0, limit).map((item) => (
                <article className="work-card" key={item.id}>
                  <div className="work-card-heading">
                    <span>{labels[item.kind]}</span>
                    <span>{item.database}</span>
                  </div>
                  <h2>{item.companyName}</h2>
                  <h3>{item.title}</h3>
                  <p className="work-content">{item.content}</p>
                  {item.when && (
                    <p className="small muted">Opgeslagen datum: {item.when}</p>
                  )}
                  {item.reference && (
                    <p className="small muted recovery-reference">
                      Bedrijfsreferentie: {item.reference}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="panel">
              <h2>
                {items.length
                  ? "Geen tekst gevonden met deze filters"
                  : "Hier zijn nog geen persoonlijke records gevonden"}
              </h2>
              <p>
                {items.length
                  ? "Wis de zoektekst of kies Alles om alle gevonden inhoud te bekijken."
                  : "Dat bewijst niet dat uw eerdere gegevens verwijderd zijn. Open het oorspronkelijke siteadres op dezelfde telefoon en in dezelfde browser waarin u ze opsloeg. Controleer ook eerder gedownloade back-ups."}
              </p>
            </div>
          )}
          {shown.length > limit && (
            <button
              className="work-load-more"
              onClick={() => setLimit(limit + 30)}
            >
              Meer gevonden gegevens tonen
            </button>
          )}
          <details className="panel recovery-inventory">
            <summary>Alle gevonden databestanden en aantallen</summary>
            {report.databases.map((database) => (
              <div key={database.name}>
                <h2>{database.name}</h2>
                <ul>
                  {Object.entries(database.stores).map(([store, rows]) => (
                    <li key={store}>
                      {store}: {rows.length}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
