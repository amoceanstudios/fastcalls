import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
export function usePersonalWork() {
  return useLiveQuery(async () => {
    // IndexedDB getAll avoids a cursor round-trip for each imported activity.
    const [prospects, notes, followups, calls, drafts, activities, settings] =
      await Promise.all([
        db.prospects.toArray(),
        db.notes.toArray(),
        db.followups.toArray(),
        db.calls.toArray(),
        db.drafts.toArray(),
        db.activities.toArray(),
        db.settings.toArray(),
      ]);
    return {
      prospects,
      notes,
      followups,
      calls,
      drafts,
      activities: activities.filter(
        (item) => item.type !== "IMPORTED" && item.type !== "IMPORT_UPDATED",
      ),
      settings: settings.filter(
        (item) =>
          item.key.startsWith("note-draft-") ||
          item.key.startsWith("call-summary-"),
      ),
    };
  });
}
