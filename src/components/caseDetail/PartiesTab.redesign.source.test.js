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

test("Party Create/Edit uses DialogShell with stable session baselines and guarded dismissal", () => {
  assert.match(source, /import DialogShell from "\.\.\/shared\/DialogShell\.jsx"/);
  assert.match(source, /<DialogShell/);
  assert.match(source, /title=\{title\}/);
  assert.match(source, /width="wide"/);
  assert.match(source, /onRequestClose=\{requestClose\}/);
  assert.match(source, /dismissOnBackdrop=\{false\}/);
  assert.match(source, /initialFocusRef=\{displayNameInputRef\}/);
  assert.match(source, /const initialFingerprintRef = useRef\(partyDraftFingerprint\(form\)\)/);
  assert.match(source, /Discard unsaved Party changes\?/);
  assert.match(source, /Keep editing/);
  assert.match(source, /form="party-editor-form"/);
  assert.doesNotMatch(source, /<div className="fixed inset-0 z-50 flex items-center justify-center bg-black\/30 p-4">/);
});

test("Party Create/Edit preserves every field and retains failed drafts", () => {
  for (const label of ["Display Name", "Legal Name", "Entity Type", "Status", "Organisation", "Job Title", "Department", "Confidentiality", "Email", "Phone", "Website", "Tags", "Roles", "Aliases", "Relationship To Case", "Notes"]) {
    assert.match(source, new RegExp(`>${label}<`));
  }
  assert.match(source, /formToPartyInput\(form\), editingParty\?\.id \|\| null/);
  assert.match(source, /if \(saved !== false\) closeModal\(\)/);
  assert.match(source, /The Party could not be saved\. Your changes are still available to review\./);
  assert.match(source, /statusMessage=\{saveError\}/);
  assert.match(source, /partyDraftFingerprint\(form\)/);
});

test("Party dialog styling remains scoped and uses the shared navy and teal controls", () => {
  assert.match(source, /className="proveit-party-dialog"/);
  assert.match(styles, /\.proveit-party-dialog \{/);
  assert.match(styles, /\.proveit-party-dialog :is\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\), select, textarea\)/);
  assert.match(styles, /outline: 2px solid #2dd4bf/);
});
