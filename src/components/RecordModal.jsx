import { useState, useEffect, useRef } from "react";
import { EVIDENCE_ROLES, INCIDENT_LINK_TYPES } from "../domain/caseDomain.js";
import { suggestEvidenceMetadataForForm } from "../domain/recordFormDomain.js";

const EVIDENCE_ROLE_LABELS = {
  ANCHOR_EVIDENCE: "Anchor Evidence",
  SUPPORTING_EVIDENCE: "Supporting Evidence",
  TIMELINE_EVIDENCE: "Timeline Evidence",
  MEDICAL_EVIDENCE: "Medical Evidence",
  COMMUNICATION_EVIDENCE: "Communication Evidence",
  OPERATIONAL_EVIDENCE: "Operational Evidence",
  CORROBORATING_EVIDENCE: "Corroborating Evidence",
  OTHER: "Other",
};

const EVIDENCE_SUGGESTION_FIELDS = [
  "evidenceRole",
  "functionSummary",
  "sequenceGroup",
  "relevance",
  "importance",
];

const AUTO_SUGGEST_DESCRIPTION_THRESHOLD = 20;

function isTrackingRecordDocument(doc) {
  return typeof doc?.textContent === "string" && doc.textContent.includes("[TRACK RECORD]");
}

function getTrackingRecordTypeLabel(doc) {
  const match = safeText(doc?.textContent).match(/^\s*type:\s*(.+)$/im);
  const value = match?.[1]?.trim().toLowerCase() || "";
  if (value === "payment_tracker" || value === "financial") return "Financial";
  if (value === "work_time") return "Work Time";
  if (value === "compliance") return "Compliance";
  if (value === "custom") return "Custom";
  return "Record";
}

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function getTrackingRecordSummary(doc) {
  return safeText(doc?.summary) || safeText(doc?.source) || safeText(doc?.textContent).slice(0, 160);
}

function getEvidenceAttachmentCount(recordForm) {
  const attachments = [
    ...(Array.isArray(recordForm?.attachments) ? recordForm.attachments : []),
    ...(Array.isArray(recordForm?.availability?.digital?.files) ? recordForm.availability.digital.files : []),
  ];
  const seen = new Set();

  for (const attachment of attachments) {
    const key = attachment?.id || attachment?.name || attachment?.storage?.imageId;
    seen.add(key || attachment);
  }

  return seen.size;
}

function hasMeaningfulEvidenceMetadataValue(field, value) {
  if (field === "evidenceRole") return Boolean(value && value !== "OTHER");
  if (field === "relevance") return Boolean(value && value !== "medium");
  if (field === "importance") return Boolean(value && value !== "unreviewed");
  return typeof value === "string" && value.trim().length > 0;
}

function applySafeAutoEvidenceSuggestions(recordForm, selectedCase, userEditedFields) {
  const suggestedForm = suggestEvidenceMetadataForForm(recordForm, selectedCase);

  return EVIDENCE_SUGGESTION_FIELDS.reduce((nextForm, field) => {
    if (userEditedFields[field] || hasMeaningfulEvidenceMetadataValue(field, recordForm[field])) {
      return nextForm;
    }

    return { ...nextForm, [field]: suggestedForm[field] };
  }, recordForm);
}

