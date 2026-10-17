import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("Party deletion reports ownership blockers before attempting persistence", () => {
  const deletePartyStart = appSource.indexOf("async function deleteParty(partyId)");
  const deletePartyEnd = appSource.indexOf("\n  const openDocumentModal", deletePartyStart);
  const deletePartySource = appSource.slice(deletePartyStart, deletePartyEnd);

  assert.ok(deletePartyStart >= 0, "Party deletion handler should exist");
  assert.match(deletePartySource, /error\?\.code === "PARTY_OWNERSHIP_DEPENDENCY"/);
  assert.match(deletePartySource, /Cannot delete this Party while it is an owner of/);
  assert.ok(
    deletePartySource.indexOf("const updatedCase = deletePartyFromCase(targetCase, partyId);")
      < deletePartySource.indexOf("await saveCase(updatedCase, {"),
    "the domain deletion guard must run before persistence",
  );
});
