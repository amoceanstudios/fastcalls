import Papa from "papaparse";
import { z } from "zod";
import {
  ProspectSchema,
  NoteSchema,
  FollowUpSchema,
  ActivitySchema,
  CallSchema,
  DraftSchema,
  ProfileSchema,
  type Prospect,
  type Note,
  createProspect,
  normalizeText,
  duplicate,
  safeUrl,
  normalizePhone,
  now,
  defaultProfile,
  statuses,
  priorities,
} from "./models";
import { db, tables } from "../db/database";
export const fields = {
  originalNumber: "Nr",
  companyName: "Bedrijf",
  city: "Plaats",
  phone: "Telefoon",
  website: "Website",
  sector: "Sector / Type",
  valueProposition: "Wat Amocean kan betekenen",
  email: "E-mail",
  contactPerson: "Contactpersoon",
  status: "Status",
  priority: "Prioriteit",
} as const;
export type Field = keyof typeof fields;
export type Mapping = Record<Field, string>;
const aliases: Record<Field, string[]> = {
  originalNumber: ["nr", "nummer", "number", "originalnumber"],
  companyName: ["bedrijf", "bedrijfsnaam", "company", "companyname", "naam"],
  city: ["plaats", "stad", "city", "vestigingsplaats"],
  phone: ["telefoon", "telefoonnummer", "phone", "tel"],
  website: ["website", "url", "site"],
  sector: ["sector type", "sector", "type", "branche", "industry"],
  valueProposition: [
    "wat amocean kan betekenen",
    "wat amocean kan betekenen voor het bedrijf",
    "valueproposition",
    "kansen",
    "aanbod",
  ],
  email: ["e mail", "email", "emailadres"],
  contactPerson: ["contactpersoon", "contactperson", "contact"],
  status: ["status"],
  priority: ["prioriteit", "priority"],
};
export function autoMapping(headers: string[]): Mapping {
  return Object.fromEntries(
    Object.entries(aliases).map(([key, names]) => [
      key,
      headers.find((h) => names.includes(normalizeText(h))) ?? "",
    ]),
  ) as Mapping;
}
export type RawFile = {
  headers: string[];
  rows: Record<string, unknown>[];
  issues?: { row: number; message: string }[];
};
export async function readImport(file: File): Promise<RawFile> {
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Bestand is te groot. Gebruik maximaal 15 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "xls")
    throw new Error(
      "Het oude XLS-formaat wordt niet veilig ondersteund. Sla het bestand in Excel op als XLSX of CSV.",
    );
  if (ext === "xlsx") {
    const { default: readXlsxFile } = await import("read-excel-file");
    const rows = await readXlsxFile(file);
    if (!rows.length) throw new Error("Het werkblad is leeg.");
    const headers = rows[0].map((v) => String(v ?? "").trim());
    if (new Set(headers).size !== headers.length || headers.some((h) => !h))
      throw new Error("Gebruik unieke, niet-lege kolomnamen op de eerste rij.");
    return {
      headers,
      rows: rows
        .slice(1)
        .filter((row) => row.some((v) => v !== null && v !== ""))
        .map((row) =>
          Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
        ),
    };
  }
  const text = await file.text();
  if (ext === "csv") {
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    if (result.errors.some((error) => error.type !== "FieldMismatch"))
      throw new Error(
        `CSV-fout: ${result.errors[0].message} (rij ${(result.errors[0].row ?? 0) + 2})`,
      );
    const headers = result.meta.fields ?? [];
    if (!headers.length) throw new Error("Geen kolommen gevonden.");
    return {
      headers,
      rows: result.data,
      issues: result.errors.map((error) => ({
        row: (error.row ?? 0) + 2,
        message: `CSV-rij heeft een onjuist aantal kolommen: ${error.message}`,
      })),
    };
  }
  if (ext === "json") {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : null;
    if (!rows)
      throw new Error(
        "Gebruik een JSON-lijst met prospects, of kies Back-up herstellen.",
      );
    if (rows.some((r) => !r || typeof r !== "object" || Array.isArray(r)))
      throw new Error("Elke JSON-rij moet een object zijn.");
    return {
      headers: Array.from(new Set(rows.flatMap((r) => Object.keys(r)))),
      rows,
    };
  }
  throw new Error("Kies een XLSX-, CSV- of JSON-bestand.");
}
export function previewImport(
  raw: RawFile,
  mapping: Mapping,
  existing: Prospect[],
) {
  const duplicateRecords: Prospect[] = [],
    valid: Prospect[] = [],
    errors: { row: number; message: string }[] = [],
    duplicates: number[] = [],
    warnings: { row: number; message: string }[] = [];
  raw.rows.forEach((row, i) => {
    const read = (key: Field) => String(row[mapping[key]] ?? "").trim();
    try {
      const issue = raw.issues?.find((issue) => issue.row === i + 2);
      if (issue) throw new Error(issue.message);
      if (!read("companyName")) throw new Error("Bedrijfsnaam ontbreekt.");
      const phone = read("phone"),
        website = read("website");
      if (phone && !normalizePhone(phone))
        warnings.push({
          row: i + 2,
          message:
            "Telefoonnummer vraagt handmatige controle; bellen is uitgeschakeld.",
        });
      if (website && !safeUrl(website))
        warnings.push({
          row: i + 2,
          message: "Ongeldige website niet overgenomen.",
        });
      const p = createProspect({
        companyName: read("companyName"),
        originalNumber:
          read("originalNumber") &&
          Number.isFinite(Number(read("originalNumber")))
            ? Number(read("originalNumber"))
            : null,
        city: read("city"),
        phone,
        website,
        sector: read("sector"),
        valueProposition: read("valueProposition"),
        email: read("email"),
        contactPerson: read("contactPerson"),
        status: (Object.entries(statuses).find(([k, v]) =>
          [k.toLowerCase(), v.toLowerCase()].includes(
            read("status").toLowerCase(),
          ),
        )?.[0] ??
          (read("status") || "TO_CALL")) as Prospect["status"],
        priority: (Object.entries(priorities).find(([k, v]) =>
          [k.toLowerCase(), v.toLowerCase()].includes(
            read("priority").toLowerCase(),
          ),
        )?.[0] ??
          (read("priority") || "MEDIUM")) as Prospect["priority"],
        source: "file-import",
      });
      if ([...existing, ...valid].some((e) => duplicate(e, p))) {
        duplicates.push(i + 2);
        duplicateRecords.push(p);
        return;
      }
      valid.push(p);
    } catch (e) {
      errors.push({
        row: i + 2,
        message: e instanceof Error ? e.message : "Ongeldige gegevens",
      });
    }
  });
  return { valid, errors, duplicates, duplicateRecords, warnings };
}
export const BackupSchema = z.object({
  format: z.literal("amocean-prospect-os"),
  version: z.literal(2),
  exportedAt: z.iso.datetime({ offset: true }),
  prospects: z.array(ProspectSchema).max(100000),
  notes: z.array(NoteSchema),
  followups: z.array(FollowUpSchema),
  activities: z.array(ActivitySchema),
  calls: z.array(CallSchema),
  drafts: z.array(DraftSchema),
  profile: ProfileSchema,
  appVersion: z.string().default("1.0.0"),
  settings: z
    .array(z.object({ key: z.string().max(300), value: z.json() }))
    .default([]),
});
export type Backup = z.infer<typeof BackupSchema>;
export function validateBackup(input: unknown): Backup {
  const b = BackupSchema.parse(input);
  const ids = new Set(b.prospects.map((p) => p.id));
  for (const records of [
    b.prospects,
    b.notes,
    b.followups,
    b.activities,
    b.calls,
    b.drafts,
  ])
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error("Back-up bevat dubbele identifiers.");
  for (const rows of [b.notes, b.followups, b.activities, b.calls, b.drafts])
    if (rows.some((r) => !ids.has(r.prospectId)))
      throw new Error("Back-up bevat verwijzingen naar ontbrekende bedrijven.");
  return b;
}
export async function makeBackup(): Promise<Backup> {
  return db.transaction("r", tables, async () => {
    const s = await db.settings.get("profile");
    return validateBackup({
      format: "amocean-prospect-os",
      version: 2,
      exportedAt: now(),
      prospects: await db.prospects.toArray(),
      notes: await db.notes.toArray(),
      followups: await db.followups.toArray(),
      activities: await db.activities.toArray(),
      calls: await db.calls.toArray(),
      drafts: await db.drafts.toArray(),
      profile: s?.value ?? defaultProfile,
      statuses,
      priorities,
      appVersion: "1.0.0",
      settings: await db.settings.toArray(),
    });
  });
}
export async function restoreBackup(
  input: unknown,
  mode: "merge" | "replace" = "merge",
) {
  const b = validateBackup(input);
  return db.transaction("rw", tables, async () => {
    if (mode === "replace") {
      for (const table of tables) await table.clear();
    }
    const existing = await db.prospects.toArray();
    const idMap = new Map<string, string>();
    let added = 0;
    for (const p of b.prospects) {
      const match = existing.find((e) => e.id === p.id || duplicate(e, p));
      if (match) idMap.set(p.id, match.id);
      else {
        await db.prospects.add(p);
        existing.push(p);
        idMap.set(p.id, p.id);
        added++;
      }
    }
    for (const [table, rows] of [
      [db.notes, b.notes],
      [db.followups, b.followups],
      [db.activities, b.activities],
      [db.calls, b.calls],
      [db.drafts, b.drafts],
    ] as const) {
      for (const row of rows) {
        const prospectId = idMap.get(row.prospectId)!;
        if (!(await table.get(row.id)))
          await (table as typeof db.notes).add({ ...row, prospectId } as never);
      }
    }
    for (const setting of b.settings)
      if (setting.key !== "profile" && !(await db.settings.get(setting.key)))
        await db.settings.put(setting);
    if (mode === "replace" || !(await db.settings.get("profile")))
      await db.settings.put({ key: "profile", value: b.profile });
    for (const p of await db.prospects.toArray()) {
      const next = (
        await db.followups.where("prospectId").equals(p.id).toArray()
      )
        .filter((f) => !f.completedAt)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
      await db.prospects.update(p.id, { followUpAt: next?.dueAt ?? null });
    }
    return added;
  });
}
export function download(
  content: BlobPart,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadBackup() {
  const b = await makeBackup();
  download(
    JSON.stringify(b, null, 2),
    `amocean-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
  return b;
}
export const safeCell = (value: unknown) => {
  const text = String(value ?? "");
  return /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
};
export function exportRows(prospects: Prospect[], notes: Note[] = []) {
  return prospects.map((p) =>
    Object.fromEntries([
      ...Object.entries(fields).map(([key, label]) => [
        label,
        safeCell(p[key as Field]),
      ]),
      ["Status", p.status],
      ["Prioriteit", p.priority],
      ["Tags", safeCell(p.tags.join(", "))],
      ["Opvolging", p.followUpAt ?? ""],
      ["Laatste contact", p.lastContactedAt ?? ""],
      [
        "Laatste notitie",
        safeCell(
          [...notes]
            .filter((n) => n.prospectId === p.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
            ?.content ?? "",
        ),
      ],
    ]),
  );
}
export function toCSV(prospects: Prospect[], notes: Note[] = []) {
  return (
    "\ufeff" +
    Papa.unparse(exportRows(prospects, notes), {
      delimiter: ";",
      newline: "\r\n",
      quotes: true,
    })
  );
}
export async function exportExcel(prospects: Prospect[]) {
  const { default: writeXlsxFile } = await import("write-excel-file");
  const backup = await makeBackup();
  const selected = new Set(prospects.map((p) => p.id));
  const datasets: Record<string, unknown>[][] = [
    exportRows(prospects, backup.notes),
    backup.notes.filter((n) => selected.has(n.prospectId)),
    backup.followups.filter((n) => selected.has(n.prospectId)),
    backup.activities.filter((n) => selected.has(n.prospectId)),
    backup.calls.filter((n) => selected.has(n.prospectId)),
    backup.drafts.filter((n) => selected.has(n.prospectId)),
  ];
  const sheets = datasets.map((rows) => {
    const headers = rows.length ? Object.keys(rows[0]) : ["Geen gegevens"];
    return [
      headers.map((value) => ({
        type: String,
        value,
        fontWeight: "bold" as const,
      })),
      ...rows.map((r) =>
        headers.map((k) => ({ type: String, value: safeCell(r[k]) })),
      ),
    ];
  });
  await writeXlsxFile(sheets, {
    sheets: [
      "Prospects",
      "Notities",
      "Opvolgingen",
      "Activiteiten",
      "Belacties",
      "E-mailconcepten",
    ],
    fileName: "amocean-prospects.xlsx",
  });
}
