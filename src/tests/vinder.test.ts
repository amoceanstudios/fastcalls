import { beforeEach, afterEach, it, expect } from "vitest";
import { db, tables, saveNote } from "../db/database";
import { createProspect, now } from "../lib/models";
import { decideVinder, undoVinder, vinderUndoKey } from "../lib/vinder";
beforeEach(async () => {
  await db.open();
  for (const t of tables) await t.clear();
});
afterEach(async () => {
  for (const t of tables) await t.clear();
  db.close();
});
it("bewaart interesse, notitie en historie atomair zonder bestaande notities of opvolging te wijzigen", async () => {
  const p = createProspect({
    companyName: "Fictief Vinder",
    followUpAt: now(),
    contactPerson: "Testcontact",
  });
  await db.prospects.add(p);
  await saveNote(p.id, "Bestaande notitie");
  await decideVinder(p.id, p.status, "INTERESTED", "Goed gesprek");
  expect(await db.prospects.get(p.id)).toEqual({
    ...p,
    status: "INTERESTED",
    updatedAt: expect.any(String),
  });
  expect((await db.notes.toArray()).map((n) => n.content).sort()).toEqual([
    "Bestaande notitie",
    "Goed gesprek",
  ]);
  expect(await db.calls.count()).toBe(0);
  expect(await db.followups.count()).toBe(0);
  expect(await db.settings.get(vinderUndoKey)).toBeDefined();
  await undoVinder();
  expect((await db.prospects.get(p.id))?.status).toBe(p.status);
  expect(await db.notes.count()).toBe(2);
});
it("rechts betekent geen interesse en blijft na opnieuw openen opgeslagen; undo ook", async () => {
  const p = createProspect({ companyName: "Fictief Rechts" });
  await db.prospects.add(p);
  await decideVinder(p.id, p.status, "NOT_INTERESTED", "");
  db.close();
  await db.open();
  expect((await db.prospects.get(p.id))?.status).toBe("NOT_INTERESTED");
  await undoVinder();
  expect((await db.prospects.get(p.id))?.status).toBe(p.status);
});
it("weigert dubbele of verouderde keuzes en draait latere wijzigingen niet terug", async () => {
  const p = createProspect({ companyName: "Fictief Conflict" });
  await db.prospects.add(p);
  await decideVinder(p.id, p.status, "INTERESTED", "");
  await expect(
    decideVinder(p.id, p.status, "NOT_INTERESTED", "verlies"),
  ).rejects.toThrow("inmiddels gewijzigd");
  await db.prospects.update(p.id, { status: "CUSTOMER" });
  await expect(undoVinder()).rejects.toThrow("na de swipe gewijzigd");
  expect((await db.prospects.get(p.id))?.status).toBe("CUSTOMER");
  expect(await db.notes.count()).toBe(0);
});
it("bevestigt alleen de laatste open belactie en herstelt die bij undo", async () => {
  const { initiateCall } = await import("../db/database");
  const p = createProspect({ companyName: "Fictief Gesprek" });
  await db.prospects.add(p);
  const call = await initiateCall(p);
  await decideVinder(p.id, p.status, "INTERESTED", "Demo besproken");
  expect((await db.calls.get(call.id))?.outcome).toBe("INTERESTED");
  expect((await db.calls.get(call.id))?.confirmedAt).toBeTruthy();
  await undoVinder();
  expect(await db.calls.get(call.id)).toEqual(call);
  expect((await db.prospects.get(p.id))?.lastContactedAt).toBeNull();
  expect(await db.notes.count()).toBe(1);
});
it("een ongeldige notitie draait de hele swipe terug", async () => {
  const p = createProspect({ companyName: "Fictief Rollback" });
  await db.prospects.add(p);
  await expect(
    decideVinder(p.id, p.status, "INTERESTED", "a".repeat(50001)),
  ).rejects.toThrow();
  expect((await db.prospects.get(p.id))?.status).toBe(p.status);
  expect(await db.activities.count()).toBe(0);
  expect(await db.settings.get(vinderUndoKey)).toBeUndefined();
});
it("bewaart een aanwezig notitieconcept ook als de kaart nog aan het laden was", async () => {
  const p = createProspect({ companyName: "Fictief Concept" });
  await db.prospects.add(p);
  await db.settings.put({
    key: `note-draft-${p.id}`,
    value: "Bewaard voor het herladen",
  });
  await decideVinder(p.id, p.status, "INTERESTED", "");
  expect((await db.notes.toArray())[0].content).toBe(
    "Bewaard voor het herladen",
  );
});
