import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./PartiesTab.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

test("Parties workspace has an isolated dark-theme scope and accessible filters", () => {
  assert.match(source, /className="case-file-parties space-y-5"/);
  assert.match(source, /aria-label="Party filters"/);
  assert.match(source, /id="party-search" type="search"/);
  assert.match(source, /filtersActive && <button[^>]*case-file-parties-clear[^>]*>Clear filters<\/button>/);
  assert.match(source, /aria-live="polite"/);
  assert.match(styles, /\.proveit-dark-shell \.case-file-parties \{/);
  assert.match(styles, /\.proveit-dark-shell \.case-file-party-card/);
});

test("Party cards preserve independent edit and delete actions with keyboard disclosures", () => {
  assert.match(source, /expandedPartyIds/);
  assert.match(source, /togglePartyExpanded/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /aria-controls=\{detailId\}/);
  assert.match(source, /Show party details/);
  assert.match(source, /label: "Edit", onClick: \(\) => openEditModal\(party\), "aria-label": `Edit party \$\{title\}`/);
  assert.match(source, /label: "Delete", variant: "danger", onClick: \(\) => deleteParty\(party\), "aria-label": `Delete party \$\{title\}`/);
});

test("Expanded Party details retain the existing identity, organisation, contact, address, tags, and notes fields", () => {
  for (const heading of ["Identity", "Organisation", "Relationship to case", "Contact", "Address", "Tags", "Notes"]) {
    assert.match(source, new RegExp(`>${heading}<`));
  }
  assert.match(source, /getAddressLines\(party\.address\)/);
  assert.match(source, /party\.aliases/);
  assert.match(source, /party\.notes/);
});
