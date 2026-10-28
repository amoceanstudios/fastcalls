// Read-only recovery. Native IndexedDB opens only databases already enumerated
// by this browser; a raced deletion aborts the upgrade instead of creating one.
export type RawDatabaseSnapshot = {
  name: string;
  version: number;
  stores: Record<string, unknown[]>;
};
export type StorageRecoveryReport = {
  format: "amocean-readonly-recovery";
  version: 1;
  origin: string;
  capturedAt: string;
  databases: RawDatabaseSnapshot[];
  localDrafts: Record<string, string>;
  errors: string[];
  enumerationSupported: boolean;
};
export type RecoveredItem = {
  id: string;
  database: string;
  store: string;
  kind: "notes" | "followups" | "calls" | "drafts";
  companyName: string;
  reference: string;
  title: string;
  content: string;
  when: string;
  raw: unknown;
};
const appDatabase = (name: string) => /amocean|prospect|fastcalls/i.test(name);
export async function readExistingDatabase(
  name: string,
): Promise<RawDatabaseSnapshot> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => {
      request.transaction?.abort();
    };
    request.onerror = () =>
      reject(new Error(`Databestand ${name} kon niet worden gelezen.`));
    request.onblocked = () =>
      reject(
        new Error(
          `Databestand ${name} is tijdelijk geblokkeerd. Sluit andere tabbladen van dezelfde app en probeer opnieuw.`,
        ),
      );
    request.onsuccess = () => {
      const database = request.result;
      const names = Array.from(database.objectStoreNames);
      const snapshot: RawDatabaseSnapshot = {
        name: database.name,
        version: database.version,
        stores: {},
      };
      if (!names.length) {
        database.close();
        resolve(snapshot);
        return;
      }
      const tx = database.transaction(names, "readonly");
      names.forEach((store) => {
        const read = tx.objectStore(store).getAll();
        read.onsuccess = () => {
          snapshot.stores[store] = read.result;
        };
      });
      tx.oncomplete = () => {
        database.close();
        resolve(snapshot);
      };
      tx.onerror = () => {
        database.close();
        reject(
          new Error(`Lezen van ${name} is mislukt; er is niets gewijzigd.`),
        );
      };
      tx.onabort = () => {
        database.close();
        reject(
          new Error(
            `Lezen van ${name} werd afgebroken; er is niets gewijzigd.`,
          ),
        );
      };
    };
  });
}
export async function inspectBrowserStorage(): Promise<StorageRecoveryReport> {
  const report: StorageRecoveryReport = {
    format: "amocean-readonly-recovery",
    version: 1,
    origin: location.origin,
    capturedAt: new Date().toISOString(),
    databases: [],
    localDrafts: {},
    errors: [],
    enumerationSupported: typeof indexedDB.databases === "function",
  };
  if (report.enumerationSupported) {
    const available = await indexedDB.databases();
    for (const database of available) {
      if (!database.name || !appDatabase(database.name)) continue;
      try {
        report.databases.push(await readExistingDatabase(database.name));
      } catch (error) {
        report.errors.push(
          error instanceof Error
            ? error.message
            : "Een databestand kon niet worden gelezen.",
        );
      }
    }
  } else
    report.errors.push(
      "Deze browser kan aanwezige databestanden niet opsommen. Dit betekent niet dat uw gegevens weg zijn. Gebruik een volledige back-up of controleer dezelfde app in de oorspronkelijke browser.",
    );
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("note-draft-") || key.startsWith("call-summary-"))
      ) {
        const value = localStorage.getItem(key);
        if (value !== null) report.localDrafts[key] = value;
      }
    }
  } catch {
    report.errors.push("Bewaarde lokale invoer kon niet worden gelezen.");
  }
  return report;
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const field = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys)
    if (typeof row[key] === "string" || typeof row[key] === "number")
      return String(row[key]);
  return "";
};
export function recoveryItems(report: StorageRecoveryReport): RecoveredItem[] {
  const result: RecoveredItem[] = [];
  for (const database of report.databases) {
    const companies = new Map<string, string>();
    for (const [store, rows] of Object.entries(database.stores))
      if (/^(prospects|companies|bedrijven)$/i.test(store))
        for (const raw of rows) {
          const p = object(raw);
          const id = field(p, ["id"]);
          if (id)
            companies.set(
              id,
              field(p, ["companyName", "name", "naam"]) ||
                "Bedrijf zonder naam",
            );
        }
    for (const [store, rows] of Object.entries(database.stores)) {
      const kind = /^(notes|notities)$/i.test(store)
        ? "notes"
        : /^(followups|follow.?ups|callbacks|opvolgingen)$/i.test(store)
          ? "followups"
          : /^(calls|calllogs|gesprekken)$/i.test(store)
            ? "calls"
            : /^(drafts|emaildrafts)$/i.test(store)
              ? "drafts"
              : null;
      if (kind)
        rows.forEach((raw, index) => {
          const row = object(raw);
          const reference = field(row, [
            "prospectId",
            "companyId",
            "bedrijfId",
          ]);
          result.push({
            id: `${database.name}:${store}:${field(row, ["id"]) || index}`,
            database: database.name,
            store,
            kind,
            companyName: companies.get(reference) || "Bedrijf niet gekoppeld",
            reference,
            title:
              field(row, ["title", "subject", "outcome"]) ||
              (kind === "notes"
                ? "Opgeslagen notitie"
                : kind === "followups"
                  ? "Opgeslagen afspraak"
                  : kind === "calls"
                    ? "Opgeslagen belactie"
                    : "Opgeslagen concept"),
            content:
              field(row, [
                "content",
                "description",
                "summary",
                "body",
                "text",
                "note",
              ]) || JSON.stringify(raw, null, 2),
            when: field(row, [
              "dueAt",
              "updatedAt",
              "createdAt",
              "initiatedAt",
            ]),
            raw,
          });
        });
      if (/^settings$/i.test(store))
        for (const raw of rows) {
          const row = object(raw);
          const key = field(row, ["key"]);
          if (
            typeof row.value !== "string" ||
            !row.value.trim() ||
            !/^(note-draft-|call-summary-)/.test(key)
          )
            continue;
          const reference = key.replace(/^(note-draft-|call-summary-)/, "");
          result.push({
            id: `${database.name}:settings:${key}`,
            database: database.name,
            store,
            kind: key.startsWith("note-draft-") ? "notes" : "calls",
            companyName: companies.get(reference) || "Bedrijf niet gekoppeld",
            reference,
            title: "Bewaarde invoer",
            content: row.value,
            when: "",
            raw,
          });
        }
    }
  }
  for (const [key, content] of Object.entries(report.localDrafts))
    if (content.trim())
      result.push({
        id: `local:${key}`,
        database: "localStorage",
        store: "lokale invoer",
        kind: key.startsWith("note-draft-") ? "notes" : "calls",
        companyName: "Bedrijf niet gekoppeld",
        reference: key.replace(/^(note-draft-|call-summary-)/, ""),
        title: "Eerder bewaarde invoer",
        content,
        when: "",
        raw: { key, content },
      });
  return result;
}
