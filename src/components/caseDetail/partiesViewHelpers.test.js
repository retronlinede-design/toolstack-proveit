import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyPartyForm,
  filterParties,
  formToPartyInput,
  getPartyEntityTypeLabel,
  getPartyRoleLabel,
  getPartyStatusLabel,
  partyToForm,
  sortPartiesByName,
} from "./partiesViewHelpers.js";

const parties = [
  {
    id: "party-2",
    displayName: "Beta Legal",
    legalName: "Beta Legal LLP",
    entityType: "law_firm",
    roles: ["lawyer", "representative"],
    status: "active",
    tags: ["legal", "external"],
    contact: { email: "law@example.com" },
  },
  {
    id: "party-1",
    displayName: "Alice Smith",
    entityType: "person",
    roles: ["complainant", "witness"],
    status: "potential",
    tags: ["hr", "priority"],
    organisationName: "Acme",
    jobTitle: "Manager",
    contact: { phone: "123" },
  },
  {
    id: "party-3",
    displayName: "City Regulator",
    entityType: "government_agency",
    roles: ["regulator"],
    status: "unknown",
    tags: ["agency"],
  },
];

test("filterParties searches names, labels, contact values, and tags", () => {
  assert.deepEqual(filterParties(parties, { query: "alice" }).map((party) => party.id), ["party-1"]);
  assert.deepEqual(filterParties(parties, { query: "law@example.com" }).map((party) => party.id), ["party-2"]);
  assert.deepEqual(filterParties(parties, { query: "government agency" }).map((party) => party.id), ["party-3"]);
  assert.deepEqual(filterParties(parties, { query: "priority" }).map((party) => party.id), ["party-1"]);
});

test("filterParties applies entity role status and tag filters together", () => {
  assert.deepEqual(filterParties(parties, {
    entityType: "person",
    role: "witness",
    status: "potential",
    tag: "hr",
  }).map((party) => party.id), ["party-1"]);

  assert.deepEqual(filterParties(parties, {
    entityType: "person",
    role: "lawyer",
    status: "potential",
    tag: "hr",
  }), []);
});

test("party form helpers preserve editable fields and parse comma lists", () => {
  const form = partyToForm(parties[0]);
  assert.equal(form.displayName, "Beta Legal");
  assert.equal(form.entityType, "law_firm");
  assert.deepEqual(form.roles, ["lawyer", "representative"]);
  assert.equal(form.tagsText, "legal, external");
  assert.equal(form.email, "law@example.com");

  const input = formToPartyInput({
    ...createEmptyPartyForm(),
    displayName: " New Party ",
    entityType: "company",
    roles: ["respondent"],
    status: "active",
    tagsText: " urgent, urgent, board ",
    aliasesText: " NP, N.P. ",
    email: " test@example.com ",
  });

  assert.equal(input.displayName, "New Party");
  assert.equal(input.entityType, "company");
  assert.deepEqual(input.roles, ["respondent"]);
  assert.deepEqual(input.tags, ["urgent", "board"]);
  assert.deepEqual(input.aliases, ["NP", "N.P."]);
  assert.equal(input.contact.email, "test@example.com");
});

test("party labels and sorting stay stable for the Parties tab", () => {
  assert.equal(getPartyEntityTypeLabel("law_firm"), "Law Firm");
  assert.equal(getPartyRoleLabel("complainant"), "Complainant");
  assert.equal(getPartyStatusLabel("potential"), "Potential");
  assert.deepEqual(sortPartiesByName(parties).map((party) => party.id), ["party-1", "party-2", "party-3"]);
});
