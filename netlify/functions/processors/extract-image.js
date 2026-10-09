const fs = require("fs");
const path = require("path");
const Tesseract = require("tesseract.js");

const TESS_CACHE = path.join("/tmp", "tesseract-cache");

// Tesseract.js core diagnostics
try {
  const coreDir = path.dirname(
    require.resolve("tesseract.js-core")
  );

  console.log("[TESSERACT] Core directory:", coreDir);

  for (const name of [
    "tesseract-core-simd.wasm",
    "tesseract-core-simd.wasm.js",
    "tesseract-core.wasm",
    "tesseract-core.wasm.js"
  ]) {
    console.log(
      `[TESSERACT] ${name}:`,
      fs.existsSync(path.join(coreDir, name))
    );
  }
} catch (error) {
  console.error(
    "[TESSERACT] Failed to resolve tesseract.js-core:",
    error.stack || error
  );
}

// Extract text from an image using Tesseract.js
async function extractTextFromImage(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(
      "extractTextFromImage expects the image as a Buffer."
    );
  }

  if (buffer.length === 0) {
    throw new Error("Cannot perform OCR on an empty image.");
  }

  console.log("[TESSERACT] Starting image OCR...");
  console.log(
    "[TESSERACT] Image size:",
    buffer.length,
    "bytes"
  );

  try {
    const result = await Tesseract.recognize(
      buffer,
      "eng",
      {
        cachePath: TESS_CACHE,
        logger: (message) => {
          if (message && message.status) {
            console.log(
              "[TESSERACT] OCR progress:",
              message.status,
              message.progress != null
                ? `${Math.round(message.progress * 100)}%`
                : ""
            );
          }
        }
      }
    );

    const text = result?.data?.text || "";

    console.log(
      "[TESSERACT] OCR completed. Extracted characters:",
      text.length
    );

    return text.trim();
  } catch (error) {
    console.error(
      "[TESSERACT] Image OCR failed:",
      error.stack || error
    );

    throw error;
  }
}

module.exports = {
  extractTextFromImage
};