import EvidenceRecordCard from "./EvidenceRecordCard.jsx";
import IncidentRecordCard from "./IncidentRecordCard.jsx";
import StrategyRecordCard from "./StrategyRecordCard.jsx";

export default function RecordCard({
  item,
  recordType,
  selectedCase,
  imageCache,
  onPreviewFile,
  openEditRecordModal,
  onConvertRecord,
  deleteRecord,
  openLinkedRecord,
  showTypeBadge = false,
  isTimeline = false,
  isMilestone = false,
  isActionItem = false,
}) {
  const sharedProps = { item, selectedCase, imageCache, onPreviewFile, openEditRecordModal, onConvertRecord, deleteRecord, openLinkedRecord };

  if (recordType === "strategy") return <StrategyRecordCard {...sharedProps} />;
  if (recordType === "incidents") return <IncidentRecordCard {...sharedProps} showTypeBadge={showTypeBadge} isTimeline={isTimeline} isMilestone={isMilestone} isActionItem={isActionItem} />;
  if (recordType === "evidence") return <EvidenceRecordCard {...sharedProps} showTypeBadge={showTypeBadge} isMilestone={isMilestone} isActionItem={isActionItem} />;
  return null;
}
