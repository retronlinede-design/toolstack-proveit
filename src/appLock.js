export const APP_LOCK_STORAGE_KEY = "toolstack.proveit.v1.appLock";
export const APP_LOCK_ITERATIONS = 100000;
export const APP_LOCK_AUTO_LOCK_OPTIONS = [null, 15, 30, 60];

function getWebCrypto() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("Web Crypto is unavailable.");
  }
  return cryptoApi;
}

export function sanitizeAppPinInput(value = "") {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

export function isValidAppPin(pin = "") {
  return /^\d{4,8}$/.test(String(pin || ""));
}

export function normalizeAppAutoLockMinutes(value) {
  if (value === null || typeof value === "undefined") return null;
  const numericValue = Number(value);
  return APP_LOCK_AUTO_LOCK_OPTIONS.includes(numericValue) ? numericValue : null;
}

export function bytesToBase64(bytes) {
  if (typeof btoa === "function") {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  const bufferConstructor = globalThis.Buffer;
  if (bufferConstructor?.from) return bufferConstructor.from(bytes).toString("base64");
  throw new Error("Base64 encoding is unavailable.");
}

export function base64ToBytes(value = "") {
  if (typeof atob === "function") {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  const bufferConstructor = globalThis.Buffer;
  if (bufferConstructor?.from) return Uint8Array.from(bufferConstructor.from(value, "base64"));
  throw new Error("Base64 decoding is unavailable.");
}

export function generateAppLockSalt(byteLength = 16) {
  const salt = new Uint8Array(byteLength);
  getWebCrypto().getRandomValues(salt);
  return bytesToBase64(salt);
}

export async function hashAppPin(pin, salt, iterations = APP_LOCK_ITERATIONS) {
  const normalizedPin = sanitizeAppPinInput(pin);
  if (!isValidAppPin(normalizedPin)) {
    throw new Error("PIN must be numeric and 4 to 8 digits.");
  }
  if (!salt || typeof salt !== "string") {
    throw new Error("PIN salt is required.");
  }
  if (!Number.isFinite(iterations) || iterations <= 0) {
    throw new Error("PIN hash iterations must be positive.");
  }

  const cryptoApi = getWebCrypto();
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalizedPin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await cryptoApi.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(salt),
      iterations,
    },
    keyMaterial,
    256
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

export function isValidStoredAppLockConfig(config) {
  if (!config || typeof config !== "object") return false;
  if (typeof config.enabled !== "boolean") return false;
  if (typeof config.pinHash !== "string") return false;
  if (typeof config.salt !== "string") return false;
  if (!Number.isFinite(config.iterations) || config.iterations <= 0) return false;
  if (typeof config.createdAt !== "string" || !config.createdAt) return false;
  if (typeof config.updatedAt !== "string" || !config.updatedAt) return false;
  if (normalizeAppAutoLockMinutes(config.autoLockMinutes) !== (config.autoLockMinutes ?? null)) return false;
  if (config.enabled === false) return true;
  return config.pinHash.length > 0 && config.salt.length > 0;
}

export function normalizeStoredAppLockConfig(config) {
  if (!config || typeof config !== "object") return config;
  return {
    ...config,
    autoLockMinutes: normalizeAppAutoLockMinutes(config.autoLockMinutes),
  };
}

export async function createAppLockConfig(pin, existingConfig = null) {
  const salt = generateAppLockSalt();
  const now = new Date().toISOString();
  return {
    enabled: true,
    pinHash: await hashAppPin(pin, salt, APP_LOCK_ITERATIONS),
    salt,
    iterations: APP_LOCK_ITERATIONS,
    autoLockMinutes: normalizeAppAutoLockMinutes(existingConfig?.autoLockMinutes),
    createdAt: existingConfig?.createdAt || now,
    updatedAt: now,
  };
}

export function createDisabledAppLockConfig(existingConfig = null) {
  const now = new Date().toISOString();
  return {
    enabled: false,
    pinHash: "",
    salt: "",
    iterations: APP_LOCK_ITERATIONS,
    autoLockMinutes: normalizeAppAutoLockMinutes(existingConfig?.autoLockMinutes),
    createdAt: existingConfig?.createdAt || now,
    updatedAt: now,
  };
}

export async function verifyAppPin(pin, config) {
  if (!isValidStoredAppLockConfig(config) || config.enabled !== true) return false;
  const normalizedPin = sanitizeAppPinInput(pin);
  if (!isValidAppPin(normalizedPin)) return false;
  const candidateHash = await hashAppPin(normalizedPin, config.salt, config.iterations);
  return candidateHash === config.pinHash;
}

export function readAppLockConfig() {
  try {
    const saved = localStorage.getItem(APP_LOCK_STORAGE_KEY);
    if (!saved) {
      return { enabled: false, corrupt: false, config: createDisabledAppLockConfig() };
    }
    const parsed = JSON.parse(saved);
    const normalized = normalizeStoredAppLockConfig(parsed);
    if (!isValidStoredAppLockConfig(normalized)) {
      return { enabled: false, corrupt: true, config: null };
    }
    return { enabled: normalized.enabled === true, corrupt: false, config: normalized };
  } catch {
    return { enabled: false, corrupt: true, config: null };
  }
}

export function writeAppLockConfig(config) {
  if (!isValidStoredAppLockConfig(config)) {
    throw new Error("Invalid app lock config.");
  }
  localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(config));
  return config;
}
