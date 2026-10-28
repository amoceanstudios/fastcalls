import { createProspect } from "../lib/models";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Square, ArrowRight } from "lucide-react";
import {
  DiscoveryResponseSchema,
  provinceCodes,
  provinces,
  sourceLicense,
  type Province,
} from "../lib/companyDiscovery";
import { saveDiscoveredCompanies } from "../db/discovery";

type Result = {
  province: Province;
  added: number;
  skipped: number;
  invalid: number;
  limited: boolean;
  error?: string;
};
export function CompanyDiscovery() {
  const [scope, setScope] = useState("all");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<Province | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [stopped, setStopped] = useState(false);
  const [storageError, setStorageError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const totals = results.reduce(
    (sum, r) => ({
      added: sum.added + r.added,
      skipped: sum.skipped + r.skipped,
    }),
    { added: 0, skipped: 0 },
  );
  const failures = results.filter((r) => r.error).map((r) => r.province);
  async function start(codes: Province[]) {
    // Guard rapid repeat clicks before React has committed the disabled state.
    if (controller.current && !controller.current.signal.aborted) return;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setStopped(false);
    setStorageError("");
    setResults([]);
    try {
      for (const province of codes) {
        if (abort.signal.aborted) break;
        setCurrent(province);
        let data;
        try {
          const response = await fetch(
            `/.netlify/functions/discover-companies?province=${province}`,
            {
              signal: AbortSignal.any([
                abort.signal,
                AbortSignal.timeout(35000),
              ]),
              headers: { Accept: "application/json" },
            },
          );
          if (
            !response.headers.get("content-type")?.includes("application/json")
          )
            throw new Error(
              "Landelijk zoeken is beschikbaar op de Netlify-versie van deze app. Controleer of de nieuwste deployment klaar is.",
            );
          const body = await response.json();
          if (!response.ok)
            throw new Error(
              typeof body?.error === "string"
                ? body.error
                : "De bron is niet bereikbaar. Probeer het later opnieuw.",
            );
          const parsed = DiscoveryResponseSchema.safeParse(body);
          if (!parsed.success)
            throw new Error(
              "De bron stuurde onbruikbare gegevens. Er is niets opgeslagen.",
            );
          data = parsed.data;
          if (data.province !== province)
            throw new Error(
              "De bron stuurde gegevens voor een andere provincie. Er is niets opgeslagen.",
            );
        } catch (error) {
          if (abort.signal.aborted) break;
          setResults((items) => [
            ...items,
            {
              province,
              added: 0,
              skipped: 0,
              invalid: 0,
              limited: false,
              error:
                error instanceof Error ? error.message : "Ophalen mislukt.",
            },
          ]);
          continue;
        }
        if (abort.signal.aborted) break;
        try {
          const saved = await saveDiscoveredCompanies(
            data.records.map((record) =>
              createProspect({ ...record, source: "openstreetmap" }),
            ),
          );
          setResults((items) => [
            ...items,
            {
              province,
              ...saved,
              limited: data.limited,
              invalid: data.invalid,
            },
          ]);
        } catch {
          setStorageError(
            "Opslaan op dit apparaat is mislukt. Controleer de beschikbare browseropslag. Eerder opgeslagen provincies blijven behouden; deze provincie is niet toegevoegd.",
          );
          break;
        }
      }
    } finally {
      setStopped(abort.signal.aborted);
      setCurrent(null);
      setRunning(false);
      controller.current = null;
    }
  }
  return (
    <section
      id="discover"
      className="panel discovery-panel"
      aria-labelledby="discovery-title"
    >
      <div className="eyebrow">ECHTE BEDRIJVEN · HEEL NEDERLAND</div>
      <h2 id="discovery-title">Vul uw bedrijvenlijst</h2>
      <p>
        Zoek in alle twaalf provincies naar openbare bedrijfsvermeldingen met
        een telefoonnummer. E-mail en website gaan mee wanneer de bron ze
        vermeldt. Bedrijven worden direct lokaal opgeslagen, ingedeeld per
        branche.
      </p>
      <div className="discovery-controls">
        <label>
          Zoekgebied
          <select
            value={scope}
            disabled={running}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value="all">Heel Nederland · alle provincies</option>
            {provinceCodes.map((code) => (
              <option key={code} value={code}>
                {provinces[code]}
              </option>
            ))}
          </select>
        </label>
        {running ? (
          <button onClick={() => controller.current?.abort()}>
            <Square size={16} /> Stoppen
          </button>
        ) : (
          <button
            className="primary"
            onClick={() =>
              void start(scope === "all" ? provinceCodes : [scope as Province])
            }
          >
            <Search size={17} /> Zoeken &amp; opslaan
          </button>
        )}
      </div>
      <p className="small muted">
        Alle beschikbare branches, waaronder horeca, beauty, bouw, winkels, zorg
        en zakelijke diensten. Heel Nederland kan enkele minuten duren. Eerder
        opgeslagen bedrijven, notities en statussen blijven intact.
      </p>
      <div role="status" aria-live="polite" aria-atomic="true">
        {running && (
          <p>
            <strong>
              {current ? `${provinces[current]} ophalen…` : "Zoeken starten…"}
            </strong>{" "}
            {results.length} provincies verwerkt.
          </p>
        )}
        {(results.length > 0 || stopped) && (
          <p>
            {stopped ? "Gestopt. " : !running ? "Zoekronde afgerond. " : ""}
            <strong>
              {totals.added} {totals.added === 1 ? "bedrijf" : "bedrijven"}{" "}
              opgeslagen.
            </strong>{" "}
            {totals.skipped} bestaande of dubbele vermeldingen overgeslagen.
          </p>
        )}
      </div>
      {storageError && (
        <p role="alert" className="discovery-error">
          {storageError}
        </p>
      )}
      {results.length > 0 && (
        <ul className="discovery-results">
          {results.map((r) => (
            <li key={r.province}>
              <strong>{provinces[r.province]}</strong>
              <span>
                {r.error || `${r.added} toegevoegd · ${r.skipped} overgeslagen`}
              </span>
              {r.limited && (
                <span className="discovery-error">
                  Limiet van 8.000 resultaten bereikt; deze provincie is niet
                  volledig opgehaald.
                </span>
              )}
              {r.invalid > 0 && (
                <span className="small muted">
                  {r.invalid} vermeldingen zonder bruikbare gegevens niet
                  overgenomen.
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!running && failures.length > 0 && !storageError && (
        <button onClick={() => void start(failures)}>
          Mislukte provincies opnieuw proberen
        </button>
      )}
      {totals.added > 0 && (
        <Link to="/prospects" className="button">
          Bekijk uw bedrijven <ArrowRight size={16} />
        </Link>
      )}
      <p className="small muted discovery-attribution">
        Bron:{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          {sourceLicense}
        </a>
        . Geen volledig bedrijvenregister; contactgegevens zijn overgenomen uit
        de bron en niet handmatig gecontroleerd. Alleen het gekozen zoekgebied
        wordt naar de ophaaldienst gestuurd. Uw CRM-gegevens blijven op uw
        apparaat.
      </p>
    </section>
  );
}
