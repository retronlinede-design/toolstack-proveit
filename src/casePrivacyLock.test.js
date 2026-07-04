import test from "node:test";
import assert from "node:assert/strict";

import {
  CASE_PRIVACY_LOCK_VERSION,
  createCasePrivacyLockConfig,
  isCasePrivacyLockEnabled,
  isLegacyPlaintextCasePrivacyLock,
  migrateCasePrivacyLockAfterVerify,
  normalizeCasePrivacyLock,
  stripPlaintextCasePin,
  verifyCasePrivacyLock,
} from "./casePrivacyLock.js";

test("createCasePrivacyLockConfig stores a hashed case PIN", async () => {
  const lock = await createCasePrivacyLockConfig("123456");

  assert.equal(lock.version, CASE_PRIVACY_LOCK_VERSION);
  assert.equal(lock.pin, undefined);
  assert.notEqual(lock.pinHash, "123456");
  assert.ok(lock.pinHash.length > 0);
  assert.ok(lock.salt.length > 0);
  assert.equal(await verifyCasePrivacyLock("123456", lock), true);
  assert.equal(await verifyCasePrivacyLock("654321", lock), false);
});

test("legacy plaintext case privacy locks still verify and migrate after success", async () => {
  const legacyLock = {
    pin: "2468",
    enabledAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
  };

  assert.equal(isCasePrivacyLockEnabled(legacyLock), true);
  assert.equal(isLegacyPlaintextCasePrivacyLock(normalizeCasePrivacyLock(legacyLock)), true);
  assert.equal(await verifyCasePrivacyLock("2468", legacyLock), true);
  assert.equal(await verifyCasePrivacyLock("1357", legacyLock), false);

  const migration = await migrateCasePrivacyLockAfterVerify("2468", legacyLock);
  assert.equal(migration.verified, true);
  assert.equal(migration.migrated, true);
  assert.equal(migration.privacyLock.pin, undefined);
  assert.equal(migration.privacyLock.version, CASE_PRIVACY_LOCK_VERSION);
  assert.equal(migration.privacyLock.enabledAt, legacyLock.enabledAt);
  assert.equal(await verifyCasePrivacyLock("2468", migration.privacyLock), true);
});

test("failed legacy unlock does not migrate or expose a new hash", async () => {
  const legacyLock = { pin: "2468", enabledAt: "2024-01-01T00:00:00.000Z" };
  const migration = await migrateCasePrivacyLockAfterVerify("0000", legacyLock);

  assert.equal(migration.verified, false);
  assert.equal(migration.migrated, false);
  assert.equal(migration.privacyLock.pin, "2468");
  assert.equal(migration.privacyLock.pinHash, undefined);
});

test("stripPlaintextCasePin removes legacy plaintext PINs from exports", async () => {
  const strippedLegacy = stripPlaintextCasePin({ pin: "1234", enabledAt: "2024-01-01T00:00:00.000Z" });
  assert.equal(strippedLegacy.pin, undefined);
  assert.equal(strippedLegacy.pinHash, undefined);
  assert.equal(strippedLegacy.legacyPlaintextPinRemoved, true);

  const hashed = await createCasePrivacyLockConfig("1234");
  const strippedHashed = stripPlaintextCasePin(hashed);
  assert.equal(strippedHashed.pin, undefined);
  assert.equal(strippedHashed.pinHash, hashed.pinHash);
});
