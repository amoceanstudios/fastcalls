import { CompanyMark } from "./CompanyMark";
import { useState, useEffect, useContext } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Pencil,
  CalendarPlus,
  Mail,
  Plus,
  Trash2,
  Check,
  Phone,
} from "lucide-react";
import {
  type Prospect,
  type Note,
  type FollowUp,
  type Call,
  type Draft,
  statuses,
  outcomes,
  priorities,
  uid,
  now,
  safeUrl,
  defaultProfile,
} from "../lib/models";
import {
  db,
  changeStatus,
  saveNote,
  deleteNote,
  saveFollowUp,
  deleteFollowUp,
  confirmCall,
  saveDraft,
} from "../db/database";
import {
  CallButton,
  StatusBadge,
  useAction,
  Modal,
  Confirm,
  FeedbackContext,
  useWorkingDraft,
} from "./ui";
import { ProspectForm, FollowUpForm } from "./forms";
import { dateLabel, templates, tones, groupFollowUp } from "../lib/logic";
import { generateEmail, mailto } from "../lib/email";
export function FollowUpRow({
  f,
  p,
  onEdit,
}: {
  f: FollowUp;
  p: Prospect;
  onEdit: () => void;
}) {
  const action = useAction();
  const [remove, setRemove] = useState(false);
  return (
    <div className={`followup-row ${f.completedAt ? "completed" : ""}`}>
      <button
        className="check-button"
        aria-label={
          f.completedAt ? "Opvolging heropenen" : "Opvolging afronden"
        }
        onClick={() =>
          void action(() =>
            saveFollowUp({ ...f, completedAt: f.completedAt ? null : now() }),
          )
        }
      >
        {f.completedAt ? <Check size={16} /> : null}
      </button>
      <div className="grow">
        <Link to={`/prospects/${p.id}`}>
          <strong>{f.title}</strong>
        </Link>
        <p className="small muted">
          {p.companyName} ·{" "}
          <span className={groupFollowUp(f) === "Achterstallig" ? "red" : ""}>
            {dateLabel(f.dueAt, f.dateOnly)}
          </span>
        </p>
        {f.description && <p className="small">{f.description}</p>}
      </div>
      <div className="row-actions">
        <CallButton p={p} />
        <button
          className="icon-button"
          onClick={onEdit}
          aria-label="Opvolging bewerken"
        >
          <Pencil size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Opvolging verwijderen"
          onClick={() => setRemove(true)}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {remove && (
        <Confirm
          title="Opvolging verwijderen?"
          danger
          onClose={() => setRemove(false)}
          onConfirm={() => deleteFollowUp(f)}
        >
          <p>Deze opvolging wordt verwijderd.</p>
        </Confirm>
      )}
    </div>
  );
}
function EmailComposer({ p, onClose }: { p: Prospect; onClose: () => void }) {
  const data = useLiveQuery(
    async () => ({
      profile: (await db.settings.get("profile"))?.value as
        typeof defaultProfile | undefined,
      drafts: await db.drafts.where("prospectId").equals(p.id).toArray(),
      notes: await db.notes.where("prospectId").equals(p.id).toArray(),
      calls: await db.calls.where("prospectId").equals(p.id).toArray(),
    }),
    [p.id],
  );
  return (
    <Modal
      title="Een persoonlijk bericht"
      description="Lokaal gegenereerd. Er worden geen gegevens naar een AI-dienst verstuurd."
      open
      onClose={onClose}
    >
      {data ? <EmailForm key={p.id} p={p} data={data} /> : <p>Laden…</p>}
    </Modal>
  );
}
function EmailForm({
  p,
  data,
}: {
  p: Prospect;
  data: {
    profile?: typeof defaultProfile;
    drafts: Draft[];
    notes: Note[];
    calls: Call[];
  };
}) {
  const profile = data.profile ?? defaultProfile;
  const recent = [...data.drafts].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )[0];
  const [template, setTemplate] = useState(
    recent?.template ?? profile.template,
  );
  const [tone, setTone] = useState(recent?.tone ?? profile.tone);
  const [conversation, setConversation] = useState(
    data.calls.some((c) =>
      ["SPOKEN", "CALLBACK", "INTERESTED"].includes(c.outcome ?? ""),
    ),
  );
  const [priorEmail, setPriorEmail] = useState(false);
  const [note, setNote] = useState("");
  const initial = generateEmail(
    p,
    profile,
    [2, 4].includes(profile.template) ? 0 : profile.template,
    profile.tone,
  );
  const [recipient, setRecipient] = useState(recent?.recipient ?? p.email);
  const [subject, setSubject] = useState(recent?.subject ?? initial.subject);
  const [body, setBody] = useState(recent?.body ?? initial.body);
  const [id, setId] = useState(recent?.id ?? uid());
  const [dirty, setDirty] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [autosave, setAutosave] = useState("");
  const [saving, setSaving] = useState(false);
  const action = useAction();
  const notify = useContext(FeedbackContext);
  const regenerate = () => {
    if (
      dirty &&
      !window.confirm("Uw bewerkte tekst vervangen door een nieuwe versie?")
    )
      return;
    try {
      const result = generateEmail(p, profile, template, tone, {
        conversation,
        priorEmail,
        note,
      });
      setSubject(result.subject);
      setBody(result.body);
      setGeneration((value) => value + 1);
      setDirty(true);
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        setAutosave("Vul een geldig e-mailadres in om het concept te bewaren.");
        return;
      }
      void saveDraft({
        id,
        prospectId: p.id,
        recipient,
        subject,
        body,
        template,
        tone,
        updatedAt: now(),
      })
        .then(() => setAutosave("Concept lokaal bewaard"))
        .catch(() =>
          setAutosave("Opslaan mislukt. Kopieer uw tekst als back-up."),
        );
    }, 0);
    return () => clearTimeout(timer);
  }, [dirty, recipient, subject, body, template, tone, id, p.id]);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("Gekopieerd");
    } catch {
      notify(
        "Kopiëren niet beschikbaar. Selecteer de tekst en kopieer handmatig.",
        true,
      );
    }
  };
  const href = mailto(recipient, subject, body);
  return (
    <div className="email-form">
      {data.drafts.length > 0 && (
        <label>
          Opgeslagen concept
          <select
            aria-label="Opgeslagen concept"
            value={id}
            onChange={(e) => {
              const d = data.drafts.find((d) => d.id === e.target.value);
              if (d) {
                setId(d.id);
                setRecipient(d.recipient);
                setSubject(d.subject);
                setBody(d.body);
                setTemplate(d.template);
                setTone(d.tone);
                setDirty(false);
              }
            }}
          >
            {data.drafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.subject} · {dateLabel(d.updatedAt)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="form-grid">
        <label>
          Sjabloon
          <select
            value={template}
            onChange={(e) => setTemplate(Number(e.target.value))}
          >
            {templates.map((t, i) => (
              <option key={t} value={i}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Toon
          <select value={tone} onChange={(e) => setTone(e.target.value)}>
            {tones.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      {template === 2 && (
        <>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={conversation}
              onChange={(e) => setConversation(e.target.checked)}
            />
            Ik bevestig dat er een gesprek heeft plaatsgevonden
          </label>
          <label>
            Notitie meenemen (optioneel)
            <select value={note} onChange={(e) => setNote(e.target.value)}>
              <option value="">Geen notitie</option>
              {data.notes.map((n) => (
                <option key={n.id} value={n.content}>
                  {n.content.slice(0, 80)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {template === 4 && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={priorEmail}
            onChange={(e) => setPriorEmail(e.target.checked)}
          />
          Ik bevestig dat eerder een e-mail is gestuurd
        </label>
      )}
      <button onClick={regenerate}>Genereer / herstel vanuit sjabloon</button>
      <label>
        Ontvanger (optioneel)
        <input
          type="email"
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            setDirty(true);
          }}
          placeholder="Zelf toevoegen; we raden geen adressen"
        />
      </label>
      <div key={generation} className="generated-result">
        <label>
          Onderwerp
          <input
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label>
          Bericht
          <textarea
            className="email-body"
            rows={13}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setDirty(true);
            }}
          />
        </label>
      </div>
      <p className="small muted" role="status">
        {autosave || "Concept nog niet gewijzigd"}
      </p>
      <div className="action-row wrap">
        <button onClick={() => void copy(subject)}>Kopieer onderwerp</button>
        <button onClick={() => void copy(body)}>Kopieer bericht</button>
        <button onClick={() => void copy(`${subject}\n\n${body}`)}>
          Kopieer alles
        </button>
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await action(
              () =>
                saveDraft({
                  id,
                  prospectId: p.id,
                  recipient,
                  subject,
                  body,
                  template,
                  tone,
                  updatedAt: now(),
                }),
              "Concept opgeslagen",
            );
            setSaving(false);
          }}
        >
          Concept opslaan
        </button>
        {href.length < 2000 ? (
          <a className="button primary" href={href}>
            Open e-mailapp <ExternalLink size={15} />
          </a>
        ) : (
          <p className="small">
            Bericht te lang voor een betrouwbare mailto-link. Kopieer het
            bericht naar uw e-mailapp.
          </p>
        )}
      </div>
      <p className="small muted">
        Openen van uw e-mailapp verstuurt niets automatisch. Bij een ontbrekende
        mailapp kunt u de tekst kopiëren.
      </p>
    </div>
  );
}
export default function ProspectWorkspace({
  p,
  calling = false,
}: {
  p: Prospect;
  calling?: boolean;
}) {
  const data = useLiveQuery(
    async () => ({
      n: (await db.notes.where("prospectId").equals(p.id).toArray()).sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt),
      ),
      f: await db.followups.where("prospectId").equals(p.id).toArray(),
      c: (await db.calls.where("prospectId").equals(p.id).toArray()).sort(
        (a, b) => b.initiatedAt.localeCompare(a.initiatedAt),
      ),
      a: (await db.activities.where("prospectId").equals(p.id).toArray()).sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt),
      ),
      profile: (await db.settings.get("profile"))?.value as
        typeof defaultProfile | undefined,
    }),
    [p.id],
  );
  const [edit, setEdit] = useState(false);
  const [schedule, setSchedule] = useState<FollowUp | "new" | null>(null);
  const [email, setEmail] = useState(false);
  const [tab, setTab] = useState("notes");
  const [noteText, setNoteText] = useWorkingDraft(`note-draft-${p.id}`);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [remove, setRemove] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [callSummary, setCallSummary] = useWorkingDraft(`call-summary-${p.id}`);
  const [outcome, setOutcome] =
    useState<NonNullable<Call["outcome"]>>("SPOKEN");
  const action = useAction();
  const pending = data?.c.find((c) => !c.outcome);
  const submitNote = async () => {
    setBusy(true);
    if (await action(() => saveNote(p.id, noteText))) setNoteText("");
    setBusy(false);
  };
  const outcomeStatus: Partial<
    Record<NonNullable<Call["outcome"]>, Prospect["status"]>
  > = {
    NO_ANSWER: "NO_ANSWER",
    SPOKEN: data?.profile?.conversationStatus ?? "CALLED",
    CALLBACK: "CALLBACK",
    INTERESTED: "INTERESTED",
    NOT_INTERESTED: "NOT_INTERESTED",
  };
  return (
    <>
      <div className="detail-header">
        <div>
          <div className="eyebrow">
            {calling ? "FOCUS OP HET GESPREK" : "BEDRIJFSPROFIEL"}
          </div>
          <div className="company-heading">
            <CompanyMark p={p} />
            {calling ? (
              <h2 className="prospect-heading">{p.companyName}</h2>
            ) : (
              <h1>{p.companyName}</h1>
            )}
          </div>
          <p className="muted">
            {[p.city, p.sector].filter(Boolean).join(" · ")}
          </p>
          <div className="action-row wrap">
            <StatusBadge p={p} />
            <span className={`priority ${p.priority.toLowerCase()}`}>
              ● {priorities[p.priority]}
            </span>
            {p.tags.map((t) => (
              <span className="badge neutral" key={t}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <button onClick={() => setEdit(true)}>
          <Pencil size={16} />
          Bewerken
        </button>
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          <section className="opportunity-panel">
            <div className="eyebrow">WAT AMOCEAN KAN BETEKENEN</div>
            <h2>De kans bij {p.companyName}</h2>
            <p>
              {p.valueProposition ||
                "Nog geen kans beschreven. Voeg deze toe via Bewerken."}
            </p>
            {calling && (
              <div className="call-script">
                <span>GESPREKSOPENER</span>
                <p>
                  “Goedendag, u spreekt met Amocean. Hoe organiseert u momenteel
                  het dagelijkse werk
                  {p.sector ? ` binnen ${p.sector.toLowerCase()}` : ""}? Ik
                  verken graag of dit idee voor u relevant is:{" "}
                  {p.valueProposition ||
                    "software die uw werk eenvoudiger maakt"}
                  ”
                </p>
              </div>
            )}
          </section>
          {pending && (
            <section className="panel outcome-panel">
              <h2>Hoe is het gesprek verlopen?</h2>
              <p className="small muted">
                Belactie gestart op {dateLabel(pending.initiatedAt)}. De
                werkelijke uitkomst is nog onbekend.
              </p>
              <label>
                Uitkomst
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                >
                  {Object.entries(outcomes).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Gespreksnotitie
                <textarea
                  value={callSummary}
                  onChange={(e) => setCallSummary(e.target.value)}
                  placeholder="Wat is besproken?"
                />
              </label>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  if (
                    await action(
                      () =>
                        confirmCall(
                          pending,
                          outcome,
                          callSummary,
                          outcomeStatus[outcome],
                        ),
                      "Uitkomst bevestigd",
                    )
                  ) {
                    setCallSummary("");
                    if (outcome === "CALLBACK") setSchedule("new");
                  }
                  setBusy(false);
                }}
              >
                Uitkomst bevestigen
              </button>
            </section>
          )}
          <section className="panel">
            <div className="tabs" role="tablist" aria-label="Prospectgegevens">
              {[
                ["notes", "Notities", data?.n.length],
                [
                  "followups",
                  "Opvolging",
                  data?.f.filter((f) => !f.completedAt).length,
                ],
                ["calls", "Belhistorie", data?.c.length],
                ["activity", "Activiteit", data?.a.length],
              ].map(([key, label, count]) => (
                <button
                  key={key}
                  role="tab"
                  id={`tab-${key}`}
                  aria-controls="detail-tabpanel"
                  aria-selected={tab === key}
                  onClick={() => setTab(String(key))}
                >
                  {label}
                  <span className="count">{count ?? 0}</span>
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id="detail-tabpanel"
              aria-labelledby={`tab-${tab}`}
            >
              {tab === "notes" && (
                <>
                  <form
                    className="note-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitNote();
                    }}
                  >
                    <label>
                      Notitie toevoegen
                      <textarea
                        rows={3}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Leg de belangrijkste punten vast…"
                      />
                    </label>
                    <div className="note-form-footer">
                      <span className="small muted">
                        Uw invoer blijft bewaard tot u opslaat.
                      </span>
                      <button
                        className="primary"
                        disabled={!noteText.trim() || busy}
                      >
                        <Plus size={15} />
                        Notitie opslaan
                      </button>
                    </div>
                  </form>
                  {data?.n.map((n) => (
                    <article className="note-item" key={n.id}>
                      <div className="section-title">
                        <span className="small muted">
                          {dateLabel(n.createdAt)}
                          {n.updatedAt !== n.createdAt
                            ? ` · bewerkt ${dateLabel(n.updatedAt)}`
                            : ""}
                        </span>
                        <div>
                          <button
                            className="icon-button"
                            aria-label="Notitie bewerken"
                            onClick={() => setEditNote(n)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Notitie verwijderen"
                            onClick={() => setRemove(n)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <p>{n.content}</p>
                    </article>
                  ))}
                  {!data?.n.length && (
                    <p className="muted small padded">
                      Nog geen notities. Ieder gesprek is een nieuw begin.
                    </p>
                  )}
                </>
              )}
              {tab === "followups" && (
                <>
                  <button onClick={() => setSchedule("new")}>
                    <CalendarPlus size={16} />
                    Opvolging plannen
                  </button>
                  {data?.f.map((f) => (
                    <FollowUpRow
                      key={f.id}
                      f={f}
                      p={p}
                      onEdit={() => setSchedule(f)}
                    />
                  ))}
                  {!data?.f.length && (
                    <p className="muted padded">
                      Nog geen opvolgingen gepland.
                    </p>
                  )}
                </>
              )}
              {tab === "calls" && (
                <>
                  {data?.c.map((c) => (
                    <div className="activity-row" key={c.id}>
                      <Phone size={17} />
                      <div>
                        <strong>
                          {c.outcome
                            ? outcomes[c.outcome]
                            : "Belactie gestart · uitkomst onbekend"}
                        </strong>
                        <p>{c.summary}</p>
                        <small>
                          {dateLabel(c.initiatedAt)}
                          {c.confirmedAt ? " · handmatig bevestigd" : ""}
                        </small>
                      </div>
                    </div>
                  ))}
                  {!data?.c.length && (
                    <p className="muted padded">Nog geen belacties gestart.</p>
                  )}
                </>
              )}
              {tab === "activity" &&
                data?.a.map((a) => (
                  <div className="activity-row" key={a.id}>
                    <span className="activity-dot" />
                    <div>
                      <p>{a.description}</p>
                      <small>{dateLabel(a.createdAt)}</small>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel">
            <h2>De volgende stap</h2>
            <div className="stack-actions">
              <CallButton p={p} large />
              <button onClick={() => setEmail(true)}>
                <Mail size={17} />
                Genereer e-mail
              </button>
              <button onClick={() => setSchedule("new")}>
                <CalendarPlus size={17} />
                Plan opvolging
              </button>
            </div>
            <label>
              Status
              <select
                value={p.status}
                onChange={(e) =>
                  void action(() =>
                    changeStatus(p, e.target.value as Prospect["status"]),
                  )
                }
              >
                {Object.entries(statuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className="panel contact-panel">
            <h2>Contactgegevens</h2>
            <dl>
              <dt>Telefoon</dt>
              <dd>{p.phone || "Niet ingevuld"}</dd>
              <dt>Website</dt>
              <dd>
                {safeUrl(p.website) ? (
                  <a
                    href={safeUrl(p.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {new URL(p.website).hostname}
                    <ExternalLink size={13} />
                  </a>
                ) : (
                  "Niet ingevuld"
                )}
              </dd>
              <dt>E-mail</dt>
              <dd>{p.email || "Niet ingevuld"}</dd>
              {p.address && (
                <>
                  <dt>Adres</dt>
                  <dd>{p.address}</dd>
                </>
              )}
              {p.province && (
                <>
                  <dt>Provincie</dt>
                  <dd>{p.province}</dd>
                </>
              )}
              <dt>Contactpersoon</dt>
              <dd>{p.contactPerson || "Niet ingevuld"}</dd>
            </dl>
            {p.source === "openstreetmap" &&
              p.sourceUrl &&
              safeUrl(p.sourceUrl) && (
                <div className="company-source small muted">
                  <a
                    href={safeUrl(p.sourceUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Bekijk oorspronkelijke bedrijfsvermelding
                  </a>
                  <p>
                    {p.sourceLicense || "© OpenStreetMap-bijdragers · ODbL 1.0"}
                  </p>
                  {p.sourceFetchedAt && (
                    <p>
                      Opgehaald op {dateLabel(p.sourceFetchedAt)}.
                      Contactgegevens niet handmatig gecontroleerd.
                    </p>
                  )}
                </div>
              )}
          </section>
        </aside>
      </div>
      <div className="mobile-sales-bar">
        <CallButton p={p} large />
        <button
          onClick={() => setSchedule("new")}
          aria-label="Opvolging plannen"
        >
          <CalendarPlus size={20} />
        </button>
        <button onClick={() => setEmail(true)} aria-label="E-mail genereren">
          <Mail size={20} />
        </button>
      </div>
      {edit && <ProspectForm prospect={p} onClose={() => setEdit(false)} />}{" "}
      {schedule && (
        <FollowUpForm
          prospects={[p]}
          prospectId={p.id}
          followup={schedule === "new" ? undefined : schedule}
          onClose={() => setSchedule(null)}
        />
      )}{" "}
      {email && <EmailComposer p={p} onClose={() => setEmail(false)} />}{" "}
      {remove && (
        <Confirm
          title="Notitie verwijderen?"
          danger
          onClose={() => setRemove(null)}
          onConfirm={() => deleteNote(remove)}
        >
          <p>Deze notitie wordt definitief verwijderd.</p>
        </Confirm>
      )}
      {editNote && (
        <NoteEditor note={editNote} onClose={() => setEditNote(null)} />
      )}
    </>
  );
}
function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const [content, setContent] = useState(note.content);
  const action = useAction();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Notitie bewerken" open onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await action(() => saveNote(note.prospectId, content, note.id)))
            onClose();
          setBusy(false);
        }}
      >
        <label>
          Notitie
          <textarea
            required
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Annuleren
          </button>
          <button className="primary" disabled={!content.trim() || busy}>
            Wijzigingen opslaan
          </button>
        </div>
      </form>
    </Modal>
  );
}
