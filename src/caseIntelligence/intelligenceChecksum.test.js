import assert from "node:assert/strict";
import test from "node:test";
import {
  INTELLIGENCE_CHECKSUM_FORMAT,
  calculateIntelligenceChecksum,
  canonicalSerialiseIntelligenceValue,
  validateIntelligenceSerializable,
  verifyIntelligenceChecksum,
} from "./intelligenceChecksum.js";

test("canonical intelligence serialisation is deterministic and preserves array ordering", async () => {
  const first = { z: 1, a: { second: ["one", "two"], first: true } };
  const reordered = { a: { first: true, second: ["one", "two"] }, z: 1 };
  assert.equal(canonicalSerialiseIntelligenceValue(first), canonicalSerialiseIntelligenceValue(reordered));
  assert.notEqual(canonicalSerialiseIntelligenceValue({ list: ["one", "two"] }), canonicalSerialiseIntelligenceValue({ list: ["two", "one"] }));
  const checksum = await calculateIntelligenceChecksum(first);
  assert.match(checksum, new RegExp(`^${INTELLIGENCE_CHECKSUM_FORMAT}:`));
  assert.deepEqual(await verifyIntelligenceChecksum(reordered, checksum), { valid: true, errors: [] });
  assert.equal((await verifyIntelligenceChecksum({ ...first, z: 2 }, checksum)).valid, false);
});

test("canonical intelligence values reject executable, binary, data URL, and prototype-pollution payloads", () => {
  for (const value of [
    { attachment: { dataUrl: "data:text/plain;base64,secret" } },
    { provider: { apiKey: "must-not-be-persisted" } },
    { bytes: [1, 2] },
    { fn() {} },
    JSON.parse('{"__proto__":{"polluted":true}}'),
  ]) {
    assert.equal(validateIntelligenceSerializable(value).valid, false);
    assert.throws(() => canonicalSerialiseIntelligenceValue(value));
  }
});
