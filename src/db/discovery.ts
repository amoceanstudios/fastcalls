import { db } from "./database";
import { companyIdentityKeys } from "../lib/companyDiscovery";
import { ProspectSchema, now, uid, type Prospect } from "../lib/models";

export async function saveDiscoveredCompanies(incoming: Prospect[]) {
  // Validation happens before the transaction. bulkAdd keeps large province
  // imports linear and atomic; existing workflow/contact data is never updated.
  const records = incoming.map((record) => ProspectSchema.parse(record));
  return db.transaction("rw", db.prospects, db.activities, async () => {
    const keys = new Set(
      (await db.prospects.toArray()).flatMap(companyIdentityKeys),
    );
    const additions: Prospect[] = [];
    for (const record of records) {
      const identities = companyIdentityKeys(record);
      if (identities.some((key) => keys.has(key))) continue;
      additions.push(record);
      identities.forEach((key) => keys.add(key));
    }
    if (additions.length) {
      await db.prospects.bulkAdd(additions);
      await db.activities.bulkAdd(
        additions.map((p) => ({
          id: uid(),
          prospectId: p.id,
          type: "IMPORTED",
          createdAt: now(),
          description: `Openbare bedrijfsvermelding uit ${p.source === "alltheplaces" ? "All the Places" : "OpenStreetMap"} opgeslagen; contactgegevens niet handmatig gecontroleerd`,
        })),
      );
    }
    return {
      added: additions.length,
      skipped: records.length - additions.length,
    };
  });
}
