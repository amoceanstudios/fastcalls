import { db } from "./database";
import { saveDiscoveredCompanies } from "./discovery";
import { createProspect } from "../lib/models";
import {
  CatalogRecordSchema,
  catalogDisabledKey,
  catalogReceiptKey,
  type CatalogRecord,
} from "../lib/bundledCatalog";

export async function applyCatalogShard(
  version: string,
  file: string,
  input: CatalogRecord[],
) {
  const records = input.map((record) =>
    createProspect(CatalogRecordSchema.parse(record)),
  );
  // The receipt and the records commit together. Two tabs cannot import the
  // same shard twice, and a cancelled/failed transaction leaves no false receipt.
  return db.transaction(
    "rw",
    db.prospects,
    db.activities,
    db.settings,
    async () => {
      const key = catalogReceiptKey(version, file);
      if ((await db.settings.get(catalogDisabledKey))?.value === true)
        return { added: 0, skipped: 0, disabled: true };
      if (await db.settings.get(key))
        return { added: 0, skipped: records.length, disabled: false };
      const saved = await saveDiscoveredCompanies(records);
      await db.settings.put({
        key,
        value: { importedAt: new Date().toISOString(), count: records.length },
      });
      return { ...saved, disabled: false };
    },
  );
}
