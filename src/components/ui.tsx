import {
  memo,
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
  Mail,
  Globe,
} from "lucide-react";
import { Illustration, type IllustrationKind } from "./Illustration";
import { CompanyMark } from "./CompanyMark";
import { Link } from "react-router-dom";
import {
  type Prospect,
  statuses,
  priorities,
  normalizePhone,
  safeUrl,
} from "../lib/models";
import { initiateCall, changeStatus, db } from "../db/database";
type Notice = { message: string; error: boolean };
const NoticeContext = createContext<{
  notice: Notice | null;
  dismiss: () => void;
}>({ notice: null, dismiss: () => {} });
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
    <NoticeContext.Provider
      value={{ notice: feedback, dismiss: () => setFeedback(null) }}
    >
      <FeedbackContext.Provider value={notify}>
        {children}
        {feedback && (
          <div
            role={feedback.error ? "alert" : "status"}
            className={`toast ${feedback.error ? "error" : ""}`}
          >
            {feedback.error ? (
              <Illustration kind="error" compact />
            ) : (
              <Illustration kind="success" compact />
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
    </NoticeContext.Provider>
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
  const { notice, dismiss } = useContext(NoticeContext);
  const previousFocus = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          ref={content}
          className="modal-content"
          onOpenAutoFocus={() => {
            const focused = document.activeElement;
            if (
              focused instanceof HTMLElement &&
              !content.current?.contains(focused)
            )
              previousFocus.current = focused;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = previousFocus.current?.isConnected
              ? previousFocus.current
              : document.getElementById("main");
            target?.focus({ preventScroll: true });
          }}
        >
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
          {notice && (
            <div
              className={`inline-notice ${notice.error ? "error" : "success"}`}
              role={notice.error ? "alert" : "status"}
            >
              <Illustration kind={notice.error ? "error" : "success"} compact />
              <span>{notice.message}</span>
              <button
                className="icon-button"
                aria-label="Melding in dialoog sluiten"
                onClick={dismiss}
              >
                <X size={16} />
              </button>
            </div>
          )}
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
  illustration = "empty",
}: {
  title: string;
  illustration?: IllustrationKind;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Illustration kind={illustration} />
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
export const ProspectCard = memo(function ProspectCard({ p }: { p: Prospect }) {
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
        <CompanyMark p={p} />
        <span className="company-name">{p.companyName}</span>
        <ArrowUpRight size={18} />
      </Link>
      <p className="company-meta muted small">
        {[p.city || p.province, p.sector].filter(Boolean).join(" · ") ||
          "Geen sector of plaats"}
      </p>
      {p.address && <p className="small muted company-meta">{p.address}</p>}
      <p className="card-opportunity">
        {p.valueProposition || "Voeg een kans voor Amocean toe."}
      </p>
      <div className="company-contact-lines">
        {p.email ? (
          <a
            href={`mailto:${p.email}`}
            aria-label={`Mail ${p.companyName}: ${p.email}`}
          >
            <Mail size={15} aria-hidden="true" />
            <span>{p.email}</span>
          </a>
        ) : (
          <span className="small muted">E-mailadres nog niet bekend</span>
        )}
        {safeUrl(p.website) && (
          <a
            href={safeUrl(p.website)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Globe size={15} aria-hidden="true" />
            <span>{new URL(safeUrl(p.website)).hostname}</span>
          </a>
        )}
        {p.contactPerson && (
          <p className="small muted">Contactpersoon: {p.contactPerson}</p>
        )}
      </div>
      <div className="card-footer">
        <CallButton p={p} />
        <span className={`priority ${p.priority.toLowerCase()}`}>
          ● {priorities[p.priority]}
        </span>
      </div>
      {(p.source === "openstreetmap" || p.source === "alltheplaces") &&
        p.sourceUrl &&
        safeUrl(p.sourceUrl) && (
          <p className="small muted company-source">
            <a
              href={safeUrl(p.sourceUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {p.source === "openstreetmap"
                ? "OpenStreetMap-bron"
                : "All the Places-bron"}
            </a>{" "}
            · niet gecontroleerd
          </p>
        )}
      {p.followUpAt && (
        <p className="card-followup small muted">
          Opvolging: {new Date(p.followUpAt).toLocaleDateString("nl-NL")}
        </p>
      )}
    </article>
  );
});
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
      // Explicit deletion must stay deleted after reloading the application.
      await db.settings.put({ key: "bundled-catalog-disabled", value: true });
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
