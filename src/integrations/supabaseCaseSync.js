import { buildCaseReasoningExportPayload } from "../export/caseExport.js";

export const REMOTE_SYNC_NOT_CONFIGURED_ERROR = "Remote sync is not configured.";

function getSupabaseRemoteConfig(config = {}) {
  const env = config.env || import.meta.env || {};
  return {
    functionUrl: config.functionUrl || env.VITE_SUPABASE_FUNCTION_URL || "",
    anonKey: config.anonKey || env.VITE_SUPABASE_ANON_KEY || "",
  };
}

function getConfiguredRemote(config) {
  const remoteConfig = getSupabaseRemoteConfig(config);
  if (!remoteConfig.functionUrl || !remoteConfig.anonKey) {
    throw new Error(REMOTE_SYNC_NOT_CONFIGURED_ERROR);
  }
  return remoteConfig;
}

function getRemoteHeaders(anonKey) {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${anonKey}`,
    "apikey": anonKey,
  };
}

export async function sendReasoningSnapshotToSupabase(caseItem, config) {
  const { functionUrl, anonKey } = getConfiguredRemote(config);
  const reasoningPayload = buildCaseReasoningExportPayload(caseItem, "detailed");

  const payload = {
    id: caseItem.id,
    name: caseItem.name || "",
    type: caseItem.category || "general",
    status: caseItem.status || "open",
    priority: caseItem.priority || "medium",
    snapshot: reasoningPayload,
  };

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: getRemoteHeaders(anonKey),
    body: JSON.stringify(payload),
  });

  const returnedData = await response.json();
  if (!response.ok) {
    throw new Error(`Sync to Supabase failed: ${response.status} ${response.statusText}`);
  }

  return returnedData;
}

export async function exportReasoningCaseToSupabase(caseItem, config) {
  try {
    const { functionUrl, anonKey } = getConfiguredRemote(config);
    const reasoningPayload = buildCaseReasoningExportPayload(caseItem, "detailed");

    const response = await fetch(
      functionUrl,
      {
        method: "POST",
        headers: getRemoteHeaders(anonKey),
        body: JSON.stringify({
          case_id: caseItem.id,
          exported_at: new Date().toISOString(),
          case_json: reasoningPayload,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Full case export failed: ${response.status}`);
    }

    return data;

  } catch (err) {
    console.error("Full case export failed", err);
    throw err;
  }
}
