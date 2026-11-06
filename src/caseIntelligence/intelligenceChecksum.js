export const INTELLIGENCE_CHECKSUM_FORMAT = "sha256-intelligence-content-v1";

const FORBIDDEN_KEYS = new Set([
  "__proto__", "prototype", "constructor", "blob", "file", "dataurl", "backupdataurl",
  "base64", "binary", "buffer", "bytes", "arraybuffer", "stream",
  "apikey", "api_key", "authorization", "token", "password", "credential", "secret",
]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function inspect(value, path, errors, seen = new WeakSet()) {
  if (typeof value === "string") {
    if (/^data:/i.test(value.trim())) errors.push(`${path} contains a data URL.`);
    return;
  }
  if (value == null || ["boolean", "number"].includes(typeof value)) {
    if (typeof value === "number" && !Number.isFinite(value)) errors.push(`${path} contains a non-finite number.`);
    return;
  }
  if (["undefined", "function", "symbol", "bigint"].includes(typeof value)) {
    errors.push(`${path} contains an unsupported value.`);
    return;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) { errors.push(`${path} contains a circular reference.`); return; }
    seen.add(value);
    value.forEach((item, index) => inspect(item, `${path}[${index}]`, errors, seen));
    seen.delete(value);
    return;
  }
  if (!isPlainObject(value)) { errors.push(`${path} contains a non-plain object.`); return; }
  if (seen.has(value)) { errors.push(`${path} contains a circular reference.`); return; }
  seen.add(value);
  for (const name of Object.getOwnPropertyNames(value)) {
    if (FORBIDDEN_KEYS.has(name.toLowerCase())) errors.push(`${path}.${name} is a forbidden field.`);
    inspect(value[name], `${path}.${name}`, errors, seen);
  }
  seen.delete(value);
}

function canonicalise(value) {
  if (value == null || ["string", "boolean", "number"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map(canonicalise);
  return Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonicalise(value[name])]));
}

export function validateIntelligenceSerializable(value, { path = "value" } = {}) {
  const errors = [];
  inspect(value, path, errors);
  return { valid: errors.length === 0, errors };
}

export function canonicalSerialiseIntelligenceValue(value) {
  const validation = validateIntelligenceSerializable(value);
  if (!validation.valid) throw new TypeError(`Cannot canonicalise intelligence content: ${validation.errors.join(" ")}`);
  return JSON.stringify(canonicalise(value));
}

export function isIntelligenceChecksum(value) {
  return typeof value === "string" && new RegExp(`^${INTELLIGENCE_CHECKSUM_FORMAT}:\\p{ASCII_Hex_Digit}{64}$`, "u").test(value);
}

export async function calculateIntelligenceChecksum(payload) {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable.");
  const bytes = new TextEncoder().encode(canonicalSerialiseIntelligenceValue(payload));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hexadecimal = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${INTELLIGENCE_CHECKSUM_FORMAT}:${hexadecimal}`;
}

export async function verifyIntelligenceChecksum(payload, checksum) {
  if (!isIntelligenceChecksum(checksum)) return { valid: false, errors: [`Checksum must use ${INTELLIGENCE_CHECKSUM_FORMAT}.`] };
  try {
    const expected = await calculateIntelligenceChecksum(payload);
    return expected === checksum ? { valid: true, errors: [] } : { valid: false, errors: ["Intelligence content checksum does not match immutable content."] };
  } catch (error) {
    return { valid: false, errors: [error?.message || "Could not verify intelligence checksum."] };
  }
}
