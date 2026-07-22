"use strict";

const ExcelJS = require("exceljs");
const {
  flattenSegments
} = require("./utils");

const types = require("./types");

const TYPE = types.get("excel");
/**
 * Convert extraction model into an Excel workbook.
 *
 * Returns:
 * {
 *   buffer,
 *   mimeType,
 *   extension,
 *   fileName
 * }
 */
async function exportExcel(model = {}) {

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Precifio Extract";
  workbook.created = new Date();

  const sheet =
    workbook.addWorksheet("Extraction");

  sheet.columns = [
    {
      header: "Field",
      key: "field",
      width: 40
    },
    {
      header: "Value",
      key: "value",
      width: 60
    },
    {
      header: "Confidence",
      key: "confidence",
      width: 18
    }
  ];

  sheet.getRow(1).font = {
    bold: true
  };

  const rows =
    flattenSegments(model.segments);

  rows.forEach(row => {

    sheet.addRow({

      field: row.label,

      value: row.value,

      confidence:
        row.confidence ?? ""

    });

  });

  sheet.views = [
    {
      state: "frozen",
      ySplit: 1
    }
  ];

  const buffer =
    await workbook.xlsx.writeBuffer();

  return {

  buffer,

  mimeType:
    TYPE.mimeType,

  extension:
    TYPE.extension,

  fileName:
    `${model.fileName || "document"}.${TYPE.extension}`

};

}
module.exports = exportExcel;