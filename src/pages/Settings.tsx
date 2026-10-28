import { Reveal } from "../components/Reveal";
import { useEffect, useState, useContext } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { Save, Shield, HardDrive, Download, Trash2 } from "lucide-react";
import { db, saveProfile } from "../db/database";
import { defaultProfile, type Profile, statuses } from "../lib/models";
import { templates, tones } from "../lib/logic";
import { useAction, Modal, clearData, FeedbackContext } from "../components/ui";
import { downloadBackup } from "../lib/transfer";
export default function Settings() {
  const stored = useLiveQuery(() => db.settings.get("profile"));
  const [p, setP] = useState<Profile>(defaultProfile);
  const [dirty, setDirty] = useState(false);
  const [clear, setClear] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<StorageEstimate | null>(null);
  const [persistent, setPersistent] = useState(false);
  const count = useLiveQuery(async () => ({
    p: await db.prospects.count(),
    n: await db.notes.count(),
    f: await db.followups.count(),
    d: await db.drafts.count(),
  }));
  const action = useAction();
  const notify = useContext(FeedbackContext);
  useEffect(() => {
    if (!dirty) setP((stored?.value as Profile) ?? defaultProfile);
  }, [stored, dirty]);
  useEffect(() => {
    void navigator.storage?.estimate().then(setStorage);
    void navigator.storage?.persisted().then(setPersistent);
  }, []);
  const update = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setP({ ...p, [k]: v });
    setDirty(true);
  };
  const field = (
    k: "name" | "company" | "email" | "phone" | "website",
    label: string,
    type = "text",
  ) => (
    <label>
      {label}
      <input
        value={p[k]}
        type={type}
        required={k === "company"}
        onChange={(e) => update(k, e.target.value)}
      />
    </label>
  );
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">OP UW MANIER</div>
          <h1>
            Instellingen<span className="accent">.</span>
          </h1>
          <p>Een persoonlijk werkstation, klaar voor uw werkdag.</p>
        </div>
      </header>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await action(() => saveProfile(p))) setDirty(false);
          setBusy(false);
        }}
      >
        <div className="settings-grid">
          <Reveal className="panel">
            <h2>Uw afzenderprofiel</h2>
            <p className="muted small">
              Deze gegevens worden gebruikt in uw e-mailconcepten. Onbekende
              gegevens blijven leeg.
            </p>
            <div className="form-grid">
              {field("name", "Naam")}
              {field("company", "Bedrijf")}
              {field("email", "E-mail", "email")}
              {field("phone", "Telefoon", "tel")}
              {field("website", "Website")}
            </div>
            <label>
              E-mailhandtekening (optioneel)
              <textarea
                rows={4}
                value={p.signature}
                onChange={(e) => update("signature", e.target.value)}
              />
            </label>
            <p className="small muted">
              Amocean ·{" "}
              <a href="https://amocean.nl" target="_blank" rel="noreferrer">
                amocean.nl
              </a>{" "}
              ·{" "}
              <a href="https://amocean.ai" target="_blank" rel="noreferrer">
                amocean.ai
              </a>
            </p>
          </Reveal>
          <div className="stack">
            <Reveal className="panel">
              <h2>Uiterlijk</h2>
              <label>
                Kleurthema
                <select
                  value={p.theme}
                  onChange={(e) =>
                    update("theme", e.target.value as Profile["theme"])
                  }
                >
                  <option value="system">Systeemvoorkeur</option>
                  <option value="light">Licht</option>
                  <option value="dark">Donker</option>
                </select>
              </label>
              <label>
                Weergave
                <select
                  value={p.density}
                  onChange={(e) =>
                    update("density", e.target.value as Profile["density"])
                  }
                >
                  <option value="comfortable">Ruim</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
            </Reveal>
            <Reveal className="panel">
              <h2>Salesworkflow</h2>
              <label>
                Standaardwachtrij
                <select
                  value={p.queue}
                  onChange={(e) =>
                    update("queue", e.target.value as Profile["queue"])
                  }
                >
                  <option value="all">Alle actiegerichte prospects</option>
                  <option value="new">Alleen te bellen</option>
                  <option value="high">Alleen hoge prioriteit</option>
                </select>
              </label>
              <label>
                Standaard e-mailsjabloon
                <select
                  value={p.template}
                  onChange={(e) => update("template", Number(e.target.value))}
                >
                  {templates.map((t, i) => (
                    <option key={t} value={i}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Standaardtoon
                <select
                  value={p.tone}
                  onChange={(e) => update("tone", e.target.value)}
                >
                  {tones.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Status na bevestigd gesprek
                <select
                  value={p.conversationStatus}
                  onChange={(e) =>
                    update(
                      "conversationStatus",
                      e.target.value as Profile["conversationStatus"],
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
            </Reveal>
          </div>
        </div>
        <div className="form-actions">
          <span className="small muted">
            {dirty ? "Niet-opgeslagen wijzigingen" : ""}
          </span>
          <button disabled={!dirty || busy} className="primary">
            <Save size={16} />
            Instellingen opslaan
          </button>
        </div>
      </form>
      <div className="settings-grid">
        <Reveal className="panel">
          <h2>
            <HardDrive size={19} />
            Lokale opslag
          </h2>
          <p>
            {count?.p ?? 0} bedrijven · {count?.n ?? 0} notities ·{" "}
            {count?.f ?? 0} opvolgingen · {count?.d ?? 0} concepten
          </p>
          <p className="small muted">
            {storage
              ? `${((storage.usage ?? 0) / 1024 / 1024).toFixed(1)} MB gebruikt van circa ${((storage.quota ?? 0) / 1024 / 1024).toFixed(0)} MB beschikbaar.`
              : "Opslaginformatie niet beschikbaar."}
          </p>
          <p className="small">
            {persistent
              ? "Permanente browseropslag toegekend. Blijf regelmatig back-ups maken."
              : "Uw browser kan opslagruimte opruimen. Maak regelmatig een back-up."}
          </p>
          {!persistent && (
            <button
              onClick={() =>
                void action(async () => {
                  if (!navigator.storage?.persist)
                    throw new Error("Uw browser ondersteunt deze functie niet");
                  const granted = await navigator.storage.persist();
                  setPersistent(granted);
                  if (!granted)
                    notify(
                      "Uw browser heeft permanente opslag niet toegekend. Maak regelmatig back-ups.",
                    );
                }, "")
              }
            >
              <Shield size={16} />
              Vraag permanente opslag aan
            </button>
          )}
          <Link className="button" to="/data">
            Import, export en back-ups
          </Link>
        </Reveal>
        <Reveal className="panel">
          <h2>Over Prospect OS</h2>
          <p>Amocean Prospect OS · versie 1.0.0</p>
          <p className="small muted">
            Gegevens worden uitsluitend in deze browser opgeslagen. Geen
            account, backend, tracking of automatische synchronisatie. Lokale
            opslag is geen versleutelde cloudkluis.
          </p>
          <h3>Installeren als app</h3>
          <p className="small">
            Gebruik in Safari 'Deel → Zet op beginscherm', of in Chrome
            'Installeren'. Open de app eerst online zodat alle onderdelen
            offline beschikbaar zijn. Vereist HTTPS (of localhost voor
            ontwikkeling).
          </p>
          <p className="small">
            Telefoongesprekken en externe websites hebben eigen apparaat- en
            netwerkvereisten. E-mailconcepten genereren werkt offline.
          </p>
        </Reveal>
      </div>
      <Reveal className="panel danger-panel">
        <div>
          <h2>Alle lokale gegevens wissen</h2>
          <p className="muted small">
            Verwijdert bedrijven, notities, concepten, historie, opvolgingen en
            instellingen op dit apparaat.
          </p>
        </div>
        <button className="danger-outline" onClick={() => setClear(true)}>
          <Trash2 size={16} />
          Gegevens wissen
        </button>
      </Reveal>
      {clear && (
        <Modal
          title="Alle lokale gegevens wissen?"
          description="Dit is definitief. Download eerst een volledige back-up."
          open
          onClose={() => {
            if (!busy) setClear(false);
          }}
        >
          <button
            onClick={() =>
              void action(() => downloadBackup(), "Back-updownload gestart")
            }
          >
            <Download size={16} />
            Back-up downloaden
          </button>
          <label>
            Typ ALLES WISSEN om te bevestigen
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button onClick={() => setClear(false)}>Annuleren</button>
            <button
              className="danger"
              disabled={confirmation !== "ALLES WISSEN" || busy}
              onClick={async () => {
                setBusy(true);
                if (
                  await action(async () => {
                    await downloadBackup();
                    await clearData();
                    for (const key of Object.keys(localStorage))
                      if (
                        key.startsWith("note-draft-") ||
                        key.startsWith("call-summary-") ||
                        ["directory-filters", "calling-session"].includes(key)
                      )
                        localStorage.removeItem(key);
                  }, "Alle lokale gegevens gewist")
                ) {
                  setClear(false);
                  setConfirmation("");
                  setP(defaultProfile);
                  setDirty(false);
                }
                setBusy(false);
              }}
            >
              Definitief wissen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
