
const { extractPDF } = require("../processors/extract-pdf");

const {
  extractTextFromImage: extractImage,
} = require("../processors/extract-image");

const { extractDOCX } = require("../processors/extract-docx");
const { extractXLSX } = require("../processors/extract-xlsx");
const { extractHTML } = require("../processors/extract-html");
const { extractText } = require("../processors/extract-text");

async function extractTextFromFile(file) {
  if (!file) {
    throw new Error("No file provided for extraction.");
  }

  const fileName = file.name || "unnamed-file";
  const mime = file.type || inferMimeType(fileName);

  console.log("Extracting file:", fileName);
  console.log("Mime:", mime);
  console.log("Size:", file.size || file.buffer?.length || "unknown");

  if (
    mime === "application/zip" ||
    fileName.toLowerCase().endsWith(".zip")
  ) {
    throw new Error("ZIP files are not supported for text extraction.");
  }

  // Helper: normalize processor results to a consistent structure.
  function normalizeResult(result, method) {
    if (typeof result === "string") {
      return {
        text: result,
        metadata: { method },
      };
    }

    if (result && typeof result === "object") {
      const text =
        typeof result.text === "string"
          ? result.text
          : typeof result.content === "string"
            ? result.content
            : "";

      return {
        ...result,
        text,
        metadata: {
          ...(result.metadata || {}),
          method:
            result.metadata?.method ||
            result.method ||
            method,
        },
      };
    }

    return {
      text: "",
      metadata: { method },
    };
  }

  // Images: pass the actual image buffer to Tesseract.
  if (mime.startsWith("image/")) {
    let imageBuffer;

    if (Buffer.isBuffer(file)) {
      imageBuffer = file;
    } else if (Buffer.isBuffer(file.buffer)) {
      imageBuffer = file.buffer;
    } else if (Buffer.isBuffer(file.data)) {
      imageBuffer = file.data;
    } else if (file instanceof Uint8Array) {
      imageBuffer = Buffer.from(file);
    } else {
      throw new TypeError(
        "Image extraction requires a Buffer, file.buffer, file.data, or Uint8Array."
      );
    }

    console.log("-> Using IMAGE extractor");

    const result = await extractImage(imageBuffer);

    return normalizeResult(result, "tesseract");
  }

  // PDF
  if (
    mime === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf")
  ) {
    console.log("-> Using PDF extractor");

    const result = await extractPDF(file);

    return normalizeResult(result, "pdf");
  }

  // DOCX
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.toLowerCase().endsWith(".docx")
  ) {
    console.log("-> Using DOCX extractor");

    const result = await extractDOCX(file);

    return normalizeResult(result, "docx");
  }

  // XLSX
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    fileName.toLowerCase().endsWith(".xlsx")
  ) {
    console.log("-> Using XLSX extractor");

    const result = await extractXLSX(file);

    return normalizeResult(result, "xlsx");
  }

  // HTML
  if (
    mime === "text/html" ||
    fileName.toLowerCase().endsWith(".html") ||
    fileName.toLowerCase().endsWith(".htm")
  ) {
    console.log("-> Using HTML extractor");

    const result = await extractHTML(file);

    return normalizeResult(result, "html");
  }

  // Plain text and fallback
  if (
    mime.startsWith("text/") ||
    /\.(txt|csv|md|json|xml|log)$/i.test(fileName)
  ) {
    console.log("-> Using TEXT extractor");

    const result = await extractText(file);

    return normalizeResult(result, "text");
  }

  throw new Error(
    `Unsupported file type: ${mime} (${fileName})`
  );
}

function inferMimeType(fileName) {
  const extension = fileName.toLowerCase().split(".").pop();

  const mimeTypes = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    tiff: "image/tiff",
    tif: "image/tiff",
    docx:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    html: "text/html",
    htm: "text/html",
    txt: "text/plain",
    csv: "text/csv",
    md: "text/markdown",
    json: "application/json",
    xml: "application/xml",
    log: "text/plain",
  };

  return mimeTypes[extension] || "application/octet-stream";
}

module.exports = {
  extractTextFromFile,
  inferMimeType,
};
