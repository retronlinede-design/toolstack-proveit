const OUTPUTS = ["preview", "print", "markdown", "json"];

export function auditReportCapabilities({ definitions = {}, centreConfig = [], runtimeDocuments = {}, renderedActions = {}, previewRenderers = {}, runtimeFormatters = null } = {}) {
  const errors = [];
  const warnings = [];
  const reports = (Array.isArray(centreConfig) ? centreConfig : []).map((entry) => {
    const id = entry?.value || entry?.id || "";
    const definition = definitions[id];
    const rendered = renderedActions[id] || [];
    if (!definition) errors.push(`${id || "Unknown report"} is visible without a report definition.`);
    if (definition?.status === "planned") errors.push(`${id} is planned but visible in the active Report Centre.`);
    if (definition?.status === "active" && !previewRenderers[id]) errors.push(`${id} is active but has no preview renderer.`);
    for (const scope of entry?.supportedScopes || []) {
      if (!definition?.supportedScopes?.includes(scope)) errors.push(`${id} renders unsupported scope ${scope}.`);
    }
    for (const output of rendered) {
      if (!definition?.supportedOutputs?.includes(output)) errors.push(`${id} renders unsupported output ${output}.`);
    }
    for (const output of definition?.supportedOutputs || []) {
      if (output === "preview" || output === "print") continue;
      if (!rendered.includes(output)) warnings.push(`${id} declares ${output} but no matching UI action is rendered.`);
      if (["markdown", "json"].includes(output) && !runtimeDocuments[id]) warnings.push(`${id} declares ${output} but has no runtime report document.`);
      if (runtimeFormatters && ["markdown", "json"].includes(output) && !runtimeFormatters[id]?.includes(output)) warnings.push(`${id} declares ${output} but has no registered runtime formatter.`);
    }
    return { id, status: definition?.status || "undefined", scopes: definition?.supportedScopes || [], declaredOutputs: definition?.supportedOutputs || [], renderedOutputs: rendered, hasDocument: Boolean(runtimeDocuments[id]), hasPreview: Boolean(previewRenderers[id]), completeness: definition?.completeness || "unknown" };
  });
  for (const output of Object.values(renderedActions).flat()) if (!OUTPUTS.includes(output)) warnings.push(`Unknown rendered output ${output}.`);
  return { valid: errors.length === 0, errors, warnings, reports };
}
