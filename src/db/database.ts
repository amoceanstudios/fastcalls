import Dexie, { type Table } from "dexie";
import {
  type Prospect,
  type Note,
  type FollowUp,
  type Call,
  type Activity,
  type Draft,
  type Profile,
  ProspectSchema,
  NoteSchema,
  FollowUpSchema,
  CallSchema,
  DraftSchema,
  defaultProfile,
  ProfileSchema,
  uid,
  now,
  normalizePhone,
  safeUrl,
  statuses,
  duplicate,
} from "../lib/models";
export class ProspectDatabase extends Dexie {
  prospects!: Table<Prospect, string>;
  notes!: Table<Note, string>;
  followups!: Table<FollowUp, string>;
  calls!: Table<Call, string>;
  activities!: Table<Activity, string>;
  drafts!: Table<Draft, string>;
  settings!: Table<{ key: string; value: unknown }, string>;
  constructor(name = "amocean-prospect-os") {
    super(name);
    this.version(1).stores({
      prospects: "id,companyName,status,priority,updatedAt",
      notes: "id,prospectId,createdAt",
      followups: "id,prospectId,dueAt",
      calls: "id,prospectId,initiatedAt",
      activities: "id,prospectId,createdAt",
      drafts: "id,prospectId",
      settings: "key",
    });
    this.version(2)
      .stores({
        prospects: "id,companyName,status,priority,updatedAt,phoneNormalized",
      })
      .upgrade(async (tx) => {
        await tx
          .table("prospects")
          .toCollection()
          .modify((p) => {
            p.phoneNormalized = normalizePhone(p.phone ?? "");
          });
        await tx
          .table("followups")
          .toCollection()
          .modify((f) => {
            f.dateOnly ??= false;
          });
        await tx
          .table("calls")
          .toCollection()
          .modify((c) => {
            c.confirmedAt ??= null;
          });
      });
  }
}
export const db = new ProspectDatabase();
export const tables = [
  db.prospects,
  db.notes,
  db.followups,
  db.calls,
  db.activities,
  db.drafts,
  db.settings,
];
const activity = (
  prospectId: string,
  type: string,
  description: string,
): Activity => ({ id: uid(), prospectId, type, description, createdAt: now() });
export async function saveProspect(input: Prospect) {
  const p = ProspectSchema.parse({
    ...input,
    phoneNormalized: normalizePhone(input.phone),
    website: safeUrl(input.website),
    updatedAt: now(),
  });
  await db.transaction("rw", db.prospects, db.activities, async () => {
    const old = await db.prospects.get(p.id);
    await db.prospects.put(p);
    await db.activities.add(
      activity(
        p.id,
        old?.status !== p.status ? "STATUS_CHANGED" : "PROSPECT_UPDATED",
        old
          ? old.status !== p.status
            ? `Status gewijzigd van ${statuses[old.status]} naar ${statuses[p.status]}`
            : "Bedrijfsgegevens bijgewerkt"
          : "Prospect toegevoegd",
      ),
    );
  });
}
export async function changeStatus(p: Prospect, status: Prospect["status"]) {
  await saveProspect({ ...p, status });
}
export async function saveNote(
  prospectId: string,
  content: string,
  id?: string,
) {
  await db.transaction("rw", db.notes, db.activities, async () => {
    const old = id ? await db.notes.get(id) : undefined;
    const note = NoteSchema.parse({
      id: id ?? uid(),
      prospectId,
      content,
      createdAt: old?.createdAt ?? now(),
      updatedAt: now(),
    });
    await db.notes.put(note);
    await db.activities.add(
      activity(
        prospectId,
        "NOTE_SAVED",
        old ? "Notitie bewerkt" : "Notitie toegevoegd",
      ),
    );
  });
}
export async function deleteNote(note: Note) {
  await db.transaction("rw", db.notes, db.activities, async () => {
    await db.notes.delete(note.id);
    await db.activities.add(
      activity(note.prospectId, "NOTE_DELETED", "Notitie verwijderd"),
    );
  });
}
async function syncFollowUp(prospectId: string) {
  const pending = (
    await db.followups.where("prospectId").equals(prospectId).toArray()
  )
    .filter((f) => !f.completedAt)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  await db.prospects.update(prospectId, {
    followUpAt: pending[0]?.dueAt ?? null,
    updatedAt: now(),
  });
}
export async function saveFollowUp(f: FollowUp) {
  const followup = FollowUpSchema.parse(f);
  await db.transaction(
    "rw",
    db.followups,
    db.prospects,
    db.activities,
    async () => {
      await db.followups.put(followup);
      await syncFollowUp(f.prospectId);
      await db.activities.add(
        activity(
          f.prospectId,
          f.completedAt ? "FOLLOWUP_COMPLETED" : "FOLLOWUP_SAVED",
          f.completedAt
            ? `Opvolging afgerond: ${f.title}`
            : `Opvolging gepland: ${f.title}`,
        ),
      );
    },
  );
}
export async function deleteFollowUp(f: FollowUp) {
  await db.transaction(
    "rw",
    db.followups,
    db.prospects,
    db.activities,
    async () => {
      await db.followups.delete(f.id);
      await syncFollowUp(f.prospectId);
      await db.activities.add(
        activity(f.prospectId, "FOLLOWUP_DELETED", "Opvolging verwijderd"),
      );
    },
  );
}
export async function initiateCall(p: Prospect) {
  const call = CallSchema.parse({
    id: uid(),
    prospectId: p.id,
    initiatedAt: now(),
    outcome: null,
    summary: "",
    durationSeconds: null,
    confirmedAt: null,
  });
  await db.transaction("rw", db.calls, db.activities, db.settings, async () => {
    await db.calls.add(call);
    await db.activities.add(
      activity(
        p.id,
        "CALL_INITIATED",
        "Belactie gestart (uitkomst nog onbekend)",
      ),
    );
    await db.settings.put({ key: "selectedProspect", value: p.id });
  });
  return call;
}
export async function confirmCall(
  call: Call,
  outcome: NonNullable<Call["outcome"]>,
  summary: string,
  status?: Prospect["status"],
) {
  await db.transaction(
    "rw",
    db.calls,
    db.prospects,
    db.activities,
    db.notes,
    async () => {
      await db.calls.put(
        CallSchema.parse({ ...call, outcome, summary, confirmedAt: now() }),
      );
      const p = await db.prospects.get(call.prospectId);
      if (!p) throw new Error("Bedrijf niet gevonden");
      const contacted = [
        "SPOKEN",
        "INTERESTED",
        "CALLBACK",
        "NOT_INTERESTED",
      ].includes(outcome);
      await db.prospects.update(p.id, {
        status: status ?? p.status,
        lastContactedAt: contacted ? now() : p.lastContactedAt,
        updatedAt: now(),
      });
      await db.activities.add(
        activity(
          p.id,
          "CALL_CONFIRMED",
          `Gespreksuitkomst handmatig vastgelegd: ${outcome}`,
        ),
      );
      if (status && status !== p.status)
        await db.activities.add(
          activity(
            p.id,
            "STATUS_CHANGED",
            `Status gewijzigd van ${statuses[p.status]} naar ${statuses[status]}`,
          ),
        );
      if (summary.trim())
        await db.notes.add({
          id: uid(),
          prospectId: p.id,
          content: summary.trim(),
          createdAt: now(),
          updatedAt: now(),
        });
    },
  );
}
export async function saveDraft(d: Draft) {
  await db.drafts.put(DraftSchema.parse({ ...d, updatedAt: now() }));
}
export async function getProfile(): Promise<Profile> {
  const s = await db.settings.get("profile");
  return s ? ProfileSchema.parse(s.value) : defaultProfile;
}
export async function saveProfile(p: Profile) {
  await db.settings.put({ key: "profile", value: ProfileSchema.parse(p) });
}
export async function importProspects(
  incoming: Prospect[],
  mode: "skip" | "update" | "new" = "skip",
) {
  return db.transaction("rw", db.prospects, db.activities, async () => {
    const existing = await db.prospects.toArray();
    let added = 0,
      skipped = 0,
      updated = 0;
    for (const raw of incoming) {
      const p = ProspectSchema.parse(raw);
      const match = existing.find((e) => e.id === p.id || duplicate(e, p));
      if (match && mode !== "new") {
        if (mode === "update") {
          const patch: Partial<Prospect> = { updatedAt: now() };
          for (const key of [
            "companyName",
            "city",
            "phone",
            "phoneNormalized",
            "website",
            "sector",
            "valueProposition",
            "email",
            "contactPerson",
          ] as const)
            if (p[key]) patch[key] = p[key];
          await db.prospects.update(match.id, patch);
          Object.assign(match, patch);
          await db.activities.add(
            activity(
              match.id,
              "IMPORT_UPDATED",
              "Basisgegevens bijgewerkt via import; verkoopgegevens behouden",
            ),
          );
          updated++;
        } else skipped++;
        continue;
      }
      const record = mode === "new" ? { ...p, id: uid() } : p;
      await db.prospects.add(record);
      await db.activities.add(
        activity(record.id, "IMPORTED", "Prospect geïmporteerd"),
      );
      existing.push(record);
      added++;
    }
    return { added, skipped, updated };
  });
}
