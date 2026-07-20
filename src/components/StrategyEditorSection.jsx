import StringListEditor from "./StringListEditor";

const STRATEGY_TYPES = ["objective", "argument", "action", "risk", "decision", "question"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const DECISION_STATUSES = ["proposed", "approved", "rejected", "completed"];
const optionLabel = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export default function StrategyEditorSection({ recordForm, setRecordForm, caseParties = [], titleInputRef, dateInputRef, descriptionTextareaRef, sequenceGroupField }) {
  const updateField = (field, value) => setRecordForm((current) => ({ ...current, [field]: value }));
  const status = recordForm.status === "archived" ? "archived" : "open";

  return (
    <div className="mb-4 space-y-4">
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Core</h3>
          <p className="mt-1 text-sm text-neutral-600">Define the strategy and its ownership, timing, and current state.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-600">Title</label>
          <input ref={titleInputRef} required value={recordForm.title || ""} onChange={(event) => updateField("title", event.target.value)} className="w-full rounded-xl border border-neutral-300 p-3" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-neutral-600">Strategy Type</label>
            <select value={recordForm.strategyType || ""} onChange={(event) => updateField("strategyType", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm">
              <option value="">Not set</option>
              {STRATEGY_TYPES.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600">Priority</label>
            <select value={recordForm.priority || ""} onChange={(event) => updateField("priority", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm">
              <option value="">Not set</option>
              {PRIORITIES.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600">Status</label>
            <select value={status} onChange={(event) => updateField("status", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm">
              <option value="open">Open</option><option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600">Event Date</label>
            <input ref={dateInputRef} type="date" value={recordForm.date || ""} onChange={(event) => updateField("date", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600">Review Date</label>
            <input type="date" value={recordForm.reviewDate || ""} onChange={(event) => updateField("reviewDate", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600">Owner</label>
            <select value={recordForm.ownerPartyId || ""} onChange={(event) => updateField("ownerPartyId", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm">
              <option value="">No owner</option>
              {caseParties.map((party) => <option key={party.id} value={party.id}>{party.displayName || party.organisationName || "Untitled Party"}</option>)}
            </select>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">{sequenceGroupField}</div>
      </section>

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Planning</h3>
        <div><label className="text-xs font-semibold text-neutral-600">Objective</label><textarea value={recordForm.objective || ""} onChange={(event) => updateField("objective", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" rows={3} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="text-xs font-semibold text-neutral-600">Rationale</label><textarea value={recordForm.rationale || ""} onChange={(event) => updateField("rationale", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" rows={3} /></div>
          <div><label className="text-xs font-semibold text-neutral-600">Desired Outcome</label><textarea value={recordForm.desiredOutcome || ""} onChange={(event) => updateField("desiredOutcome", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" rows={3} /></div>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-600">Decision Status</label>
          <select value={recordForm.decisionStatus || ""} onChange={(event) => updateField("decisionStatus", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm">
            <option value="">Not set</option>
            {DECISION_STATUSES.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
          </select>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Operational Detail</h3>
        <StringListEditor idPrefix="strategy-assumption" label="Assumptions" items={recordForm.assumptions} onChange={(items) => updateField("assumptions", items)} />
        <StringListEditor idPrefix="strategy-risk" label="Risks" items={recordForm.risks} onChange={(items) => updateField("risks", items)} />
        <StringListEditor idPrefix="strategy-next-step" label="Next Steps" items={recordForm.nextSteps} onChange={(items) => updateField("nextSteps", items)} />
      </section>

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div><h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Compatibility / Notes</h3><p className="mt-1 text-xs text-neutral-500">Legacy description and notes remain independent from structured planning fields.</p></div>
        <div><label className="text-xs font-semibold text-neutral-600">Description</label><textarea ref={descriptionTextareaRef} value={recordForm.description || ""} onChange={(event) => updateField("description", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm" rows={4} /></div>
        <div><label className="text-xs font-semibold text-neutral-600">Notes</label><textarea value={recordForm.notes || ""} onChange={(event) => updateField("notes", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm" rows={3} /></div>
      </section>
    </div>
  );
}
