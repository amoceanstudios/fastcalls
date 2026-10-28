import { useState, useContext, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Upload,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { db, importProspects } from "../db/database";
import {
  readImport,
  autoMapping,
  previewImport,
  fields,
  type RawFile,
  type Mapping,
  downloadBackup,
  download,
  toCSV,
  exportExcel,
  validateBackup,
  restoreBackup,
  type Backup,
} from "../lib/transfer";
import { FeedbackContext, useAction, Modal } from "../components/ui";
export default function DataCenter() {
  const prospects = useLiveQuery(() => db.prospects.toArray()) ?? [];
  const notes = useLiveQuery(() => db.notes.toArray()) ?? [];
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update" | "new">(
    "skip",
  );
  const [raw, setRaw] = useState<RawFile | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [filename, setFilename] = useState("");
  const [backup, setBackup] = useState<Backup | null>(null);
  const [replace, setReplace] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const action = useAction();
  const notify = useContext(FeedbackContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview =
    raw && mapping ? previewImport(raw, mapping, prospects) : null;
  async function load(file: File) {
    setBusy(true);
    setSummary("");
    try {
      const result = await readImport(file);
      setRaw(result);
      setMapping(autoMapping(result.headers));
      setFilename(file.name);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    await action(async () => {
      if (prospects.length) await downloadBackup();
      const result = await importProspects(
        [
          ...preview.valid,
          ...(duplicateMode === "skip" ? [] : preview.duplicateRecords),
        ],
        duplicateMode,
      );
      setSummary(
        `${result.added} prospects geïmporteerd. ${duplicateMode === "skip" ? preview.duplicates.length + result.skipped : result.skipped} duplicaten overgeslagen. ${result.updated} bedrijven bijgewerkt. ${preview.errors.length} ongeldige rijen niet geïmporteerd.`,
      );
      setRaw(null);
      setMapping(null);
    }, "Import afgerond");
    setBusy(false);
  };
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">UW GEGEVENS BLIJVEN VAN U</div>
          <h1>
            Gegevens & back-ups<span className="accent">.</span>
          </h1>
          <p>Van spreadsheet naar werkstation. Veilig in uw eigen browser.</p>
        </div>
        <span className="privacy-pill">
          <ShieldCheck size={16} />
          100% lokale verwerking
        </span>
      </header>
      <div className="data-columns">
        <section className="panel import-panel">
          <div className="section-icon">
            <Upload size={24} />
          </div>
          <h2>Breng uw prospects mee</h2>
          <p>
            Importeer uw Excel-, CSV- of JSON-lijst. U controleert de kolommen
            voordat er iets wordt opgeslagen.
          </p>
          <label
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void load(file);
            }}
          >
            <FileSpreadsheet size={34} />
            <strong>
              {busy
                ? "Bestand verwerken…"
                : "Kies een bestand of sleep het hierheen"}
            </strong>
            <span>XLSX, CSV of JSON · maximaal 15 MB</span>
            <input
              ref={inputRef}
              aria-label="Prospectbestand importeren"
              type="file"
              accept=".xlsx,.csv,.json,.xls"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void load(f);
              }}
            />
          </label>
          <p className="small muted">
            Eerste werkblad, met kolomnamen op rij 1. Oud XLS? Sla het op als
            XLSX. Er zijn nog geen echte prospectgegevens aangeleverd.
          </p>
          <div className="info-box">
            <ShieldCheck size={19} />
            <span>
              Bestaande notities, statussen en opvolgingen blijven intact.
              Duplicaten worden overgeslagen.
            </span>
          </div>
        </section>
        <div className="stack">
          <section className="panel">
            <h2>Een kopie voor de zekerheid</h2>
            <p className="muted">
              Een volledige JSON-back-up bevat uw bedrijven, notities, historie,
              concepten, opvolgingen en profiel.
            </p>
            <button
              className="primary full"
              onClick={() =>
                void action(() => downloadBackup(), "Back-updownload gestart")
              }
            >
              <Download size={17} />
              Volledige back-up downloaden
            </button>
            <p className="small muted">
              Bewaar back-ups op een veilige plek. Browsergegevens kunnen door
              uw browser of apparaat worden gewist.
            </p>
          </section>
          <section className="panel">
            <h2>Exporteren</h2>
            <p className="muted small">
              {prospects.length} prospects. CSV bevat de laatste notitie; Excel
              bevat aparte werkbladen. JSON-back-up bewaart alle gegevens.
            </p>
            <div className="action-row wrap">
              <button
                onClick={() =>
                  download(
                    toCSV(prospects, notes),
                    "amocean-prospects.csv",
                    "text/csv;charset=utf-8",
                  )
                }
              >
                <Download size={16} />
                CSV
              </button>
              <button
                onClick={() =>
                  void action(
                    () => exportExcel(prospects),
                    "Excel-export gestart",
                  )
                }
              >
                <Download size={16} />
                Excel
              </button>
              <button
                onClick={() =>
                  download(
                    JSON.stringify(prospects, null, 2),
                    "amocean-prospects.json",
                  )
                }
              >
                JSON-lijst
              </button>
            </div>
          </section>
        </div>
      </div>
      <section className="panel restore-panel">
        <div>
          <h2>Back-up herstellen</h2>
          <p className="muted">
            Valideer en bekijk een eerdere back-up voordat u deze samenvoegt of
            terugzet.
          </p>
        </div>
        <label className="button">
          <Upload size={16} />
          Kies JSON-back-up
          <input
            className="visually-hidden"
            type="file"
            accept=".json"
            aria-label="JSON-back-up kiezen"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 30 * 1024 * 1024)
                  throw new Error("Back-up is te groot (maximaal 30 MB).");
                const b = validateBackup(JSON.parse(await file.text()));
                setBackup(b);
                setReplace(false);
                setConfirm("");
              } catch (error) {
                notify(
                  `Back-up niet geldig: ${(error as Error).message}`,
                  true,
                );
              }
              e.target.value = "";
            }}
          />
        </label>
      </section>
      {summary && (
        <div className="success-box" role="status">
          <CheckCircle2 size={20} />
          {summary}
        </div>
      )}
      {preview && raw && mapping && (
        <Modal
          title="Controleer uw import"
          description={`${filename} · ${raw.rows.length} rijen gevonden. Er is nog niets opgeslagen.`}
          open
          onClose={() => {
            if (!busy) {
              setRaw(null);
              setMapping(null);
            }
          }}
        >
          <div className="mapping-grid">
            {Object.entries(fields).map(([k, label]) => (
              <label key={k}>
                {label}
                {k === "companyName" ? " *" : ""}
                <select
                  value={mapping[k as keyof Mapping]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [k]: e.target.value })
                  }
                >
                  <option value="">Niet importeren</option>
                  {raw.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label>
            Dubbele bedrijven
            <select
              value={duplicateMode}
              onChange={(e) =>
                setDuplicateMode(e.target.value as typeof duplicateMode)
              }
            >
              <option value="skip">
                Duplicaten overslaan (veiligste keuze)
              </option>
              <option value="update">
                Alleen basisgegevens bijwerken; statussen en notities behouden
              </option>
              <option value="new">
                Bewust als nieuwe bedrijven importeren
              </option>
            </select>
          </label>
          <div className="import-counts">
            <span>
              <b>{preview.valid.length}</b> geldig
            </span>
            <span>
              <b>{preview.duplicates.length}</b> duplicaten
            </span>
            <span>
              <b>{preview.errors.length}</b> fouten
            </span>
          </div>
          <div className="preview-table">
            <table>
              <caption>Voorbeeld van maximaal 5 geldige records</caption>
              <thead>
                <tr>
                  <th>Bedrijf</th>
                  <th>Plaats</th>
                  <th>Telefoon</th>
                  <th>Kans</th>
                </tr>
              </thead>
              <tbody>
                {preview.valid.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td>{p.companyName}</td>
                    <td>{p.city}</td>
                    <td>{p.phone}</td>
                    <td>{p.valueProposition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.duplicates.length > 0 && (
            <p className="small">
              Duplicaten op rijen: {preview.duplicates.join(", ")}. Herkend op
              telefoon, website of bedrijfsnaam + plaats.
            </p>
          )}
          {[...preview.errors, ...preview.warnings].length > 0 && (
            <details>
              <summary>
                Rijfouten en waarschuwingen (
                {preview.errors.length + preview.warnings.length})
              </summary>
              <ul>
                {preview.errors.map((e, i) => (
                  <li key={`e${i}`}>
                    Rij {e.row}: {e.message}
                  </li>
                ))}
                {preview.warnings.map((e, i) => (
                  <li key={`w${i}`}>
                    Rij {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="small muted">
            Bij bestaande gegevens start eerst een veiligheidsback-updownload.
            Controleer of uw browser deze toestaat.
          </p>
          <div className="form-actions">
            <button
              disabled={busy}
              onClick={() => {
                setRaw(null);
                setMapping(null);
              }}
            >
              Annuleren
            </button>
            <button
              className="primary"
              disabled={
                busy ||
                !(
                  preview.valid.length +
                  (duplicateMode === "skip"
                    ? 0
                    : preview.duplicateRecords.length)
                ) ||
                !mapping.companyName
              }
              onClick={() => void commit()}
            >
              {preview.valid.length +
                (duplicateMode === "skip"
                  ? 0
                  : preview.duplicateRecords.length)}{" "}
              prospects importeren <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {backup && (
        <Modal
          title="Back-up terugzetten"
          description="Bekijk de inhoud en kies hoe u de gegevens wilt herstellen."
          open
          onClose={() => {
            if (!busy) setBackup(null);
          }}
        >
          <p>
            Back-up van {new Date(backup.exportedAt).toLocaleString("nl-NL")}
          </p>
          <div className="import-counts">
            <span>
              <b>{backup.prospects.length}</b> bedrijven
            </span>
            <span>
              <b>{backup.notes.length}</b> notities
            </span>
            <span>
              <b>{backup.followups.length}</b> opvolgingen
            </span>
            <span>
              <b>{backup.calls.length}</b> belacties
            </span>
            <span>
              <b>{backup.drafts.length}</b> concepten
            </span>
          </div>
          <p>
            Standaard worden alleen ontbrekende gegevens toegevoegd. Bestaande
            statussen, teksten en notities worden niet overschreven.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            Alle huidige gegevens vervangen door deze back-up
          </label>
          {replace && (
            <label>
              Typ HERSTELLEN om vervanging te bevestigen
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          )}
          <p className="small muted">
            Vóór herstel wordt een back-up van de huidige gegevens gedownload.
            Bewaar die voordat u verdergaat.
          </p>
          <div className="form-actions">
            <button disabled={busy} onClick={() => setBackup(null)}>
              Annuleren
            </button>
            <button
              className={replace ? "danger" : "primary"}
              disabled={busy || (replace && confirm !== "HERSTELLEN")}
              onClick={async () => {
                setBusy(true);
                await action(async () => {
                  await downloadBackup();
                  const count = await restoreBackup(
                    backup,
                    replace ? "replace" : "merge",
                  );
                  setSummary(
                    `Back-up hersteld. ${count} bedrijven toegevoegd; gekoppelde gegevens hersteld.`,
                  );
                  setBackup(null);
                }, "Herstel afgerond");
                setBusy(false);
              }}
            >
              Herstel bevestigen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
