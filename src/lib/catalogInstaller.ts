import { db } from "../db/database";
import { applyCatalogShard } from "../db/bundledCatalog";
import {
  CatalogManifestSchema,
  catalogDisabledKey,
  catalogReceiptKey,
  catalogRoot,
  validateCatalogShard,
} from "./bundledCatalog";

type CatalogState = {
  phase: "idle" | "loading" | "done" | "error";
  processed: number;
  total: number;
  added: number;
};
let state: CatalogState = { phase: "idle", processed: 0, total: 0, added: 0 };
const listeners = new Set<() => void>();
let job: Promise<void> | undefined;
export const subscribeCatalog = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getCatalogState = () => state;
function publish(patch: Partial<CatalogState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
export function installBundledCatalog(): Promise<void> {
  if (job) return job;
  if (state.phase === "done") return Promise.resolve();
  job = (async () => {
    try {
      if (!navigator.onLine) return;
      if ((await db.settings.get(catalogDisabledKey))?.value === true) {
        publish({ phase: "done" });
        return;
      }
      const response = await fetch(`${catalogRoot}manifest.json`, {
        cache: "no-cache",
        signal: AbortSignal.timeout(20000),
      });
      if (response.status === 404) {
        publish({ phase: "done" });
        return;
      }
      if (!response.ok) throw new Error("Bedrijvenlijst niet bereikbaar.");
      const manifest = CatalogManifestSchema.parse(await response.json());
      if (manifest.count === 0) {
        publish({ phase: "done" });
        return;
      }
      let processed = 0;
      let added = state.added;
      // Completed shards are checked before fetching, so a reload/offline visit
      // does not redownload the catalogue or recreate removed records.
      for (const shard of manifest.shards) {
        if ((await db.settings.get(catalogDisabledKey))?.value === true) break;
        if (
          !(await db.settings.get(
            catalogReceiptKey(manifest.version, shard.file),
          ))
        ) {
          publish({
            phase: "loading",
            processed,
            total: manifest.count,
            added,
          });
          const result = await fetch(`${catalogRoot}${shard.file}`, {
            signal: AbortSignal.timeout(30000),
          });
          if (!result.ok)
            throw new Error(
              "Een deel van de bedrijvenlijst is niet bereikbaar.",
            );
          const records = await validateCatalogShard(
            await result.text(),
            shard,
          );
          const saved = await applyCatalogShard(
            manifest.version,
            shard.file,
            records,
          );
          if (saved.disabled) break;
          added += saved.added;
        }
        processed += shard.count;
        publish({ processed, total: manifest.count, added });
      }
      publish({ phase: "done", processed, added });
    } catch {
      publish({ phase: "error" });
    } finally {
      job = undefined;
    }
  })();
  return job;
}
