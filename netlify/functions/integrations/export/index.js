// integrations/export/index.js

"use strict";

const exportJSON   = require("./json");
const exportExcel  = require("./excel");
const exportPDF    = require("./pdf");
const exportDOCX   = require("./docx");

async function generateExport({ model, format, config = {} }) {
  if (!model) throw new Error("Export model is required.");
  if (!format) throw new Error("Export format is required.");

  switch (String(format).toLowerCase()) {
    case "json":              return exportJSON(model, config);
    case "excel":
    case "xlsx":              return exportExcel(model, config);
    case "pdf":               return exportPDF(model, config);
    case "docx":              return exportDOCX(model, config);
    default:                  throw new Error(`Unsupported export format: ${format}`);
  }
}

function supports(format) {
  return ["json", "excel", "xlsx", "pdf", "docx"]
    .includes(String(format || "").toLowerCase());
}

function listFormats() {
  return Object.freeze(["json",  "excel", "pdf", "docx"]);
}

module.exports = Object.freeze({ generateExport, supports, listFormats });