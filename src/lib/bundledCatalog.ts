import { z } from "zod";
import { PublicCompanySchema } from "./companyDiscovery";
import { normalizePhone } from "./models";

export const catalogDisabledKey = "bundled-catalog-disabled";
export const catalogRoot = "/data/company-catalog/";
export const CatalogRecordSchema = PublicCompanySchema.extend({
  source: z.enum(["openstreetmap", "alltheplaces"]),
  sourceUrl: z.url().refine((value) => /^https:\/\//.test(value)),
  sourceFetchedAt: z.iso.datetime({ offset: true }),
  sourceLicense: z.string().min(1),
  sourceDatasetDate: z.iso.date().optional(),
  phone: z.string().refine((value) => Boolean(normalizePhone(value))),
});
export type CatalogRecord = z.infer<typeof CatalogRecordSchema>;
export const CatalogManifestSchema = z
  .object({
    version: z.string().regex(/^[a-z0-9-]{1,80}$/),
    generatedAt: z.iso.datetime({ offset: true }),
    count: z.number().int().min(0).max(200000),
    withEmail: z.number().int().nonnegative(),
    shards: z
      .array(
        z.object({
          file: z.string().regex(/^companies-\d{3}\.json$/),
          count: z.number().int().min(1).max(1000),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .max(200),
  })
  .refine(
    (manifest) =>
      manifest.shards.reduce((total, shard) => total + shard.count, 0) ===
        manifest.count &&
      manifest.withEmail <= manifest.count &&
      new Set(manifest.shards.map((shard) => shard.file)).size ===
        manifest.shards.length,
    "Ongeldige catalogusaantallen.",
  );
export type CatalogManifest = z.infer<typeof CatalogManifestSchema>;
export const catalogReceiptKey = (version: string, file: string) =>
  `bundled-catalog:${version}:${file}`;
export async function validateCatalogShard(
  text: string,
  shard: CatalogManifest["shards"][number],
) {
  const bytes = new TextEncoder().encode(text);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (part) => part.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== shard.sha256)
    throw new Error(
      "De bedrijvenlijst is onvolledig gedownload. Probeer het opnieuw.",
    );
  const records = z
    .array(CatalogRecordSchema)
    .max(1000)
    .parse(JSON.parse(text));
  if (
    records.length !== shard.count ||
    new Set(records.map((record) => record.id)).size !== records.length
  )
    throw new Error("De bedrijvenlijst bevat ongeldige aantallen.");
  return records;
}
