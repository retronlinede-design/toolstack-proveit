import { useCallback, useMemo, useRef, useState } from "react";
import DialogShell from "../shared/DialogShell.jsx";
import RecordActions from "../shared/RecordActions.jsx";
import SequenceGroupDetailsForm from "./SequenceGroupDetailsForm.jsx";
import SequenceGroupOperationSummary from "./SequenceGroupOperationSummary.jsx";
import SequenceGroupRecordManager from "./SequenceGroupRecordManager.jsx";
import { validateSequenceGroupInput } from "./sequenceGroupManagement.js";
import { getSequenceGroupDetailsDiscardRequest } from "./sequenceGroupDetailsDraft.js";

const SECTIONS = [["details", "Details"], ["records", "Records"], ["merge", "Move / Merge"], ["delete", "Delete"]];

export default function SequenceGroupManagementModal({ group, issue, parties = [], groups, description, status, timelineItems, initialSection = "details", onClose, onSaveDetails, onOpenRecord, onOperation }) {
  const [section, setSection] = useState(SECTIONS.some(([key]) => key === initialSection) ? initialSection : "details");
  const [destination, setDestination] = useState("");
  const [descriptionMode, setDescriptionMode] = useState("keep");
  const [combinedDescription, setCombinedDescription] = useState("");
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const detailsNameInputRef = useRef(null);
  const otherGroups = groups.filter((item) => item.name !== group.name);
  const destinationGroup = otherGroups.find((item) => item.name === destination);
  const summary = useMemo(() => {
    const dated = timelineItems.map((item) => item.date).filter(Boolean).sort();
    return { total: group.totalCount, missingDates: timelineItems.filter((item) => !item.date).length, dateRange: dated.length ? (dated[0] === dated.at(-1) ? dated[0] : `${dated[0]}–${dated.at(-1)}`) : "No dated records", status, counts: { Incidents: group.counts.incidents || 0, Evidence: group.counts.evidence || 0, Documents: group.counts.documents || 0, Strategy: group.counts.strategy || 0, "To Watch": group.counts.watchItems || 0 } };
  }, [group, status, timelineItems]);
  const updateDetailsDirty = useCallback((isDirty) => setDetailsDirty(Boolean(isDirty)), []);
  const applyPendingRequest = () => {
    const request = pendingRequest;
    setPendingRequest(null);
    setDetailsDirty(false);
    if (request?.type === "close") onClose();
    if (request?.type === "section") setSection(request.section);
  };
  const requestClose = () => {
    const request = getSequenceGroupDetailsDiscardRequest({ detailsDirty, currentSection: section, closing: true });
    if (request) { setPendingRequest(request); return; }
    onClose();
  };
  const requestSection = (nextSection) => {
    if (nextSection === section) return;
    const request = getSequenceGroupDetailsDiscardRequest({ detailsDirty, currentSection: section, nextSection });
    if (request) { setPendingRequest(request); return; }
    setSection(nextSection);
  };
  const merge = async () => {
    if (!destinationGroup) return setError("Choose a destination group.");
    if (await onOperation({ type: "merge-groups", sourceGroup: group.name, destinationGroup: destination, descriptionMode, combinedDescription })) setSection("details");
  };
  const renameEntire = async () => {
    const validation = validateSequenceGroupInput(newGroup, groups.map((item) => item.name), group.name);
    if (validation.error) return setError(validation.error);
    if (validation.value.name === group.name) return setError("Enter a new group name.");
    if (await onOperation({ type: "rename-entire-group", sourceGroup: group.name, destinationGroup: validation.value.name, destinationDescription: validation.value.description })) setSection("details");
  };
  const footer = pendingRequest ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <p className="text-sm text-amber-100">Discard unsaved Issue Details changes?</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPendingRequest(null)} className="proveit-record-secondary-action">Keep editing</button>
        <button type="button" onClick={applyPendingRequest} className="proveit-record-danger-action">Discard changes</button>
      </div>
    </div>
  ) : section === "details" ? (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={requestClose} className="proveit-record-secondary-action">Close</button>
      <button type="submit" form="sequence-group-details-form" className="proveit-record-primary-action">Save Details</button>
    </div>
  ) : null;

  return <DialogShell
    title="Manage Issue"
    description={`${issue?.reference ? `${issue.reference} — ` : ""}${group.name} · ${group.totalCount} records`}
    width="workspace"
    layer="nested"
    onRequestClose={requestClose}
    dismissOnBackdrop={false}
    initialFocusRef={section === "details" ? detailsNameInputRef : null}
    footer={footer}
    className="proveit-issue-management-dialog"
  >
    <div className="proveit-issue-management-tabs border-b pb-2" role="tablist" aria-label="Issue management sections">
      <div className="flex gap-1 overflow-x-auto">{SECTIONS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => requestSection(key)} className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold ${section === key ? "is-active" : ""}`}>{label}</button>)}</div>
    </div>
    <div className="pt-4" role="tabpanel">
      {section === "details" && <SequenceGroupDetailsForm key={`${group.name}:${issue?.updatedAt || "new"}`} group={group} issue={issue} parties={parties} description={description} existingNames={groups.map((item) => item.name)} summary={summary} onSave={onSaveDetails} onDirtyChange={updateDetailsDirty} initialFocusRef={detailsNameInputRef} />}
      {section === "records" && <SequenceGroupRecordManager group={group} groups={groups} onOpenRecord={onOpenRecord} onOperation={onOperation} />}
      {section === "merge" && <div className="space-y-6">
        <section className="space-y-3"><h4 className="font-semibold">Merge Entire Group into Existing Group</h4><p className="text-sm text-neutral-600 dark:text-neutral-300">All source records will adopt the destination label. Records, links, attachments, dates, and ordering remain intact; source metadata is removed after a successful save.</p><select aria-label="Existing merge destination" value={destination} onChange={(e) => { setDestination(e.target.value); setError(""); }} className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800"><option value="">Choose destination group</option>{otherGroups.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.totalCount} records · {item.description || "No description"}</option>)}</select>{destinationGroup && <SequenceGroupOperationSummary operation="Merge entire group" source={group.name} destination={destinationGroup.name} affected={group.totalCount} remaining={0} resulting={group.totalCount + destinationGroup.totalCount} />}
          <fieldset className="space-y-2"><legend className="text-sm font-semibold">Description handling</legend>{[["keep", "Keep destination description"], ["replace", "Replace with source description"], ["append", "Append source description to destination"], ["edit", "Edit combined description before merging"]].map(([value, label]) => <label key={value} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="description-mode" value={value} checked={descriptionMode === value} onChange={(e) => setDescriptionMode(e.target.value)} />{label}</label>)}</fieldset>{descriptionMode === "edit" && <textarea aria-label="Combined description" rows={5} value={combinedDescription} onChange={(e) => setCombinedDescription(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-600 dark:bg-neutral-800" />}
          <RecordActions actions={[{ key: "merge", label: "Merge Entire Group", variant: "danger", onClick: merge, disabled: !destination }]} />
        </section>
        <section className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-700"><h4 className="font-semibold">Move Entire Group into New Group</h4><p className="text-sm text-neutral-600 dark:text-neutral-300">All records will be moved to the new group name. The current group will no longer exist.</p><input aria-label="New group name" value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} placeholder="New group name" className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800" /><textarea aria-label="New group description" rows={4} value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} placeholder="New description" className="w-full rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-600 dark:bg-neutral-800" /><SequenceGroupOperationSummary operation="Move entire group to a new label" source={group.name} destination={newGroup.name || "New group"} affected={group.totalCount} remaining={0} resulting={group.totalCount} /><RecordActions actions={[{ key: "rename", label: "Move Entire Group", variant: "primary", onClick: renameEntire }]} /></section>
        {error && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}
      </div>}
      {section === "delete" && <div className="space-y-4"><h4 className="text-lg font-semibold">Delete Group</h4><p className="text-sm text-neutral-600 dark:text-neutral-300">{group.totalCount ? `Consider moving or merging these ${group.totalCount} records first. ` : "This group is empty. "}Deleting the group never deletes its records. Assigned records become ungrouped and the description metadata is removed.</p><SequenceGroupOperationSummary operation="Delete group and clear assignments" source={group.name} affected={group.totalCount} remaining={0} /><RecordActions actions={[{ key: "delete", label: `Delete “${group.name}”`, variant: "danger", onClick: async () => { if (await onOperation({ type: "delete-group", sourceGroup: group.name })) onClose(); } }]} /></div>}
    </div>
  </DialogShell>;
}
