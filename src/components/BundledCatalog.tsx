import { useEffect, useState, useSyncExternalStore } from "react";
import { Building2, X } from "lucide-react";
import {
  getCatalogState,
  installBundledCatalog,
  subscribeCatalog,
} from "../lib/catalogInstaller";
export function BundledCatalog() {
  const state = useSyncExternalStore(subscribeCatalog, getCatalogState);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const start = () => {
      void installBundledCatalog();
    };
    start();
    window.addEventListener("online", start);
    return () => window.removeEventListener("online", start);
  }, []);
  if (
    dismissed ||
    state.phase === "idle" ||
    (state.phase === "done" && !state.added)
  )
    return null;
  return (
    <div
      className={`status-banner ${state.phase === "error" ? "warning" : ""}`}
    >
      <Building2 size={17} aria-hidden="true" />
      <span role="status">
        {state.phase === "loading"
          ? `Uw landelijke bedrijvenlijst wordt toegevoegd · ${state.processed.toLocaleString("nl-NL")} van ${state.total.toLocaleString("nl-NL")}`
          : state.phase === "error"
            ? "De bedrijvenlijst kon nog niet volledig worden toegevoegd. Eerder opgeslagen bedrijven blijven behouden."
            : `${state.added.toLocaleString("nl-NL")} bedrijfsvermeldingen automatisch toegevoegd. Bekijk ze bij Bedrijven.`}
      </span>
      {state.phase === "error" && (
        <button onClick={() => void installBundledCatalog()}>
          Opnieuw proberen
        </button>
      )}
      {state.phase === "done" && (
        <button
          className="icon-button"
          aria-label="Melding bedrijvenlijst sluiten"
          onClick={() => setDismissed(true)}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
