// integrations/export/json.js

"use strict";

const utils = require("./utils");
const types = require("./types");
const TYPE = types.get("json");

function stripConfidence(segments) {
  if (!segments) return [];
  return segments.map(segment => ({
    segment_name: segment.segment_name || "Section",
    fields: (segment.fields || []).map(field => {
      const { confidence, ...rest } = field;
      // Also strip nested confidence inside object values
      if (rest.value && typeof rest.value === "object" && !Array.isArray(rest.value)) {
        const { confidence: nc, ...cleanValue } = rest.value;
        return { ...rest, value: cleanValue };
      }
      return rest;
    })
  }));
}

function keepConfidence(segments) {
  if (!segments) return [];
  return segments.map(segment => ({
    segment_name: segment.segment_name || "Section",
    fields: (segment.fields || []).map(field => ({
      label: field.label || "",
      value: field.value,
      confidence: field.confidence ?? null
    }))
  }));
}

async function exportJSON(model, config = {}) {
  if (!model || typeof model !== "object") {
    throw new Error("Export model is required.");
  }

  const cfg = {
    includeConfidence: false,
    includeMetadata: true,
    ...config
  };

  const docModel = utils.normalizeModel(model);

  const document = {
    segments: cfg.includeConfidence
      ? keepConfidence(docModel.segments)
      : stripConfidence(docModel.segments)
  };

  if (cfg.includeMetadata !== false) {
    document.fileName = docModel.fileName;
    document.extractedAt = docModel.extractedAt;
    if (docModel.documentSummary) document.documentSummary = docModel.documentSummary;
  }

  const json = JSON.stringify(document, null, 2);

  return {
    buffer: utils.toBuffer(json),
    mimeType: TYPE.mimeType,
    extension: TYPE.extension,
    fileName: utils.buildFileName(docModel.fileName, TYPE.extension)
  };
}

module.exports = exportJSON;