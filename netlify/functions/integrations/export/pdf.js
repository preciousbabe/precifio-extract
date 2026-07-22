"use strict";

const PDFDocument = require("pdfkit");
const { normalizeModel } = require("./utils");

/**
 * Generate a PDF report.
 *
 * Returns:
 * Buffer
 */
async function exportPDF(model = {}) {

  const docModel = normalizeModel(model);

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument({

      size: "A4",

      margin: 50

    });

    const buffers = [];

    doc.on("data", chunk => {

      buffers.push(chunk);

    });

    doc.on("end", () => {

  const buffer = Buffer.concat(buffers);

  resolve({

    buffer,

    mimeType: "application/pdf",

    extension: "pdf",

    fileName:
      `${docModel.fileName || "document"}.pdf`

  });

});

    doc.on("error", reject);

    /* -------------------------------------------------------- */
    /* Header */
    /* -------------------------------------------------------- */

    doc
      .fontSize(22)
      .text("Precifio Extract Report", {
        align: "center"
      });

    doc.moveDown();

    doc
      .fontSize(12)
      .text(`Document: ${docModel.fileName}`);

    doc.text(
      `Generated: ${new Date().toLocaleString()}`
    );

    doc.moveDown();

    /* -------------------------------------------------------- */
    /* Summary */
    /* -------------------------------------------------------- */

    if (docModel.documentSummary) {

      doc
        .fontSize(16)
        .text("Summary");

      doc.moveDown(0.4);

      doc
        .fontSize(11)
        .text(docModel.documentSummary);

      doc.moveDown();

    }

    /* -------------------------------------------------------- */
    /* Metadata */
    /* -------------------------------------------------------- */

    if (Object.keys(docModel.metadata).length) {

      doc
        .fontSize(16)
        .text("Metadata");

      doc.moveDown(0.3);

      Object.entries(docModel.metadata)

        .forEach(([key, value]) => {

          doc
            .fontSize(11)
            .text(`${key}: ${String(value)}`);

        });

      doc.moveDown();

    }

    /* -------------------------------------------------------- */
    /* Segments */
    /* -------------------------------------------------------- */

    doc
      .fontSize(16)
      .text("Extracted Data");

    doc.moveDown();

    for (const segment of docModel.segments) {

      doc

        .fontSize(14)

        .text(segment.segment_name || "Section", {

          underline: true

        });

      doc.moveDown(0.2);

      for (const field of segment.fields || []) {

        doc

          .fontSize(11)

          .text(

            `${field.label}: ${field.value ?? ""}`

          );

      }

      doc.moveDown();

    }

    /* -------------------------------------------------------- */

    doc.end();

  });

}
module.exports = exportPDF;