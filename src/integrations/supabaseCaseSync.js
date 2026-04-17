import { buildCaseReasoningExportPayload } from "../export/caseExport.js";

export const SUPABASE_SYNC_URL = "https://aftbtklrlkccngjiaacv.supabase.co/functions/v1/proveit-upsert-case";
export const SUPABASE_SYNC_API_KEY = "proveit-live-read-123456";
export const SUPABASE_FULL_CASE_EXPORT_URL = "https://aftbtklrlkccngjiaacv.supabase.co/functions/v1/export-full-case";
export const SUPABASE_FULL_CASE_EXPORT_KEY = "sb_publishable_jVKAQYEpeh1G5MY1yRvPJA_iYUUCPFy";

export async function syncCaseToSupabase(caseItem) {
  const reasoningPayload = buildCaseReasoningExportPayload(caseItem, "detailed");

  const payload = {
    id: caseItem.id,
    name: caseItem.name || "",
    type: caseItem.category || "general",
    status: caseItem.status || "open",
    priority: caseItem.priority || "medium",
    snapshot: reasoningPayload,
  };

  const response = await fetch(SUPABASE_SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": SUPABASE_SYNC_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const returnedData = await response.json();
  if (!response.ok) {
    throw new Error(`Sync to Supabase failed: ${response.status} ${response.statusText}`);
  }

  console.log("sync success", returnedData);
  return returnedData;
}

export async function exportReasoningCaseToSupabase(caseItem) {
  try {
    const reasoningPayload = buildCaseReasoningExportPayload(caseItem, "detailed");

    console.log("Reasoning export size", {
      original: JSON.stringify(caseItem).length,
      reasoning: JSON.stringify(reasoningPayload).length,
    });

    const response = await fetch(
      SUPABASE_FULL_CASE_EXPORT_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_FULL_CASE_EXPORT_KEY}`,
          "apikey": SUPABASE_FULL_CASE_EXPORT_KEY,
          "x-api-key": SUPABASE_SYNC_API_KEY,
        },
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

    console.log("full case export success", data);
    return data;

  } catch (err) {
    console.error("Full case export failed", err);
    throw err;
  }
}
