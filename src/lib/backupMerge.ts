import { companyIdentityKeys } from "./companyDiscovery";
import type { Prospect } from "./models";

export function pristineCatalogCompany(p: Prospect, touched: Set<string>) {
  return (
    !touched.has(p.id) &&
    ["openstreetmap", "alltheplaces"].includes(p.source) &&
    p.status === "TO_CALL" &&
    p.priority === "MEDIUM" &&
    !p.tags.length &&
    !p.lastContactedAt &&
    !p.followUpAt &&
    !p.contactPerson &&
    !p.valueProposition
  );
}
export function planCompanyRestore(
  existing: Prospect[],
  incoming: Prospect[],
  localTouched: Set<string>,
  incomingTouched: Set<string>,
) {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const incomingIds = new Set(incoming.map((p) => p.id));
  const byContact = new Map<string, Prospect | null>();
  for (const p of existing)
    for (const key of companyIdentityKeys(p).filter(
      (key) => !key.startsWith("id:"),
    ))
      byContact.set(key, byContact.has(key) ? null : p);
  const claimed = new Set<string>();
  const idMap = new Map<string, string>();
  const additions: Prospect[] = [];
  const restored: Prospect[] = [];
  for (const p of incoming) {
    // Exact identifiers always win. A common chain website is never an identity.
    let match = byId.get(p.id);
    if (!match) {
      const candidates = new Map<string, Prospect>();
      for (const key of companyIdentityKeys(p).filter(
        (key) => !key.startsWith("id:"),
      )) {
        const candidate = byContact.get(key);
        if (
          candidate &&
          !incomingIds.has(candidate.id) &&
          !claimed.has(candidate.id)
        )
          candidates.set(candidate.id, candidate);
      }
      if (candidates.size === 1) match = candidates.values().next().value;
    }
    if (!match) {
      additions.push(p);
      idMap.set(p.id, p.id);
      continue;
    }
    claimed.add(match.id);
    idMap.set(p.id, match.id);
    // Only an untouched public-catalogue row can receive saved personal state.
    // Existing local work always takes precedence over an older backup.
    if (
      incomingTouched.has(p.id) &&
      pristineCatalogCompany(match, localTouched)
    )
      restored.push({ ...p, id: match.id });
  }
  return { idMap, additions, restored };
}
