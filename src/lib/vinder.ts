import { db } from "../db/database";
import {
  now,
  uid,
  statuses,
  type Prospect,
  type Call,
  NoteSchema,
} from "./models";

type Decision = "INTERESTED" | "NOT_INTERESTED";
type Receipt = {
  prospectId: string;
  companyName: string;
  before: Prospect["status"];
  after: Decision;
  appliedAt: string;
  call?: Call;
  lastContactedAt?: string | null;
};
export const vinderUndoKey = "vinder-last-decision";
// Change only the classification, atomically with its history and undo receipt.
export async function decideVinder(
  id: string,
  expected: Prospect["status"],
  after: Decision,
  note: string,
) {
  await db.transaction(
    "rw",
    db.prospects,
    db.activities,
    db.notes,
    db.settings,
    db.calls,
    async () => {
      const p = await db.prospects.get(id);
      if (!p || p.status !== expected)
        throw new Error(
          "De status is inmiddels gewijzigd. Bekijk het bedrijf opnieuw.",
        );
      const appliedAt = now();
      const call = (await db.calls.where("prospectId").equals(id).toArray())
        .filter((c) => c.outcome === null && !c.confirmedAt)
        .sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt))[0];
      if (call) {
        await db.calls.update(call.id, {
          outcome: after,
          confirmedAt: appliedAt,
        });
        await db.activities.add({
          id: uid(),
          prospectId: id,
          type: "CALL_CONFIRMED",
          description: `Beluitkomst via Vinder: ${statuses[after]}`,
          createdAt: appliedAt,
        });
      }
      await db.prospects.update(id, {
        status: after,
        updatedAt: appliedAt,
        ...(call ? { lastContactedAt: appliedAt } : {}),
      });
      await db.activities.add({
        id: uid(),
        prospectId: id,
        type: "STATUS_CHANGED",
        description: `Vinder: ${statuses[p.status]} → ${statuses[after]}`,
        createdAt: appliedAt,
      });
      const draft = (await db.settings.get(`note-draft-${id}`))?.value;
      const content =
        note.trim() || (typeof draft === "string" ? draft.trim() : "");
      if (content) {
        await db.notes.add(
          NoteSchema.parse({
            id: uid(),
            prospectId: id,
            content,
            createdAt: appliedAt,
            updatedAt: appliedAt,
          }),
        );
        await db.activities.add({
          id: uid(),
          prospectId: id,
          type: "NOTE_SAVED",
          description: "Notitie opgeslagen via Vinder",
          createdAt: appliedAt,
        });
      }
      await db.settings.put({
        key: vinderUndoKey,
        value: {
          prospectId: id,
          companyName: p.companyName,
          before: p.status,
          after,
          appliedAt,
          ...(call ? { call, lastContactedAt: p.lastContactedAt } : {}),
        } satisfies Receipt,
      });
      await db.settings.delete(`note-draft-${id}`);
    },
  );
}
export async function undoVinder() {
  return db.transaction(
    "rw",
    db.prospects,
    db.activities,
    db.settings,
    db.calls,
    async () => {
      const receipt = (await db.settings.get(vinderUndoKey))?.value as
        Receipt | undefined;
      if (!receipt) throw new Error("Geen swipe om terug te draaien.");
      const p = await db.prospects.get(receipt.prospectId);
      if (!p || p.status !== receipt.after || p.updatedAt !== receipt.appliedAt)
        throw new Error(
          "Dit bedrijf is na de swipe gewijzigd. Pas de status aan via het bedrijfsprofiel.",
        );
      if (receipt.call) {
        const call = await db.calls.get(receipt.call.id);
        const expected = {
          ...receipt.call,
          outcome: receipt.after,
          confirmedAt: receipt.appliedAt,
        };
        if (JSON.stringify(call) !== JSON.stringify(expected))
          throw new Error(
            "De belactie is na de swipe gewijzigd. Pas de status aan via het bedrijfsprofiel.",
          );
        await db.calls.put(receipt.call);
      }
      await db.prospects.update(p.id, {
        status: receipt.before,
        ...(receipt.call
          ? { lastContactedAt: receipt.lastContactedAt ?? null }
          : {}),
        updatedAt: now(),
      });
      await db.activities.add({
        id: uid(),
        prospectId: p.id,
        type: "STATUS_CHANGED",
        description: `Vinder-swipe hersteld: ${statuses[receipt.before]}. Notities blijven bewaard.`,
        createdAt: now(),
      });
      await db.settings.delete(vinderUndoKey);
      return p.id;
    },
  );
}
