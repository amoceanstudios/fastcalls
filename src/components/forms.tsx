import { prepareCompanyImage } from "../lib/companyImage";
import { CompanyMark } from "./CompanyMark";
import { useState, useContext } from "react";
import { addDays } from "date-fns";
import {
  type Prospect,
  type FollowUp,
  createProspect,
  statuses,
  priorities,
  uid,
  now,
  safeUrl,
} from "../lib/models";
import { saveProspect, saveFollowUp } from "../db/database";
import { Modal, useAction, FeedbackContext } from "./ui";
import { localInput } from "../lib/logic";
export function ProspectForm({
  prospect,
  onClose,
}: {
  prospect?: Prospect;
  onClose: () => void;
}) {
  const [p, setP] = useState(
    () => prospect ?? createProspect({ companyName: "Nieuw bedrijf" }),
  );
  const [tagText, setTagText] = useState(p.tags.join(", "));
  const [imageBusy, setImageBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const action = useAction();
  const notify = useContext(FeedbackContext);
  const field = (
    key:
      | "companyName"
      | "city"
      | "phone"
      | "website"
      | "email"
      | "contactPerson"
      | "sector",
    label: string,
    type = "text",
  ) => (
    <label>
      {label}
      <input
        required={key === "companyName"}
        type={type}
        value={p[key]}
        onChange={(e) => setP({ ...p, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <Modal
      title={prospect ? "Bedrijfsgegevens bewerken" : "Bedrijf toevoegen"}
      open
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (p.website && !safeUrl(p.website)) {
            notify("Vul een geldige http- of https-website in.", true);
            return;
          }
          setBusy(true);
          if (
            await action(() =>
              saveProspect({
                ...p,
                tags: tagText
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              }),
            )
          )
            onClose();
          setBusy(false);
        }}
      >
        <div className="company-image-field">
          <div className="company-image-preview">
            {p.logoDataUrl ? (
              <CompanyMark p={p} />
            ) : (
              <span aria-hidden="true">
                {p.companyName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="grow">
            <label>
              Bedrijfslogo of foto (optioneel)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Bedrijfsafbeelding kiezen"
                disabled={imageBusy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setImageBusy(true);
                  await action(async () => {
                    const logoDataUrl = await prepareCompanyImage(file);
                    setP((current) => ({ ...current, logoDataUrl }));
                  }, "Afbeelding toegevoegd. Kies Opslaan om te bewaren.");
                  setImageBusy(false);
                  event.target.value = "";
                }}
              />
            </label>
            <p className="small muted">
              PNG, JPEG of WebP · maximaal 3 MB · blijft lokaal
            </p>
            {p.logoDataUrl && (
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  setP((current) => ({ ...current, logoDataUrl: undefined }))
                }
              >
                Afbeelding verwijderen
              </button>
            )}
          </div>
        </div>
        <div className="form-grid">
          {field("companyName", "Bedrijfsnaam")}
          {field("city", "Plaats")}
          {field("sector", "Sector / type")}
          {field("phone", "Telefoon", "tel")}
          {field("website", "Website")}
          {field("email", "E-mail", "email")}
          {field("contactPerson", "Contactpersoon")}
          <label>
            Prioriteit
            <select
              value={p.priority}
              onChange={(e) =>
                setP({ ...p, priority: e.target.value as Prospect["priority"] })
              }
            >
              {Object.entries(priorities).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={p.status}
              onChange={(e) =>
                setP({ ...p, status: e.target.value as Prospect["status"] })
              }
            >
              {Object.entries(statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Wat Amocean kan betekenen
          <textarea
            value={p.valueProposition}
            onChange={(e) => setP({ ...p, valueProposition: e.target.value })}
            rows={4}
          />
        </label>
        <label>
          Tags (komma gescheiden)
          <input value={tagText} onChange={(e) => setTagText(e.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Annuleren
          </button>
          <button className="primary" disabled={busy || imageBusy}>
            Opslaan
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function FollowUpForm({
  prospects,
  prospectId,
  followup,
  onClose,
}: {
  prospects: Prospect[];
  prospectId?: string;
  followup?: FollowUp;
  onClose: () => void;
}) {
  const [company, setCompany] = useState(
    followup?.prospectId ?? prospectId ?? prospects[0]?.id ?? "",
  );
  const [title, setTitle] = useState(followup?.title ?? "Terugbellen");
  const [description, setDescription] = useState(followup?.description ?? "");
  const [date, setDate] = useState(
    followup
      ? localInput(new Date(followup.dueAt))
      : localInput(addDays(new Date(), 1)),
  );
  const [time, setTime] = useState(
    followup && !followup.dateOnly
      ? new Date(followup.dueAt).toTimeString().slice(0, 5)
      : "",
  );
  const [busy, setBusy] = useState(false);
  const action = useAction();
  return (
    <Modal
      title={followup ? "Opvolging bewerken" : "Opvolging plannen"}
      open
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (
            await action(() =>
              saveFollowUp({
                id: followup?.id ?? uid(),
                prospectId: company,
                title,
                description,
                dueAt: new Date(`${date}T${time || "12:00"}:00`).toISOString(),
                dateOnly: !time,
                completedAt: followup?.completedAt ?? null,
                createdAt: followup?.createdAt ?? now(),
              }),
            )
          )
            onClose();
          setBusy(false);
        }}
      >
        <label>
          Bedrijf
          <select
            required
            disabled={!!followup}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.companyName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Onderwerp
          <input
            required
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Omschrijving
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="preset-row">
          {[
            [1, "Morgen"],
            [3, "Over 3 dagen"],
            [7, "Volgende week"],
          ].map(([days, label]) => (
            <button
              type="button"
              key={days}
              onClick={() =>
                setDate(localInput(addDays(new Date(), Number(days))))
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>
            Datum
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Tijd (optioneel)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>
        <p className="small muted">
          Tijden zijn lokaal. Herinneringen verschijnen in de app; er zijn geen
          gegarandeerde meldingen als de app gesloten is.
        </p>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Annuleren
          </button>
          <button className="primary" disabled={busy || !company}>
            Opvolging opslaan
          </button>
        </div>
      </form>
    </Modal>
  );
}
