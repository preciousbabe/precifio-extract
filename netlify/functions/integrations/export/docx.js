"use strict";

const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType
} = require("docx");

const { normalizeModel } = require("./utils");

/**
 * Export extraction model to DOCX.
 *
 * Returns:
 *   Buffer
 */

async function exportDOCX(model = {}) {

  const docModel = normalizeModel(model);

  const children = [];

  /* -------------------------------------------------------- */
  /* Title */
  /* -------------------------------------------------------- */

  children.push(

    new Paragraph({

      heading: HeadingLevel.TITLE,

      children: [

        new TextRun({

          text: "Precifio Extract Report",

          bold: true

        })

      ]

    })

  );

  children.push(

    new Paragraph({

      children: [

        new TextRun({

          text: `Document: ${docModel.fileName}`

        })

      ]

    })

  );

  children.push(

    new Paragraph({

      children: [

        new TextRun({

          text:
            `Generated: ${new Date().toLocaleString()}`

        })

      ]

    })

  );

  children.push(new Paragraph(""));

  /* -------------------------------------------------------- */
  /* Summary */
  /* -------------------------------------------------------- */

  if (docModel.documentSummary) {

    children.push(

      new Paragraph({

        heading: HeadingLevel.HEADING_1,

        text: "Summary"

      })

    );

    children.push(

      new Paragraph(docModel.documentSummary)

    );

    children.push(new Paragraph(""));

  }

  /* -------------------------------------------------------- */
  /* Metadata */
  /* -------------------------------------------------------- */

  if (Object.keys(docModel.metadata).length) {

    children.push(

      new Paragraph({

        heading: HeadingLevel.HEADING_1,

        text: "Metadata"

      })

    );

    Object.entries(docModel.metadata)

      .forEach(([key, value]) => {

        children.push(

          new Paragraph({

            children: [

              new TextRun({

                text: `${key}: `,

                bold: true

              }),

              new TextRun(

                String(value)

              )

            ]

          })

        );

      });

    children.push(new Paragraph(""));

  }

  /* -------------------------------------------------------- */
  /* Segments */
  /* -------------------------------------------------------- */

  children.push(

    new Paragraph({

      heading: HeadingLevel.HEADING_1,

      text: "Extracted Data"

    })

  );

  for (const segment of docModel.segments) {

    children.push(

      new Paragraph({

        heading: HeadingLevel.HEADING_2,

        text:
          segment.segment_name ||
          "Section"

      })

    );

    const fields =
      segment.fields || [];

    if (!fields.length) {

      children.push(

        new Paragraph("No fields.")

      );

      continue;

    }

    const table = new Table({

      width: {

        size: 100,

        type: WidthType.PERCENTAGE

      },

      rows: [

        new TableRow({

          children: [

            new TableCell({

              children: [

                new Paragraph({

                  children: [

                    new TextRun({

                      text: "Field",

                      bold: true

                    })

                  ]

                })

              ]

            }),

            new TableCell({

              children: [

                new Paragraph({

                  children: [

                    new TextRun({

                      text: "Value",

                      bold: true

                    })

                  ]

                })

              ]

            }),

            new TableCell({

              children: [

                new Paragraph({

                  children: [

                    new TextRun({

                      text: "Confidence",

                      bold: true

                    })

                  ]

                })

              ]

            })

          ]

        }),

        ...fields.map(field =>

          new TableRow({

            children: [

              new TableCell({

                children: [

                  new Paragraph(

                    field.label || ""

                  )

                ]

              }),

              new TableCell({

                children: [

                  new Paragraph(

                    field.value == null
                      ? ""
                      : String(field.value)

                  )

                ]

              }),

              new TableCell({

                children: [

                  new Paragraph(

                    field.confidence == null
                      ? "-"
                      : `${field.confidence}%`

                  )

                ]

              })

            ]

          })

        )

      ]

    });

    children.push(table);

    children.push(new Paragraph(""));

  }

  /* -------------------------------------------------------- */

  const document = new Document({

    sections: [

      {

        children

      }

    ]

  });

  const buffer =
  await Packer.toBuffer(document);

return {

  buffer,

  mimeType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  extension:
    "docx",

  fileName:
    `${docModel.fileName || "document"}.docx`

};

}

module.exports = exportDOCX;