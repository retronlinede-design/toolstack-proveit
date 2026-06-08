import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowFloatingWorkspaceMenu } from "./workspaceMenuVisibility.js";

const selectedCase = {
  id: "case_pin_001",
  name: "PIN case",
  privacyLock: {
    enabled: true,
  },
};

test("hides floating workspace menu while PIN case is currently locked", () => {
  assert.equal(
    shouldShowFloatingWorkspaceMenu({
      selectedCase,
      isCaseCurrentlyLocked: true,
    }),
    false
  );
});

test("shows floating workspace menu for unlocked PIN-protected case", () => {
  assert.equal(
    shouldShowFloatingWorkspaceMenu({
      selectedCase,
      isCaseCurrentlyLocked: false,
    }),
    true
  );
});

test("keeps existing modal hide conditions for floating workspace menu", () => {
  assert.equal(
    shouldShowFloatingWorkspaceMenu({
      selectedCase,
      isCaseCurrentlyLocked: false,
      incidentDateRepairOpen: true,
    }),
    false
  );
  assert.equal(
    shouldShowFloatingWorkspaceMenu({
      selectedCase,
      isCaseCurrentlyLocked: false,
      aiToolsOpen: true,
    }),
    false
  );
});
