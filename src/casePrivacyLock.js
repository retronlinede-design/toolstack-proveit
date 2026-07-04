import {
  APP_LOCK_ITERATIONS,
  generateAppLockSalt,
  hashAppPin,
} from "./appLock.js";

export const CASE_PRIVACY_LOCK_VERSION = "case-pin-pbkdf2-v1";
export const CASE_PIN_ITERATIONS = APP_LOCK_ITERATIONS;

export function sanitizeCasePinInput(value = "") {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

export function isValidCasePin(pin = "") {
  return /^\d{4,6}$/.test(String(pin || ""));
}

export function isLegacyPlaintextCasePrivacyLock(value) {
  return isValidCasePin(value?.pin);
}

export function isHashedCasePrivacyLock(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.version === CASE_PRIVACY_LOCK_VERSION &&
    typeof value.pinHash === "string" &&
    value.pinHash.length > 0 &&
    typeof value.salt === "string" &&
    value.salt.length > 0 &&
    Number.isFinite(value.iterations) &&
    value.iterations > 0
  );
}

export function isCasePrivacyLockEnabled(value) {
  return isHashedCasePrivacyLock(value) || isLegacyPlaintextCasePrivacyLock(value);
}

export function normalizeCasePrivacyLock(value) {
  if (isHashedCasePrivacyLock(value)) {
    return {
      version: CASE_PRIVACY_LOCK_VERSION,
      pinHash: value.pinHash,
      salt: value.salt,
      iterations: value.iterations,
      enabledAt: value.enabledAt || "",
      updatedAt: value.updatedAt || value.enabledAt || "",
    };
  }

  if (isLegacyPlaintextCasePrivacyLock(value)) {
    const pin = sanitizeCasePinInput(value.pin);
    return {
      pin,
      enabledAt: value.enabledAt || "",
      updatedAt: value.updatedAt || value.enabledAt || "",
    };
  }

  return null;
}

export async function createCasePrivacyLockConfig(pin, existingLock = null) {
  const normalizedPin = sanitizeCasePinInput(pin);
  if (!isValidCasePin(normalizedPin)) {
    throw new Error("PIN must be numeric and 4 to 6 digits.");
  }

  const salt = generateAppLockSalt();
  const now = new Date().toISOString();
  return {
    version: CASE_PRIVACY_LOCK_VERSION,
    pinHash: await hashAppPin(normalizedPin, salt, CASE_PIN_ITERATIONS),
    salt,
    iterations: CASE_PIN_ITERATIONS,
    enabledAt: existingLock?.enabledAt || now,
    updatedAt: now,
  };
}

export async function verifyCasePrivacyLock(pin, privacyLock) {
  const normalizedPin = sanitizeCasePinInput(pin);
  if (!isValidCasePin(normalizedPin)) return false;

  const normalizedLock = normalizeCasePrivacyLock(privacyLock);
  if (!normalizedLock) return false;

  if (isLegacyPlaintextCasePrivacyLock(normalizedLock)) {
    return normalizedLock.pin === normalizedPin;
  }

  const candidateHash = await hashAppPin(normalizedPin, normalizedLock.salt, normalizedLock.iterations);
  return candidateHash === normalizedLock.pinHash;
}

export async function migrateCasePrivacyLockAfterVerify(pin, privacyLock) {
  const verified = await verifyCasePrivacyLock(pin, privacyLock);
  if (!verified) return { verified: false, privacyLock: normalizeCasePrivacyLock(privacyLock), migrated: false };

  const normalizedLock = normalizeCasePrivacyLock(privacyLock);
  if (!isLegacyPlaintextCasePrivacyLock(normalizedLock)) {
    return { verified: true, privacyLock: normalizedLock, migrated: false };
  }

  return {
    verified: true,
    privacyLock: await createCasePrivacyLockConfig(pin, normalizedLock),
    migrated: true,
  };
}

export async function hashLegacyCasePrivacyLockForStorage(privacyLock) {
  const normalizedLock = normalizeCasePrivacyLock(privacyLock);
  if (!normalizedLock) return null;
  if (!isLegacyPlaintextCasePrivacyLock(normalizedLock)) return normalizedLock;
  return createCasePrivacyLockConfig(normalizedLock.pin, normalizedLock);
}

export function stripPlaintextCasePin(privacyLock) {
  const normalizedLock = normalizeCasePrivacyLock(privacyLock);
  if (!normalizedLock) return null;
  if (isLegacyPlaintextCasePrivacyLock(normalizedLock)) {
    return {
      legacyPlaintextPinRemoved: true,
      enabledAt: normalizedLock.enabledAt || "",
      updatedAt: normalizedLock.updatedAt || normalizedLock.enabledAt || "",
    };
  }
  return normalizedLock;
}
