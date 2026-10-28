import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Phone,
  Building2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  type Prospect,
  statuses,
  priorities,
  normalizePhone,
} from "../lib/models";
import { initiateCall, changeStatus, db } from "../db/database";
export const FeedbackContext = createContext<
  (message: string, error?: boolean) => void
>(() => {});
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const notify = (message: string, error = false) => {
    if (timer.current) clearTimeout(timer.current);
    setFeedback({ message, error });
    if (!error) timer.current = setTimeout(() => setFeedback(null), 4500);
  };
  return (
    <FeedbackContext.Provider value={notify}>
      {children}
      {feedback && (
        <div
          role={feedback.error ? "alert" : "status"}
          className={`toast ${feedback.error ? "error" : ""}`}
        >
          {feedback.error ? (
            <AlertCircle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <span>{feedback.message}</span>
          <button
            aria-label="Melding sluiten"
            onClick={() => setFeedback(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
export function useAction() {
  const notify = useContext(FeedbackContext);
  return async (fn: () => Promise<unknown>, message = "Opgeslagen") => {
    try {
      await fn();
      if (message) notify(message);
      return true;
    } catch (e) {
      console.error(e);
      notify(
        e instanceof Error
          ? `Niet gelukt: ${e.message}`
          : "Opslaan mislukt. Controleer de beschikbare opslagruimte.",
        true,
      );
      return false;
    }
  };
}
export function Modal({
  title,
  description,
  open,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content">
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description ?? "Wijzig de gegevens en sla uw wijzigingen op."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Sluiten">
              <X />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Building2 size={30} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function StatusBadge({ p }: { p: Prospect }) {
  return (
    <span className={`badge status-${p.status}`}>{statuses[p.status]}</span>
  );
}
export function CallButton({
  p,
  large = false,
}: {
  p: Prospect;
  large?: boolean;
}) {
  const action = useAction();
  const phone = normalizePhone(p.phone);
  if (!phone)
    return (
      <span className="muted small">
        {p.phone ? "Telefoonnummer controleren" : "Geen telefoonnummer"}
      </span>
    );
  return (
    <a
      className={`button ${large ? "primary large" : "call-button"}`}
      href={`tel:${phone}`}
      onClick={() => {
        void action(async () => {
          await initiateCall(p);
        }, "Belactie gestart. Leg de uitkomst zelf vast.");
      }}
    >
      <Phone size={17} />
      {large ? "Bel nu" : p.phone || "Bellen"}
    </a>
  );
}
export function ProspectCard({ p }: { p: Prospect }) {
  const action = useAction();
  return (
    <article className="prospect-card">
      <div className="card-top">
        <div className="company-avatar">
          {p.companyName.slice(0, 2).toUpperCase()}
        </div>
        <select
          className="quick-status"
          aria-label={`Status van ${p.companyName}`}
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
      </div>
      <Link to={`/prospects/${p.id}`} className="company-title">
        {p.companyName}
        <ArrowUpRight size={18} />
      </Link>
      <p className="muted small">
        {[p.city, p.sector].filter(Boolean).join(" · ") ||
          "Geen sector of plaats"}
      </p>
      <p className="card-opportunity">
        {p.valueProposition || "Voeg een kans voor Amocean toe."}
      </p>
      <div className="card-footer">
        <CallButton p={p} />
        <span className={`priority ${p.priority.toLowerCase()}`}>
          ● {priorities[p.priority]}
        </span>
      </div>
      {p.followUpAt && (
        <p className="small muted">
          Opvolging: {new Date(p.followUpAt).toLocaleDateString("nl-NL")}
        </p>
      )}
    </article>
  );
}
export function Confirm({
  title,
  children,
  onConfirm,
  onClose,
  danger = false,
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const action = useAction();
  return (
    <Modal title={title} open onClose={onClose}>
      <div>{children}</div>
      <div className="form-actions">
        <button onClick={onClose}>Annuleren</button>
        <button
          className={danger ? "danger" : "primary"}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await action(onConfirm)) onClose();
            setBusy(false);
          }}
        >
          Bevestigen
        </button>
      </div>
    </Modal>
  );
}
export function usePreference<T>(key: string, initial: T): [T, (v: T) => void] {
  // UI preferences only; business records always live in IndexedDB.
  const [value, setValue] = useState<T>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null") ?? initial;
    } catch {
      return initial;
    }
  });
  const notify = useContext(FeedbackContext);
  return [
    value,
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        notify(
          "Deze voorkeur kon niet worden bewaard. Exporteer een back-up bij opslagproblemen.",
          true,
        );
      }
    },
  ];
}
export async function clearData() {
  await db.transaction(
    "rw",
    [
      db.prospects,
      db.notes,
      db.followups,
      db.calls,
      db.activities,
      db.drafts,
      db.settings,
    ],
    async () => {
      for (const table of db.tables) await table.clear();
    },
  );
}

export function useWorkingDraft(key: string): [string, (v: string) => void] {
  const [value, setValue] = useState("");
  const touched = useRef(false);
  const notify = useContext(FeedbackContext);
  useEffect(() => {
    void db.settings
      .get(key)
      .then((row) => {
        if (!touched.current && typeof row?.value === "string")
          setValue(row.value);
      })
      .catch(() => notify("Concept kon niet worden geladen.", true));
  }, [key]);
  return [
    value,
    (v: string) => {
      touched.current = true;
      setValue(v);
      void db.settings
        .put({ key, value: v })
        .catch(() =>
          notify(
            "Concept kon niet worden bewaard. Kopieer uw tekst als back-up.",
            true,
          ),
        );
    },
  ];
}
