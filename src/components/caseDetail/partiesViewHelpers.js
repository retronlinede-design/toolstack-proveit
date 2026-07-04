import {
  PARTY_CONFIDENTIALITY_LEVELS,
  PARTY_ENTITY_TYPES,
  PARTY_ROLES,
  PARTY_STATUSES,
} from "../../domain/caseDomain.js";

export const PARTY_ENTITY_TYPE_LABELS = {
  person: "Person",
  organisation: "Organisation",
  government_agency: "Government Agency",
  company: "Company",
  law_firm: "Law Firm",
  medical_provider: "Medical Provider",
  other: "Other",
};

export const PARTY_ROLE_LABELS = {
  complainant: "Complainant",
  respondent: "Respondent",
  witness: "Witness",
  investigator: "Investigator",
  representative: "Representative",
  lawyer: "Lawyer",
  manager: "Manager",
  medical_professional: "Medical Professional",
  expert: "Expert",
  regulator: "Regulator",
  other: "Other",
};

export const PARTY_STATUS_LABELS = {
  active: "Active",
  former: "Former",
  potential: "Potential",
  excluded: "Excluded",
  unknown: "Unknown",
};

export const PARTY_CONFIDENTIALITY_LABELS = {
  normal: "Normal",
  sensitive: "Sensitive",
  privileged: "Privileged",
  restricted: "Restricted",
};

export const PARTY_FILTER_ALL = "all";

export function getPartyEntityTypeLabel(value) {
  return PARTY_ENTITY_TYPE_LABELS[value] || PARTY_ENTITY_TYPE_LABELS.other;
}

export function getPartyRoleLabel(value) {
  return PARTY_ROLE_LABELS[value] || PARTY_ROLE_LABELS.other;
}

export function getPartyStatusLabel(value) {
  return PARTY_STATUS_LABELS[value] || PARTY_STATUS_LABELS.unknown;
}

export function getPartyConfidentialityLabel(value) {
  return PARTY_CONFIDENTIALITY_LABELS[value] || PARTY_CONFIDENTIALITY_LABELS.normal;
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

export function createEmptyPartyForm() {
  return {
    displayName: "",
    legalName: "",
    entityType: PARTY_ENTITY_TYPES[0],
    roles: [],
    status: PARTY_STATUSES[0],
    confidentiality: PARTY_CONFIDENTIALITY_LEVELS[0],
    organisationName: "",
    jobTitle: "",
    department: "",
    relationshipToCase: "",
    email: "",
    phone: "",
    website: "",
    tagsText: "",
    aliasesText: "",
    notes: "",
  };
}

export function partyToForm(party = {}) {
  return {
    ...createEmptyPartyForm(),
    displayName: text(party.displayName),
    legalName: text(party.legalName),
    entityType: PARTY_ENTITY_TYPES.includes(party.entityType) ? party.entityType : PARTY_ENTITY_TYPES[0],
    roles: list(party.roles).filter((role) => PARTY_ROLES.includes(role)),
    status: PARTY_STATUSES.includes(party.status) ? party.status : PARTY_STATUSES[0],
    confidentiality: PARTY_CONFIDENTIALITY_LEVELS.includes(party.confidentiality)
      ? party.confidentiality
      : PARTY_CONFIDENTIALITY_LEVELS[0],
    organisationName: text(party.organisationName),
    jobTitle: text(party.jobTitle),
    department: text(party.department),
    relationshipToCase: text(party.relationshipToCase),
    email: text(party.contact?.email),
    phone: text(party.contact?.phone),
    website: text(party.contact?.website),
    tagsText: list(party.tags).join(", "),
    aliasesText: list(party.aliases).join(", "),
    notes: text(party.notes),
  };
}

function parseCommaList(value) {
  const seen = new Set();
  return text(value)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item.toLowerCase())) return false;
      seen.add(item.toLowerCase());
      return true;
    });
}

export function formToPartyInput(form = {}) {
  return {
    displayName: text(form.displayName).trim(),
    legalName: text(form.legalName).trim(),
    entityType: form.entityType,
    roles: list(form.roles),
    status: form.status,
    confidentiality: form.confidentiality,
    organisationName: text(form.organisationName).trim(),
    jobTitle: text(form.jobTitle).trim(),
    department: text(form.department).trim(),
    relationshipToCase: text(form.relationshipToCase),
    contact: {
      email: text(form.email).trim(),
      phone: text(form.phone).trim(),
      website: text(form.website).trim(),
      preferredMethod: "",
      notes: "",
    },
    aliases: parseCommaList(form.aliasesText),
    tags: parseCommaList(form.tagsText),
    notes: text(form.notes),
  };
}

export function getPartySearchText(party = {}) {
  return [
    party.displayName,
    party.legalName,
    party.organisationName,
    party.jobTitle,
    party.department,
    party.relationshipToCase,
    party.contact?.email,
    party.contact?.phone,
    party.contact?.website,
    ...list(party.aliases),
    ...list(party.roles).map(getPartyRoleLabel),
    ...list(party.tags),
    getPartyEntityTypeLabel(party.entityType),
    getPartyStatusLabel(party.status),
  ].join(" ").toLowerCase();
}

export function filterParties(parties = [], filters = {}) {
  const query = text(filters.query).trim().toLowerCase();
  const entityType = filters.entityType || PARTY_FILTER_ALL;
  const role = filters.role || PARTY_FILTER_ALL;
  const status = filters.status || PARTY_FILTER_ALL;
  const tag = text(filters.tag).trim().toLowerCase();

  return parties.filter((party) => {
    if (query && !getPartySearchText(party).includes(query)) return false;
    if (entityType !== PARTY_FILTER_ALL && party.entityType !== entityType) return false;
    if (role !== PARTY_FILTER_ALL && !list(party.roles).includes(role)) return false;
    if (status !== PARTY_FILTER_ALL && party.status !== status) return false;
    if (tag && !list(party.tags).some((item) => item.toLowerCase().includes(tag))) return false;
    return true;
  });
}

export function sortPartiesByName(parties = []) {
  return [...parties].sort((a, b) =>
    text(a.displayName || a.legalName).localeCompare(text(b.displayName || b.legalName))
  );
}
