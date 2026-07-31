"use strict";

const exporter  = require("./integrations/export");
const responses = require("./integrations/responses");
const logger    = require("./integrations/logger");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return responses.badRequest("Only POST requests are supported.");
  }

  try {
    const body = JSON.parse(event.body || "{}");
    /* FIX: destructure from the already-parsed body */
    const { model, format, config } = body;

    if (!model)  return responses.badRequest("Export model is required.");
    if (!format) return responses.badRequest("Export format is required.");
    if (!exporter.supports(format)) {
      return responses.badRequest(`Unsupported export format: ${format}`);
    }

    logger.info("Generating downloadable export.", {
      format,
      fileName: model.fileName,
      hasConfig: !!config
    });

    const file = await exporter.generateExport({ model, format, config });

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Content-Length": String(file.buffer.length),
        "Cache-Control": "no-store"
      },
      body: file.buffer.toString("base64")
    };

  } catch (error) {
    logger.error("Export generation failed.", {
      error: error.message,
      stack: error.stack
    });
    return responses.serverError(error.message || "Unable to generate export.");
  }
};

