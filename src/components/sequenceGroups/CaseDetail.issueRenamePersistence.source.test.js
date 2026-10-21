import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");

function section(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `Missing ${start}`);
  assert.ok(endIndex >= 0, `Missing ${end}`);
  return source.slice(startIndex, endIndex);
}

test("all Issue rename entry points stage compatibility metadata for canonical persistence before writing local metadata", () => {
  const simpleRename = section("async function handleRenameSequenceGroup", "async function handleMergeSequenceGroup");
  const detailsRename = section("async function handleUpdateManagedSequenceGroup", "async function handleDeleteManagedSequenceGroup");
  const moveEntireGroup = section("async function handleManagedSequenceGroupOperation", "async function handleDownloadSplitReasoningPackage");

  for (const entryPoint of [simpleRename, detailsRename, moveEntireGroup]) {
    assert.match(entryPoint, /getRenamedSequenceGroupMeta/);
    assert.match(entryPoint, /onUpdateCase\(result\.caseData/);
    assert.match(entryPoint, /persistRenamedSequenceGroupMeta/);
    assert.ok(entryPoint.indexOf("onUpdateCase(result.caseData") < entryPoint.indexOf("persistRenamedSequenceGroupMeta"));
  }
});

test("failed canonical saves leave compatibility metadata untouched and successful metadata failures are warned", () => {
  assert.match(source, /if \(!\(await onUpdateCase\(result\.caseData, \{ sequenceGroupMeta: renamedMeta \}\)\)\) return setSequenceGroupFeedback\("Issue could not be renamed safely\."\);/);
  assert.match(source, /Legacy compatibility metadata was not changed\./);
  assert.match(source, /legacy compatibility metadata could not be updated/);
});

test("the canonical save normalizer accepts an in-memory compatibility metadata override", () => {
  assert.match(app, /const handleUpdateCase = async \(updatedCase, options = \{\}\) =>/);
  assert.match(app, /const sequenceGroupMeta = options\.sequenceGroupMeta \|\| getSequenceGroupMetaForCase/);
  assert.match(app, /normalizeCaseIssues\(updatedCase, \{\s*sequenceGroupMeta,/);
});
