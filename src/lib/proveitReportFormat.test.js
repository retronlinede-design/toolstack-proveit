import test from "node:test";
import assert from "node:assert/strict";
import { parseProveItReportV1 } from "./proveitReportFormat.js";

test("parseProveItReportV1 parses top sections and repeated issue blocks", () => {
  const parsed = parseProveItReportV1(`
# REPORT_TITLE
Client Report

# AT_A_GLANCE
- Main problem remains unresolved
- Duration: 3 weeks
- Status: ongoing

# YOUR_SITUATION
First sentence.
Second sentence.

# MAIN_AREAS_OF_CONCERN
- Fatigue and rest
- Medical impact

# WHAT_THIS_REPORT_SHOWS
- The work pattern did not allow enough rest.
- The condition was identified formally.

# MILESTONE_TIMELINE
- 2024-01-10 - Workload increased: duties became more frequent.
- 2024-01-14 - Medical review

# ISSUE
Rest between duties

## WHAT_HAPPENED
Several duties were scheduled close together.

## KEY_PROOF
- Duty roster confirms the timing.
- Messages confirm the instruction.

## WHAT_THIS_MEANS
- The pattern did not allow enough rest.

# ISSUE
Medical impact

## WHAT_HAPPENED
Symptoms were reported after the workload increased.

## KEY_PROOF
- Medical note confirms the condition.

## WHAT_THIS_MEANS
- The impact on health was identified formally.

# KEY_FACTS
- 2 main issues

# RECOMMENDED_NEXT_STEPS
- Keep written instructions.
`);

  assert.equal(parsed.reportTitle, "Client Report");
  assert.deepEqual(parsed.atAGlance, [
    "Main problem remains unresolved",
    "Duration: 3 weeks",
    "Status: ongoing",
  ]);
  assert.equal(parsed.yourSituation, "First sentence. Second sentence.");
  assert.deepEqual(parsed.mainAreasOfConcern, ["Fatigue and rest", "Medical impact"]);
  assert.deepEqual(parsed.milestoneTimeline, [
    "2024-01-10 - Workload increased: duties became more frequent.",
    "2024-01-14 - Medical review",
  ]);
  assert.equal(parsed.issues.length, 2);
  assert.equal(parsed.issues[0].title, "Rest between duties");
  assert.equal(parsed.issues[1].whatHappened, "Symptoms were reported after the workload increased.");
  assert.deepEqual(parsed.keyFacts, ["2 main issues"]);
  assert.deepEqual(parsed.recommendedNextSteps, ["Keep written instructions."]);
});

test("parseProveItReportV1 ignores unknown sections and renders partial known data", () => {
  const parsed = parseProveItReportV1(`
# REPORT_TITLE
Client Report

# UNKNOWN
Ignore this

# ISSUE
Heating problem

## WHAT_HAPPENED
The heating stopped repeatedly.

# KEY_FACTS
- Ongoing issue
`);

  assert.equal(parsed.reportTitle, "Client Report");
  assert.equal(parsed.issues.length, 1);
  assert.equal(parsed.issues[0].title, "Heating problem");
  assert.equal(parsed.issues[0].whatHappened, "The heating stopped repeatedly.");
  assert.deepEqual(parsed.keyFacts, ["Ongoing issue"]);
  assert.deepEqual(parsed.mainAreasOfConcern, []);
});

test("parseProveItReportV1 tolerates flexible headings and fallback list lines", () => {
  const parsed = parseProveItReportV1(`
Noise before the report should be ignored.

AT A GLANCE
* Main issue still active
Issue duration: 3 weeks

## Your Situation
The main problem has continued for several weeks.

Main Areas of Concern
* Lack of rest
• Medical impact

What This Report Shows
The work pattern remained unsafe.
The condition was confirmed formally.

Milestone Timeline
* 2024-02-01 - First complaint sent
• 2024-02-05 - Inspection carried out

Issue
Back-to-back duties

What Happened
Several duties were placed too close together.

Key Proof
Roster timings show the pattern.
Messages confirm the instruction.

What This Means
The work pattern did not allow enough rest.

Key Facts
Issue duration: 3 weeks

Next Steps
Request written instructions.
`);

  assert.deepEqual(parsed.atAGlance, [
    "Main issue still active",
    "Issue duration: 3 weeks",
  ]);
  assert.equal(parsed.yourSituation, "The main problem has continued for several weeks.");
  assert.deepEqual(parsed.mainAreasOfConcern, ["Lack of rest", "Medical impact"]);
  assert.deepEqual(parsed.whatThisReportShows, [
    "The work pattern remained unsafe.",
    "The condition was confirmed formally.",
  ]);
  assert.deepEqual(parsed.milestoneTimeline, [
    "2024-02-01 - First complaint sent",
    "2024-02-05 - Inspection carried out",
  ]);
  assert.equal(parsed.issues.length, 1);
  assert.equal(parsed.issues[0].title, "Back-to-back duties");
  assert.deepEqual(parsed.issues[0].keyProof, [
    "Roster timings show the pattern.",
    "Messages confirm the instruction.",
  ]);
  assert.deepEqual(parsed.recommendedNextSteps, ["Request written instructions."]);
});
