import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_LOCK_ITERATIONS,
  APP_LOCK_STORAGE_KEY,
  createAppLockConfig,
  createDisabledAppLockConfig,
  hashAppPin,
  isValidAppPin,
  readAppLockConfig,
  sanitizeAppPinInput,
  verifyAppPin,
  writeAppLockConfig,
} from "./appLock.js";

async function withFakeLocalStorage(callback) {
  const originalLocalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };

  try {
    return await callback(values);
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
}

test("sanitizeAppPinInput and isValidAppPin enforce 4 to 8 digits", () => {
  assert.equal(sanitizeAppPinInput("12a34b56789"), "12345678");
  assert.equal(isValidAppPin("123"), false);
  assert.equal(isValidAppPin("1234"), true);
  assert.equal(isValidAppPin("12345678"), true);
  assert.equal(isValidAppPin("123456789"), false);
  assert.equal(isValidAppPin("1234a"), false);
});

test("createAppLockConfig stores a PBKDF2 hash instead of plaintext PIN", async () => {
  const config = await createAppLockConfig("123456");

  assert.equal(config.enabled, true);
  assert.equal(config.iterations, APP_LOCK_ITERATIONS);
  assert.notEqual(config.pinHash, "123456");
  assert.ok(config.pinHash.length > 0);
  assert.ok(config.salt.length > 0);
  assert.equal(await verifyAppPin("123456", config), true);
  assert.equal(await verifyAppPin("654321", config), false);
});

test("hashAppPin is deterministic for the same salt and iteration count", async () => {
  const config = await createAppLockConfig("9876");
  const firstHash = await hashAppPin("9876", config.salt, config.iterations);
  const secondHash = await hashAppPin("9876", config.salt, config.iterations);

  assert.equal(firstHash, secondHash);
  assert.equal(firstHash, config.pinHash);
});

test("readAppLockConfig reads valid stored config and flags malformed config", async () => {
  await withFakeLocalStorage(async (values) => {
    const config = await createAppLockConfig("2468");
    writeAppLockConfig(config);

    const stored = JSON.parse(values.get(APP_LOCK_STORAGE_KEY));
    assert.equal(stored.enabled, true);
    assert.equal(stored.pinHash, config.pinHash);

    const readConfig = readAppLockConfig();
    assert.equal(readConfig.enabled, true);
    assert.equal(readConfig.corrupt, false);
    assert.equal(readConfig.config.pinHash, config.pinHash);

    values.set(APP_LOCK_STORAGE_KEY, "{bad json");
    const corrupt = readAppLockConfig();
    assert.equal(corrupt.enabled, false);
    assert.equal(corrupt.corrupt, true);
  });
});

test("disabled app lock config keeps the expected storage shape", async () => {
  await withFakeLocalStorage((values) => {
    const config = createDisabledAppLockConfig();
    writeAppLockConfig(config);

    const stored = JSON.parse(values.get(APP_LOCK_STORAGE_KEY));
    assert.deepEqual(Object.keys(stored).sort(), [
      "createdAt",
      "enabled",
      "iterations",
      "pinHash",
      "salt",
      "updatedAt",
    ]);
    assert.equal(stored.enabled, false);
    assert.equal(readAppLockConfig().enabled, false);
    assert.equal(readAppLockConfig().corrupt, false);
  });
});