export default function RecordModal({
  recordType,
  selectedCase,
  recordForm,
  setRecordForm,
  handleRecordFiles,
  removeRecordAttachment,
  saveRecord,
  closeRecordModal,
  focusField,
  focusHint,
  onPreviewFile,
  openEditRecordModal,
  openDocumentModal,
  onCreateEvidenceFromIncident,
  onUnlinkEvidenceFromIncident,
}) {
  const [isLinking, setIsLinking] = useState(false);
  const [tempSelection, setTempSelection] = useState([]);
  const [selectedLinkedRecordId, setSelectedLinkedRecordId] = useState("");
  const [hasAutoSuggested, setHasAutoSuggested] = useState(false);
  const [showAutoSuggestedIndicator, setShowAutoSuggestedIndicator] = useState(false);
  const [showAdvancedEvidenceDetails, setShowAdvancedEvidenceDetails] = useState(false);
  const [userEditedSuggestionFields, setUserEditedSuggestionFields] = useState({});
  const titleInputRef = useRef(null);
  const dateInputRef = useRef(null);
  const descriptionTextareaRef = useRef(null);
  const initialAutoSuggestInputsRef = useRef({
    attachmentCount: getEvidenceAttachmentCount(recordForm),
    descriptionLength: (recordForm.description || "").trim().length,
  });
  const incidentLinkRefs = Array.isArray(recordForm.linkedIncidentRefs) ? recordForm.linkedIncidentRefs : [];
  const incidentOptions = (selectedCase.incidents || []).filter((incident) => incident.id !== recordForm.id);
  const linkedEvidenceIncidentIds = Array.isArray(recordForm.linkedIncidentIds) ? recordForm.linkedIncidentIds : [];
  const linkedIncidentRecordIds = Array.isArray(recordForm.linkedRecordIds) ? recordForm.linkedRecordIds : [];
  const trackingRecords = (selectedCase.documents || []).filter(isTrackingRecordDocument);
  const linkedTrackingRecords = linkedIncidentRecordIds
    .map((recordId) => trackingRecords.find((record) => record.id === recordId))
    .filter(Boolean);
  const availableTrackingRecords = trackingRecords.filter((record) => !linkedIncidentRecordIds.includes(record.id));
  const evidenceAttachmentCount = getEvidenceAttachmentCount(recordForm);

  // Follow-up task helper logic for new records
  const toggleEvidenceLink = (id) => {
    setTempSelection(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleConfirmLinks = () => {
    const targetField = "linkedEvidenceIds";
    setRecordForm({
      ...recordForm,
      [targetField]: Array.from(new Set([...(recordForm[targetField] || []), ...tempSelection]))
    });
    setIsLinking(false);
    setTempSelection([]);
  };

  const getIncidentOptionsForLinkRow = (rowIndex) => {
    const selectedIncidentIds = new Set(
      incidentLinkRefs
        .filter((_, index) => index !== rowIndex)
        .map((ref) => ref.incidentId)
    );

    return incidentOptions.filter((incident) => !selectedIncidentIds.has(incident.id));
  };

  const addIncidentLinkRef = () => {
    const selectedIncidentIds = new Set(incidentLinkRefs.map((ref) => ref.incidentId));
    const nextIncident = incidentOptions.find((incident) => !selectedIncidentIds.has(incident.id));

    if (!nextIncident) return;

    setRecordForm({
      ...recordForm,
      linkedIncidentRefs: [
        ...incidentLinkRefs,
        { incidentId: nextIncident.id, type: "RELATED_TO" },
      ],
    });
  };

  const updateIncidentLinkRef = (index, patch) => {
    const nextRefs = incidentLinkRefs.map((ref, refIndex) => {
      if (refIndex !== index) return ref;
      return { ...ref, ...patch };
    });

    const seenIncidentIds = new Set();
    setRecordForm({
      ...recordForm,
      linkedIncidentRefs: nextRefs.filter((ref) => {
        if (!ref.incidentId || seenIncidentIds.has(ref.incidentId)) return false;
        seenIncidentIds.add(ref.incidentId);
        return true;
      }),
    });
  };

  const removeIncidentLinkRef = (index) => {
    setRecordForm({
      ...recordForm,
      linkedIncidentRefs: incidentLinkRefs.filter((_, refIndex) => refIndex !== index),
    });
  };

  const toggleLinkedEvidenceIncident = (incidentId) => {
    setRecordForm({
      ...recordForm,
      linkedIncidentIds: linkedEvidenceIncidentIds.includes(incidentId)
        ? linkedEvidenceIncidentIds.filter((id) => id !== incidentId)
        : [...linkedEvidenceIncidentIds, incidentId],
    });
  };

  const linkSelectedRecordToIncident = () => {
    if (!selectedLinkedRecordId) return;
    setRecordForm({
      ...recordForm,
      linkedRecordIds: Array.from(new Set([...linkedIncidentRecordIds, selectedLinkedRecordId])),
    });
    setSelectedLinkedRecordId("");
  };

  const unlinkRecordFromIncidentForm = (recordId) => {
    setRecordForm({
      ...recordForm,
      linkedRecordIds: linkedIncidentRecordIds.filter((id) => id !== recordId),
    });
  };

  const handleSuggestEvidenceMetadata = () => {
    setRecordForm(suggestEvidenceMetadataForForm(recordForm, selectedCase));
  };

  const updateSuggestedMetadataField = (field, value) => {
    setUserEditedSuggestionFields((prev) => ({ ...prev, [field]: true }));
    setRecordForm({ ...recordForm, [field]: value });
  };

  const isEdit = !!recordForm.id;
  const typeLabelMap = {
    evidence: "Evidence",
    incidents: "Incident",
    strategy: "Strategy",
    documents: "Document",
    Document: "Document",
  };

  const getRecordDetails = (id) => {
    const all = [
      ...selectedCase.evidence,
      ...selectedCase.incidents,
      ...selectedCase.strategy,
      ...(selectedCase.documents || []),
    ];
    const found = all.find((r) => r.id === id);
    if (!found) return null;
    return { 
      title: found.title || "Untitled", 
      type: found.type, 
      typeLabel: typeLabelMap[found.type] || "Record", 
      raw: found 
    };
  };

  const typeLabel = typeLabelMap[recordType] || recordType;

  useEffect(() => {
    if (!focusField || isLinking) return;

    const fieldRefs = {
      title: titleInputRef,
      date: dateInputRef,
      description: descriptionTextareaRef,
    };
    const target = fieldRefs[focusField]?.current;

    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusField, isLinking]);

  useEffect(() => {
    if (recordType !== "evidence" || hasAutoSuggested) return;

    const initialInputs = initialAutoSuggestInputsRef.current;
    const descriptionLength = (recordForm.description || "").trim().length;
    const attachmentWasAdded = evidenceAttachmentCount > initialInputs.attachmentCount;
    const descriptionCrossedThreshold =
      initialInputs.descriptionLength <= AUTO_SUGGEST_DESCRIPTION_THRESHOLD &&
      descriptionLength > AUTO_SUGGEST_DESCRIPTION_THRESHOLD;

    if (!attachmentWasAdded && !descriptionCrossedThreshold) return;

    setHasAutoSuggested(true);
    setShowAutoSuggestedIndicator(true);
    setRecordForm((currentForm) =>
      applySafeAutoEvidenceSuggestions(currentForm, selectedCase, userEditedSuggestionFields)
    );
  }, [
    evidenceAttachmentCount,
    hasAutoSuggested,
    recordForm.description,
    recordType,
    selectedCase,
    setRecordForm,
    userEditedSuggestionFields,
  ]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-6 pb-0">
          <h2 className="text-xl font-semibold">
            {isLinking ? "Link Existing Evidence" : `${isEdit ? "Edit" : "Add"} ${typeLabel}`}
          </h2>
          <p className="mb-4 text-sm text-neutral-600">Case: {selectedCase.name}</p>
          {focusHint && !isLinking && (
            <p className="mb-4 rounded-lg border border-lime-100 bg-lime-50 px-3 py-2 text-xs text-lime-800">
              Also needed: {focusHint}
            </p>
          )}
        </div>

        <div className="p-6 pt-0 overflow-y-auto flex-1">
        {isLinking ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 mb-4">
              Select evidence items from this case to link to this incident.
            </p>
            <div className="space-y-2">
              {(() => {
                const candidates = selectedCase.evidence;

                if (candidates.length === 0) return <p className="text-sm text-neutral-500 italic py-4 text-center">No records available to link.</p>;

                return candidates.map(rec => {
                  if (rec.id === recordForm.id) return null;
                  const isAlreadyLinked = recordForm.linkedEvidenceIds?.includes(rec.id);
                  
                  return (
                    <label key={rec.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${isAlreadyLinked ? 'bg-neutral-50 border-neutral-100 opacity-60' : 'bg-white border-neutral-200 hover:border-lime-300 hover:bg-lime-50/30'}`}>
                      <div className="flex items-center gap-3 truncate">
                        <input 
                          type="checkbox"
                          checked={isAlreadyLinked || tempSelection.includes(rec.id)}
                          disabled={isAlreadyLinked}
                          onChange={() => toggleEvidenceLink(rec.id)}
                          className="h-5 w-5 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
                        />
                        <div className="truncate">
                          <span className="truncate text-sm font-medium text-neutral-800">{rec.title || "Untitled"}</span>
                          {rec._type && <span className="ml-2 text-[9px] px-1 rounded bg-neutral-100 text-neutral-400 font-bold uppercase">{rec._type}</span>}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase">{rec.date || rec.eventDate}</span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>
        ) : (
          <>
        <input
          ref={titleInputRef}
          placeholder="Title"
          value={recordForm.title}
          onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
        />
        <input
          ref={dateInputRef}
          type="date"
          value={recordForm.date}
          onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
        />
        <textarea
          ref={descriptionTextareaRef}
          placeholder="Description"
          value={recordForm.description}
          onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
          rows={4}
        />
        {recordType !== "evidence" && (
          <textarea
            placeholder="Notes"
            value={recordForm.notes}
            onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
            className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
            rows={3}
          />
        )}

        <div />

        {recordType === "evidence" && (
          <div className="mb-4 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Evidence Assessment</h3>
              <button
                onClick={handleSuggestEvidenceMetadata}
                className="shrink-0 rounded-lg border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
              >
                Suggest Metadata
              </button>
            </div>
            {showAutoSuggestedIndicator && (
              <p className="text-xs font-medium text-lime-700">Metadata suggested</p>
            )}
            
            <button
              type="button"
              onClick={() => setShowAdvancedEvidenceDetails((prev) => !prev)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 transition-colors"
            >
              {showAdvancedEvidenceDetails ? "Hide advanced details" : "Advanced details"}
            </button>

            {showAdvancedEvidenceDetails && (
              <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-600">Importance</label>
                <select 
                  value={recordForm.importance} 
                  onChange={(e) => updateSuggestedMetadataField("importance", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-xs"
                >
                  <option value="unreviewed">Unreviewed</option>
                  <option value="critical">Critical</option>
                  <option value="strong">Strong</option>
                  <option value="supporting">Supporting</option>
                  <option value="weak">Weak</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600">Relevance</label>
                <select 
                  value={recordForm.relevance} 
                  onChange={(e) => updateSuggestedMetadataField("relevance", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-xs"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600">Status</label>
                <select 
                  value={recordForm.status} 
                  onChange={(e) => setRecordForm({...recordForm, status: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-xs"
                >
                  <option value="needs_review">Needs Review</option>
                  <option value="verified">Verified</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-neutral-600">Evidence Role</label>
                <select
                  value={recordForm.evidenceRole || "OTHER"}
                  onChange={(e) => updateSuggestedMetadataField("evidenceRole", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                >
                  {EVIDENCE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {EVIDENCE_ROLE_LABELS[role] || role}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600">Sequence Group</label>
                <input
                  placeholder="e.g. Repair timeline"
                  value={recordForm.sequenceGroup || ""}
                  onChange={(e) => updateSuggestedMetadataField("sequenceGroup", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-600">Function Summary</label>
              <textarea
                placeholder="What this evidence helps establish..."
                value={recordForm.functionSummary || ""}
                onChange={(e) => updateSuggestedMetadataField("functionSummary", e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                rows={2}
              />
            </div>
              </>
            )}

            <div className="space-y-2">
              <div>
                <label className="text-xs font-semibold text-neutral-600">Linked Incidents</label>
                <p className="mt-1 text-xs text-neutral-500">Connect this evidence to the incident records it supports.</p>
              </div>
              {(selectedCase.incidents || []).length > 0 ? (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2">
                  {(selectedCase.incidents || []).map((incident) => (
                    <label key={incident.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm hover:border-lime-300 hover:bg-lime-50/40">
                      <span className="min-w-0 flex-1 truncate text-neutral-800">{incident.title || "Untitled incident"}</span>
                      {(incident.eventDate || incident.date) && (
                        <span className="shrink-0 text-[10px] font-bold uppercase text-neutral-400">{incident.eventDate || incident.date}</span>
                      )}
                      <input
                        type="checkbox"
                        checked={linkedEvidenceIncidentIds.includes(incident.id)}
                        onChange={() => toggleLinkedEvidenceIncident(incident.id)}
                        className="h-4 w-4 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-neutral-200 bg-white p-3 text-xs text-neutral-500 italic">
                  No incidents available to link yet.
                </p>
              )}
            </div>

            {showAdvancedEvidenceDetails && (
              <div>
                <label className="text-xs font-semibold text-neutral-600">Review Notes</label>
                <textarea 
                  placeholder="Internal assessment notes..."
                  value={recordForm.reviewNotes}
                  onChange={(e) => setRecordForm({...recordForm, reviewNotes: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                  rows={2}
                />
              </div>
            )}
          </div>
        )}

        {recordType === "evidence" && showAdvancedEvidenceDetails && (
          <div className="mb-4 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Evidence Availability</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-neutral-600">Source Type</label>
                <select 
                  value={recordForm.sourceType} 
                  onChange={(e) => setRecordForm({...recordForm, sourceType: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                >
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600">Captured At</label>
                <input 
                  type="date" 
                  value={recordForm.capturedAt} 
                  onChange={(e) => setRecordForm({...recordForm, capturedAt: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-neutral-200 pt-3">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="hasOriginal"
                  checked={recordForm.availability?.physical?.hasOriginal}
                  onChange={(e) => setRecordForm({
                    ...recordForm, 
                    availability: {
                      ...(recordForm.availability || {}), 
                      physical: { ...(recordForm.availability?.physical || {}), hasOriginal: e.target.checked }
                    }
                  })}
                />
                <label htmlFor="hasOriginal" className="text-sm font-medium">Physical original available</label>
              </div>
              {recordForm.availability?.physical?.hasOriginal && (
                <div className="ml-6 space-y-2">
                  <input 
                    placeholder="Physical Location (Cabinet A, Box 2...)" 
                    value={recordForm.availability.physical.location}
                    onChange={(e) => setRecordForm({
                      ...recordForm,
                      availability: { 
                        ...(recordForm.availability || {}), 
                        physical: { ...(recordForm.availability?.physical || {}), location: e.target.value }
                      }
                    })}
                    className="w-full rounded-lg border border-neutral-300 p-2 text-sm"
                  />
                  <textarea 
                    placeholder="Physical notes..." 
                    value={recordForm.availability.physical.notes}
                    onChange={(e) => setRecordForm({
                      ...recordForm,
                      availability: { 
                        ...(recordForm.availability || {}), 
                        physical: { ...(recordForm.availability?.physical || {}), notes: e.target.value }
                      }
                    })}
                    className="w-full rounded-lg border border-neutral-300 p-2 text-sm"
                    rows={1}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-neutral-200 pt-3">
              <input 
                type="checkbox" 
                id="hasDigital"
                checked={recordForm.availability?.digital?.hasDigital}
                onChange={(e) => setRecordForm({
                  ...recordForm,
                  availability: {
                    ...(recordForm.availability || {}),
                    digital: { ...(recordForm.availability?.digital || {}), hasDigital: e.target.checked }
                  }
                })}
              />
              <label htmlFor="hasDigital" className="text-sm font-medium">Digital copy available</label>
            </div>
          </div>
        )}

        {recordType === "incidents" ? (
          <div className="space-y-4">
          <div className="mb-4 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Linked Incidents</h3>
                <p className="mt-1 text-xs text-neutral-500">Connect this incident to related events or outcomes.</p>
              </div>
              <button
                onClick={addIncidentLinkRef}
                disabled={incidentLinkRefs.length >= incidentOptions.length}
                className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:shadow-none transition-colors"
              >
                + Add Link
              </button>
            </div>

            {incidentLinkRefs.length > 0 ? (
              <div className="space-y-2">
                {incidentLinkRefs.map((ref, index) => {
                  const options = getIncidentOptionsForLinkRow(index);
                  return (
                    <div key={`${ref.incidentId || "incident"}-${index}`} className="grid gap-2 rounded-xl border border-neutral-200 bg-white p-3 sm:grid-cols-[1fr_auto_auto]">
                      <select
                        value={ref.incidentId || ""}
                        onChange={(e) => updateIncidentLinkRef(index, { incidentId: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 p-2 text-sm"
                      >
                        {options.map((incident) => (
                          <option key={incident.id} value={incident.id}>
                            {incident.title || "Untitled incident"}
                          </option>
                        ))}
                      </select>
                      <select
                        value={ref.type || "RELATED_TO"}
                        onChange={(e) => updateIncidentLinkRef(index, { type: e.target.value })}
                        className="rounded-lg border border-neutral-300 p-2 text-sm"
                      >
                        {INCIDENT_LINK_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type === "CAUSES" ? "Causes" : "Related to"}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeIncidentLinkRef(index)}
                        className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic">No incidents linked yet.</p>
            )}
          </div>

          <div className="mb-4 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Linked Evidence</h3>
            {recordForm.linkedEvidenceIds && recordForm.linkedEvidenceIds.length > 0 ? (
              <div className="space-y-2">
                {recordForm.linkedEvidenceIds.map((evidenceId) => {
                  const evidenceItem = selectedCase.evidence.find(e => e.id === evidenceId);
                  if (!evidenceItem) return null;
                  return (
                    <div key={evidenceId} className="rounded-xl border border-neutral-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-neutral-800 truncate">{evidenceItem.title || "Untitled Evidence"}</span>
                        <div className="flex flex-wrap gap-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            evidenceItem.importance === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                            evidenceItem.importance === 'strong' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                            'bg-neutral-100 border-neutral-200 text-neutral-500'
                          }`}>
                            {evidenceItem.importance?.toUpperCase()}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            evidenceItem.status === 'verified' ? 'bg-lime-50 border-lime-200 text-lime-700' :
                            evidenceItem.status === 'incomplete' ? 'bg-red-50 border-red-200 text-red-700' :
                            'bg-neutral-100 border-neutral-200 text-neutral-500'
                          }`}>
                            {evidenceItem.status?.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>
                          {evidenceItem.attachments?.[0]?.mimeType?.startsWith('image/') && 'Image'}
                          {evidenceItem.attachments?.[0]?.mimeType === 'application/pdf' && 'PDF'}
                          {evidenceItem.attachments?.[0] && !evidenceItem.attachments?.[0]?.mimeType?.startsWith('image/') && evidenceItem.attachments?.[0]?.mimeType !== 'application/pdf' && 'File'}
                          {!evidenceItem.attachments?.[0] && 'No Digital File'}
                        </span>
                        <div className="flex gap-2">
                          {evidenceItem.attachments?.[0] && onPreviewFile && (
                            <button
                              onClick={() => onPreviewFile(evidenceItem.attachments[0])}
                              className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
                            >
                              Preview
                            </button>
                          )}
                          {openEditRecordModal && (
                            <button
                              onClick={() => openEditRecordModal("evidence", evidenceItem)}
                              className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                            >
                              Open
                            </button>
                          )}
                          <button
                            onClick={() => onUnlinkEvidenceFromIncident(recordForm.id, evidenceItem.id)}
                            className="rounded-lg border border-red-300 bg-white px-2 py-1 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                          >
                            Unlink
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic">No evidence linked yet.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setIsLinking(true)} className="rounded-xl border border-lime-500 bg-white py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                Link Existing
              </button>
              <button onClick={() => onCreateEvidenceFromIncident(recordForm)} className="rounded-xl border border-lime-500 bg-white py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                + Create New
              </button>
            </div>
          </div>
          <div className="mb-4 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Linked Records</h3>
              <p className="mt-1 text-xs text-neutral-500">Connect this incident to full tracking records from the Records tab.</p>
            </div>

            {linkedTrackingRecords.length > 0 ? (
              <div className="space-y-2">
                {linkedTrackingRecords.map((record) => (
                  <div key={record.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold text-neutral-800">{record.title || "Untitled Record"}</span>
                          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                            {getTrackingRecordTypeLabel(record)}
                          </span>
                        </div>
                        {getTrackingRecordSummary(record) && (
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                            {getTrackingRecordSummary(record)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {openDocumentModal && (
                          <button
                            onClick={() => openDocumentModal(record, record.id, "record")}
                            className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                          >
                            Open
                          </button>
                        )}
                        <button
                          onClick={() => unlinkRecordFromIncidentForm(record.id)}
                          className="rounded-lg border border-red-300 bg-white px-2 py-1 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                        >
                          Unlink
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic">No records linked yet.</p>
            )}

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <select
                value={selectedLinkedRecordId}
                onChange={(e) => setSelectedLinkedRecordId(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white p-2 text-sm"
              >
                <option value="">Select record to link</option>
                {availableTrackingRecords.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.title || "Untitled Record"}
                  </option>
                ))}
              </select>
              <button
                onClick={linkSelectedRecordToIncident}
                disabled={!selectedLinkedRecordId}
                className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:shadow-none transition-colors"
              >
                Link Record
              </button>
            </div>
          </div>
          <div className="mb-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500 italic">
            Files are stored in Evidence items and linked to incidents.
          </div>
          </div>
        ) : (
          <>
            <label className="mb-3 block cursor-pointer rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
              Upload attachments (images, PDFs, documents)
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleRecordFiles}
                accept="image/*,application/pdf,.pdf,.doc,.docx,.txt,.eml,message/rfc822"
              />
            </label>

            {recordForm.attachments.length > 0 && (
              <div className="mb-4 space-y-2">
                {recordForm.attachments.map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                    <span className="truncate pr-3">{file.name}</span>
                    <button
                      onClick={() => removeRecordAttachment(file.id)}
                      className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-xs text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        </>
        )}
        </div>

        <div className="p-6 pt-4 border-t border-neutral-100 flex gap-2">
          {isLinking ? (
            <>
              <button onClick={handleConfirmLinks} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                Link Selected ({tempSelection.length})
              </button>
              <button onClick={() => setIsLinking(false)} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                Back
              </button>
            </>
          ) : (
            <>
              <button onClick={saveRecord} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                {isEdit ? "Save Changes" : "Create"}
              </button>
              <button onClick={closeRecordModal} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
