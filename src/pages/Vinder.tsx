import { useRef, useState, type PointerEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  X,
  Mail,
  RotateCcw,
  SkipForward,
  MapPin,
  Building2,
  ArrowUpRight,
} from "lucide-react";
import { db } from "../db/database";
import { decideVinder, undoVinder, vinderUndoKey } from "../lib/vinder";
import { type Prospect, safeUrl } from "../lib/models";
import {
  CallButton,
  Empty,
  StatusBadge,
  useAction,
  useWorkingDraft,
} from "../components/ui";
import { CompanyMark } from "../components/CompanyMark";
import { EmailComposer } from "../components/ProspectWorkspace";
import "../styles/vinder.css";
const queued = (p: Prospect) =>
  ["TO_CALL", "CALLED", "NO_ANSWER"].includes(p.status);
export default function Vinder() {
  const data = useLiveQuery(async () => ({
    companies: await db.prospects.toArray(),
    undo: await db.settings.get(vinderUndoKey),
    skipped:
      ((await db.settings.get("vinder-skipped"))?.value as
        string[] | undefined) ?? [],
  }));
  const [view, setView] = useState("queue");
  const [sector, setSector] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [busy, setBusy] = useState(false);
  const action = useAction();
  if (!data) return <p role="status">Vinder laden…</p>;
  const interested = data.companies.filter((p) => p.status === "INTERESTED");
  const rejected = data.companies.filter((p) => p.status === "NOT_INTERESTED");
  const skipped = new Set(data.skipped);
  const queue = data.companies.filter(
    (p) => queued(p) && !skipped.has(p.id) && (!sector || p.sector === sector),
  );
  const current = queue[0];
  const list = (view === "interested" ? interested : rejected).filter((p) =>
    `${p.companyName} ${p.city}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const undo = async () => {
    setBusy(true);
    await action(async () => {
      const id = await undoVinder();
      await db.settings.put({
        key: "vinder-skipped",
        value: data.skipped.filter((x) => x !== id),
      });
      setView("queue");
      setSector("");
    }, "Laatste swipe teruggedraaid. Notities zijn behouden.");
    setBusy(false);
  };
  return (
    <div className="vinder-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">ÉÉN BEDRIJF. ÉÉN VOLGENDE STAP.</div>
          <h1>
            Vinder<span className="accent">.</span>
          </h1>
          <p>Bellen. Kennismaken. Swipe en bewaar de uitkomst.</p>
        </div>
      </header>
      <div className="vinder-tabs" role="group" aria-label="Vinder weergave">
        {[
          ["queue", "Ontdekken", queue.length],
          ["interested", "Geïnteresseerd", interested.length],
          ["rejected", "Geen interesse", rejected.length],
        ].map(([key, label, count]) => (
          <button
            key={key}
            aria-pressed={view === key}
            onClick={() => {
              setView(String(key));
              setLimit(50);
            }}
          >
            <span>{label}</span>
            <b>{count}</b>
          </button>
        ))}
      </div>
      <div className="vinder-toolbar">
        {view === "queue" && (
          <label className="vinder-sector">
            Branche
            <select value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">Alle branches</option>
              {[
                ...new Set(
                  data.companies
                    .filter(queued)
                    .map((p) => p.sector)
                    .filter(Boolean),
                ),
              ]
                .sort()
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </label>
        )}
        <button disabled={!data.undo || busy} onClick={() => void undo()}>
          <RotateCcw size={16} /> Laatste swipe herstellen
        </button>
      </div>
      {view === "queue" ? (
        <>
          <div className="vinder-direction" aria-hidden="true">
            <span>
              <ArrowLeft size={16} /> Goed gesprek · interesse
            </span>
            <span>
              Geen interesse <ArrowRight size={16} />
            </span>
          </div>
          {current ? (
            <VinderCard
              key={current.id}
              p={current}
              onSkip={async () => {
                await db.settings.put({
                  key: "vinder-skipped",
                  value: [...data.skipped, current.id],
                });
              }}
            />
          ) : (
            <Empty
              title="Deze stapel is afgerond"
              description="Uw keuzes zijn bewaard. Terugbellen, opvolgingen en klanten blijven buiten deze stapel."
            >
              <button
                onClick={() =>
                  void action(async () => {
                    await db.settings.put({ key: "vinder-skipped", value: [] });
                    setSector("");
                  }, "Overgeslagen bedrijven staan weer klaar.")
                }
              >
                Overgeslagen bedrijven terughalen
              </button>
              <Link className="button" to="/prospects">
                Alle bedrijven
              </Link>
            </Empty>
          )}
          <p className="vinder-footnote">
            Links = gesproken en geïnteresseerd. Rechts = geen interesse.
            Overslaan wijzigt geen status. Een swipe verstuurt geen e-mail en
            belt niet automatisch.
          </p>
        </>
      ) : (
        <section
          aria-label={
            view === "interested"
              ? "Geïnteresseerde bedrijven"
              : "Bedrijven zonder interesse"
          }
        >
          <label className="vinder-sector">
            Zoeken
            <input
              type="search"
              placeholder="Bedrijf of plaats…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(50);
              }}
            />
          </label>
          <p className="small muted">
            Ook eerder opgeslagen bedrijven staan in deze lijst.
          </p>
          <div className="vinder-results">
            {list.slice(0, limit).map((p) => (
              <article className="panel" key={p.id}>
                <div>
                  <Link to={`/prospects/${p.id}`}>
                    <strong>{p.companyName}</strong>
                    <ArrowUpRight size={16} />
                  </Link>
                  <p className="muted small">
                    {[p.city, p.sector].filter(Boolean).join(" · ")}
                  </p>
                  <StatusBadge p={p} />
                </div>
                <div>
                  <CallButton p={p} />
                  {p.email && (
                    <a className="button" href={`mailto:${p.email}`}>
                      <Mail size={16} />
                      Mail
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!list.length && (
            <Empty
              title="Nog geen bedrijven in deze lijst"
              description="Uw opgeslagen keuzes verschijnen hier, ook na opnieuw openen."
            />
          )}
          {list.length > limit && (
            <button onClick={() => setLimit((n) => n + 50)}>
              Meer bedrijven tonen
            </button>
          )}
        </section>
      )}
    </div>
  );
}
function VinderCard({
  p,
  onSkip,
}: {
  p: Prospect;
  onSkip: () => Promise<void>;
}) {
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(false);
  const [note, setNote] = useWorkingDraft(`note-draft-${p.id}`);
  const notes = useLiveQuery(
    () =>
      db.notes.where("prospectId").equals(p.id).reverse().limit(3).toArray(),
    [p.id],
  );
  const action = useAction();
  const decide = async (direction: number) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    const ok = await action(
      () =>
        decideVinder(
          p.id,
          p.status,
          direction < 0 ? "INTERESTED" : "NOT_INTERESTED",
          note,
        ),
      direction < 0 ? "Geïnteresseerd opgeslagen" : "Geen interesse opgeslagen",
    );
    if (!ok) {
      locked.current = false;
      setBusy(false);
      setDrag(0);
    }
  };
  const down = (e: PointerEvent<HTMLElement>) => {
    if (
      !e.isPrimary ||
      e.button !== 0 ||
      busy ||
      (e.target as HTMLElement).closest("a,button,input,textarea,select,label")
    )
      return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (
      Math.abs(e.clientY - s.y) > Math.abs(dx) &&
      Math.abs(e.clientY - s.y) > 12
    ) {
      start.current = null;
      setDrag(0);
      return;
    }
    setDrag(Math.max(-140, Math.min(140, dx)));
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    if (Math.abs(drag) >= 85) void decide(drag);
    else setDrag(0);
  };
  return (
    <>
      <div className="vinder-deck">
        <article
          className={`vinder-card ${drag ? "is-dragging" : ""}`}
          aria-label={`Bedrijfskaart ${p.companyName}`}
          aria-busy={busy}
          style={{
            transform: `translateX(${drag * 0.45}px) rotate(${drag / 35}deg)`,
          }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            start.current = null;
            setDrag(0);
          }}
        >
          <div className="vinder-card-top">
            <span className="vinder-brand">
              <CompanyMark p={p} />
              <Building2 size={28} />
            </span>
            <StatusBadge p={p} />
          </div>
          <div
            className={`vinder-stamp ${drag < 0 ? "positive" : "negative"}`}
            style={{ opacity: Math.min(1, Math.abs(drag) / 85) }}
            aria-hidden="true"
          >
            {drag < 0 ? "INTERESSE" : "GEEN INTERESSE"}
          </div>
          <span className="eyebrow">{p.sector || "BEDRIJF"}</span>
          <h2>{p.companyName}</h2>
          <p className="vinder-location">
            <MapPin size={16} />
            {[p.address, p.city, p.province].filter(Boolean).join(" · ") ||
              "Locatie niet ingevuld"}
          </p>
          <div className="vinder-contact-actions">
            <CallButton p={p} large />
            <button onClick={() => setEmail(true)}>
              <Mail size={18} />
              Mail opstellen
            </button>
          </div>
          {p.valueProposition && (
            <p className="vinder-pitch">{p.valueProposition}</p>
          )}
          <div className="vinder-contact">
            <span>{p.phone || "Geen telefoonnummer"}</span>
            <span>{p.email || "E-mailadres onbekend"}</span>
            {safeUrl(p.website) && (
              <a href={safeUrl(p.website)} target="_blank" rel="noreferrer">
                Website bekijken <ArrowUpRight size={14} />
              </a>
            )}
          </div>
          <label className="vinder-note">
            Gespreksnotitie
            <textarea
              aria-label="Vinder gespreksnotitie"
              rows={2}
              maxLength={50000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Wat is er besproken? Bewaard bij uw swipe."
            />
          </label>
          {!!notes?.length && (
            <details>
              <summary>
                Eerdere notities ({notes.length}
                {notes.length === 3 ? "+" : ""})
              </summary>
              {notes.map((n) => (
                <p className="vinder-saved-note" key={n.id}>
                  {n.content}
                </p>
              ))}
            </details>
          )}
          <Link className="vinder-profile" to={`/prospects/${p.id}`}>
            Profiel, notities & opvolging <ArrowUpRight size={16} />
          </Link>
        </article>
      </div>
      <div className="vinder-decisions">
        <button
          className="vinder-yes"
          disabled={busy}
          onClick={() => void decide(-1)}
        >
          <Heart size={22} />
          <span>
            Geïnteresseerd<small>← Swipe links</small>
          </span>
        </button>
        <button
          className="vinder-no"
          disabled={busy}
          onClick={() => void decide(1)}
        >
          <X size={22} />
          <span>
            Geen interesse<small>Swipe rechts →</small>
          </span>
        </button>
      </div>
      <div className="vinder-skip">
        <button
          disabled={busy || !!note.trim()}
          onClick={() =>
            void action(onSkip, "Overgeslagen, status ongewijzigd.")
          }
        >
          <SkipForward size={16} />
          Voor nu overslaan
        </button>
        {!!note.trim() && (
          <small>
            Swipe om uw notitie bij dit bedrijf op te slaan. Het concept wordt
            ook tussentijds bewaard.
          </small>
        )}
      </div>
      {email && <EmailComposer p={p} onClose={() => setEmail(false)} />}
    </>
  );
}
