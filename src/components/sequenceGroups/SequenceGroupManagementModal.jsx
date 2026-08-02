import { useEffect, useMemo, useRef, useState } from "react";
import RecordActions from "../shared/RecordActions.jsx";
import SequenceGroupDetailsForm from "./SequenceGroupDetailsForm.jsx";
import SequenceGroupOperationSummary from "./SequenceGroupOperationSummary.jsx";
import SequenceGroupRecordManager from "./SequenceGroupRecordManager.jsx";
import { validateSequenceGroupInput } from "./sequenceGroupManagement.js";

const SECTIONS = [["details", "Details"], ["records", "Records"], ["merge", "Move / Merge"], ["delete", "Delete"]];

export default function SequenceGroupManagementModal({ group, issue, parties = [], groups, description, status, timelineItems, initialSection = "details", onClose, onSaveDetails, onOpenRecord, onOperation }) {
  const dialogRef = useRef(null);
  const [section, setSection] = useState(SECTIONS.some(([key]) => key === initialSection) ? initialSection : "details");
  const [destination, setDestination] = useState("");
  const [descriptionMode, setDescriptionMode] = useState("keep");
  const [combinedDescription, setCombinedDescription] = useState("");
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const otherGroups = groups.filter((item) => item.name !== group.name);
  const destinationGroup = otherGroups.find((item) => item.name === destination);
  const summary = useMemo(() => {
    const dated = timelineItems.map((item) => item.date).filter(Boolean).sort();
    return { total: group.totalCount, missingDates: timelineItems.filter((item) => !item.date).length, dateRange: dated.length ? (dated[0] === dated.at(-1) ? dated[0] : `${dated[0]}–${dated.at(-1)}`) : "No dated records", status, counts: { Incidents: group.counts.incidents || 0, Evidence: group.counts.evidence || 0, Documents: group.counts.documents || 0, Strategy: group.counts.strategy || 0, "To Watch": group.counts.watchItems || 0 } };
  }, [group, status, timelineItems]);
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

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector("button, input, select, textarea")?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); previousFocus?.focus?.(); };
  }, [onClose]);

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="manage-sequence-group-title">
    <div ref={dialogRef} className="flex max-h-[calc(100vh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900 sm:max-h-[calc(100vh-2rem)]">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 p-4 dark:border-neutral-700"><div><h3 id="manage-sequence-group-title" className="text-lg font-semibold">Manage Issue</h3><p className="mt-1 break-words text-sm text-neutral-500 dark:text-neutral-400">{issue?.reference ? `${issue.reference} — ` : ""}{group.name} · {group.totalCount} records</p></div><RecordActions actions={[{ key: "close", label: "Close", onClick: onClose }]} /></header>
      <div className="border-b border-neutral-200 p-2 dark:border-neutral-700" role="tablist" aria-label="Sequence group management sections"><div className="flex gap-1 overflow-x-auto">{SECTIONS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => setSection(key)} className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a263a] ${section === key ? "bg-[#7a263a] text-white dark:bg-[#a94b63]" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}>{label}</button>)}</div></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" role="tabpanel">
        {section === "details" && <SequenceGroupDetailsForm key={group.name} group={group} issue={issue} parties={parties} description={description} existingNames={groups.map((item) => item.name)} summary={summary} onSave={onSaveDetails} />}
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
    </div>
  </div>;
}
