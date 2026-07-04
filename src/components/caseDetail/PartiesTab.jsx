import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import {
  PARTY_ENTITY_TYPES,
  PARTY_ROLES,
  PARTY_STATUSES,
  PARTY_CONFIDENTIALITY_LEVELS,
} from "../../domain/caseDomain.js";
import {
  PARTY_FILTER_ALL,
  createEmptyPartyForm,
  filterParties,
  formToPartyInput,
  getPartyConfidentialityLabel,
  getPartyEntityTypeLabel,
  getPartyRoleLabel,
  getPartyStatusLabel,
  partyToForm,
  sortPartiesByName,
} from "./partiesViewHelpers.js";

function Chip({ children, tone = "neutral" }) {
  const classes = {
    neutral: "border-neutral-200 bg-neutral-50 text-neutral-600",
    entity: "border-blue-200 bg-blue-50 text-blue-700",
    role: "border-lime-200 bg-lime-50 text-lime-700",
    status: "border-amber-200 bg-amber-50 text-amber-700",
    restricted: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${classes[tone] || classes.neutral}`}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function PartyModal({
  form,
  editingParty,
  saving,
  onCancel,
  onChange,
  onToggleRole,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={onSubmit}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl"
      >
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-950">{editingParty ? "Edit Party" : "Add Party"}</h3>
            <p className="mt-1 text-sm text-neutral-500">Store party details for this case. Record links are not part of this phase.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Display Name</span>
            <input
              value={form.displayName}
              onChange={(event) => onChange("displayName", event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Legal Name</span>
            <input
              value={form.legalName}
              onChange={(event) => onChange("legalName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Entity Type</span>
            <select
              value={form.entityType}
              onChange={(event) => onChange("entityType", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            >
              {PARTY_ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>{getPartyEntityTypeLabel(type)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Status</span>
            <select
              value={form.status}
              onChange={(event) => onChange("status", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            >
              {PARTY_STATUSES.map((status) => (
                <option key={status} value={status}>{getPartyStatusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Organisation</span>
            <input
              value={form.organisationName}
              onChange={(event) => onChange("organisationName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Job Title</span>
            <input
              value={form.jobTitle}
              onChange={(event) => onChange("jobTitle", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Department</span>
            <input
              value={form.department}
              onChange={(event) => onChange("department", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Confidentiality</span>
            <select
              value={form.confidentiality}
              onChange={(event) => onChange("confidentiality", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            >
              {PARTY_CONFIDENTIALITY_LEVELS.map((level) => (
                <option key={level} value={level}>{getPartyConfidentialityLabel(level)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Email</span>
            <input
              value={form.email}
              onChange={(event) => onChange("email", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Phone</span>
            <input
              value={form.phone}
              onChange={(event) => onChange("phone", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Website</span>
            <input
              value={form.website}
              onChange={(event) => onChange("website", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Tags</span>
            <input
              value={form.tagsText}
              onChange={(event) => onChange("tagsText", event.target.value)}
              placeholder="comma separated"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Roles</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PARTY_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form.roles.includes(role)}
                  onChange={() => onToggleRole(role)}
                  className="h-4 w-4 accent-lime-500"
                />
                <span>{getPartyRoleLabel(role)}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Aliases</span>
          <input
            value={form.aliasesText}
            onChange={(event) => onChange("aliasesText", event.target.value)}
            placeholder="comma separated"
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Relationship To Case</span>
          <textarea
            value={form.relationshipToCase}
            onChange={(event) => onChange("relationshipToCase", event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
          />
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !form.displayName.trim()}
            className="rounded-lg border border-lime-500 bg-white px-4 py-2 text-sm font-bold text-neutral-900 shadow-sm hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Party"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PartiesTab({
  parties = [],
  onSaveParty,
  onDeleteParty,
}) {
  const [query, setQuery] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState(PARTY_FILTER_ALL);
  const [roleFilter, setRoleFilter] = useState(PARTY_FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState(PARTY_FILTER_ALL);
  const [tagFilter, setTagFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [form, setForm] = useState(createEmptyPartyForm);
  const [saving, setSaving] = useState(false);

  const sortedParties = useMemo(() => sortPartiesByName(parties), [parties]);
  const filteredParties = useMemo(() => filterParties(sortedParties, {
    query,
    entityType: entityTypeFilter,
    role: roleFilter,
    status: statusFilter,
    tag: tagFilter,
  }), [sortedParties, query, entityTypeFilter, roleFilter, statusFilter, tagFilter]);

  const openAddModal = () => {
    setEditingParty(null);
    setForm(createEmptyPartyForm());
    setModalOpen(true);
  };

  const openEditModal = (party) => {
    setEditingParty(party);
    setForm(partyToForm(party));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingParty(null);
    setSaving(false);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleRole = (role) => {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role],
    }));
  };

  const submitParty = async (event) => {
    event.preventDefault();
    if (!form.displayName.trim()) return;

    setSaving(true);
    const saved = await onSaveParty?.(formToPartyInput(form), editingParty?.id || null);
    if (saved !== false) closeModal();
    else setSaving(false);
  };

  const deleteParty = async (party) => {
    const confirmed = window.confirm(`Delete party "${party.displayName || "Untitled"}"?`);
    if (!confirmed) return;
    await onDeleteParty?.(party.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-950">People & Parties</h3>
          <p className="mt-1 text-sm text-neutral-500">Manage people and organisations connected to this case.</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-bold text-neutral-900 shadow-sm hover:bg-lime-400/30"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Add Party
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="grid gap-3 lg:grid-cols-5">
          <label className="block lg:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Search</span>
            <span className="mt-1 flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, alias, contact, tag"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Entity</span>
            <select value={entityTypeFilter} onChange={(event) => setEntityTypeFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500">
              <option value={PARTY_FILTER_ALL}>All entities</option>
              {PARTY_ENTITY_TYPES.map((type) => <option key={type} value={type}>{getPartyEntityTypeLabel(type)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Role</span>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500">
              <option value={PARTY_FILTER_ALL}>All roles</option>
              {PARTY_ROLES.map((role) => <option key={role} value={role}>{getPartyRoleLabel(role)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500">
              <option value={PARTY_FILTER_ALL}>All statuses</option>
              {PARTY_STATUSES.map((status) => <option key={status} value={status}>{getPartyStatusLabel(status)}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-3 block max-w-md">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Tag</span>
          <input
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            placeholder="Filter by tag"
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-lime-500"
          />
        </label>
      </div>

      <div className="flex items-center justify-between text-xs font-semibold text-neutral-500">
        <span>{filteredParties.length} of {parties.length} parties shown</span>
      </div>

      {parties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
          No parties yet. Add people, organisations, agencies, providers, or representatives for this case.
        </div>
      ) : filteredParties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
          No parties match these filters.
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filteredParties.map((party) => (
            <article key={party.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h4 className="truncate text-base font-semibold text-neutral-950">{party.displayName || "Untitled Party"}</h4>
                  {party.legalName && party.legalName !== party.displayName && (
                    <p className="mt-1 truncate text-sm text-neutral-500">{party.legalName}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => openEditModal(party)} className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-50">Edit</button>
                  <button type="button" onClick={() => deleteParty(party)} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50">Delete</button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Chip tone="entity">{getPartyEntityTypeLabel(party.entityType)}</Chip>
                <Chip tone="status">{getPartyStatusLabel(party.status)}</Chip>
                {party.confidentiality && party.confidentiality !== "normal" && (
                  <Chip tone="restricted">{getPartyConfidentialityLabel(party.confidentiality)}</Chip>
                )}
                {(party.roles || []).map((role) => (
                  <Chip key={role} tone="role">{getPartyRoleLabel(role)}</Chip>
                ))}
              </div>

              {(party.organisationName || party.jobTitle || party.department) && (
                <p className="mt-3 text-sm text-neutral-600">
                  {[party.jobTitle, party.department, party.organisationName].filter(Boolean).join(" | ")}
                </p>
              )}
              {party.relationshipToCase && (
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-neutral-700">{party.relationshipToCase}</p>
              )}
              {(party.contact?.email || party.contact?.phone || party.contact?.website) && (
                <p className="mt-2 truncate text-xs font-medium text-neutral-500">
                  {[party.contact?.email, party.contact?.phone, party.contact?.website].filter(Boolean).join(" | ")}
                </p>
              )}
              {party.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {party.tags.map((tag) => <Chip key={tag}>{tag}</Chip>)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <PartyModal
          form={form}
          editingParty={editingParty}
          saving={saving}
          onCancel={closeModal}
          onChange={updateForm}
          onToggleRole={toggleRole}
          onSubmit={submitParty}
        />
      )}
    </div>
  );
}
