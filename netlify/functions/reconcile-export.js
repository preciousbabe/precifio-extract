// netlify/functions/reconcile-export.js
const { createClient } = require("@supabase/supabase-js");
const XLSX = require("xlsx");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}

function err(status, message) {
  return { statusCode: status, headers: CORS, body: JSON.stringify({ error: message }) };
}

async function getUser(event) {
  const token = event.headers.authorization?.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: "Invalid token", status: 401 };
  return { user: data.user };
}

function truncate(str, len) {
  const s = String(str ?? "");
  return s.length > len ? s.slice(0, len - 3) + "..." : s;
}

function buildExcel(workspace, documents, matches) {
  const docRows = documents.map(d => ({
    ID: d.id,
    Name: d.document_name,
    Side: d.dataset_side,
    Status: d.status,
    Score: d.match_score,
    ...d.extracted_fields,
  }));
  const matchRows = matches.map(m => ({
    Side_A_ID: m.document_id,
    Side_B_ID: m.document_b_id,
    Type: m.match_type,
    Status: m.status,
    Score: m.match_score,
    Gate_Failures: (m.gate_failures || []).join(", "),
    Warnings: (m.warnings || []).join(", "),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docRows), "Documents");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchRows), "Matches");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buf.toString("base64");
}

async function buildPDF(workspace, documents, matches) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const rowHeight = 14;
  const fontSize = 8;
  const headerFontSize = 9;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawText = (text, x, y, opts = {}) => {
    const { size = fontSize, color = rgb(0,0,0), font: f = font } = opts;
    page.drawText(truncate(text, 80), { x, y, size, font: f, color });
  };

  const checkNewPage = (needed = rowHeight) => {
    if (y < margin + needed) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawHeader = (title) => {
    checkNewPage(30);
    page.drawText(title, { x: margin, y, size: 13, font: boldFont, color: rgb(0.12, 0.24, 0.45) });
    y -= 18;
  };

  const drawRow = (cells, widths, isHeader = false) => {
    checkNewPage();
    let x = margin;
    const f = isHeader ? boldFont : font;
    const s = isHeader ? headerFontSize : fontSize;
    const c = isHeader ? rgb(0.12, 0.24, 0.45) : rgb(0,0,0);
    cells.forEach((cell, i) => {
      drawText(cell, x, y, { size: s, font: f, color: c });
      x += widths[i];
    });
    y -= rowHeight;
  };

  page.drawText(truncate(workspace.name || "Reconciliation", 60), { x: margin, y, size: 17, font: boldFont });
  y -= 16;
  drawText(`Generated: ${new Date().toLocaleString()}`, margin, y, { size: 9 });
  y -= 22;

  const summary = workspace.summary || {};
  drawText(`Matched: ${summary.matched || 0} · Review: ${summary.review || 0} · Partial: ${summary.partial || 0} · Unmatched: ${summary.unmatched || 0}`, margin, y, { size: 9 });
  y -= 28;

  const sideA = documents.filter(d => d.dataset_side === "A");
  const sideB = documents.filter(d => d.dataset_side === "B");
  const docCols = [170, 60, 50, 230];

  if (sideA.length) {
    drawHeader("Side A Documents");
    drawRow(["Name", "Status", "Score", "Fields"], docCols, true);
    sideA.forEach(d => {
      const fields = truncate(JSON.stringify(d.extracted_fields ?? {}), 50);
      drawRow([d.document_name, d.status, d.match_score ? `${d.match_score}%` : "—", fields], docCols);
    });
    y -= 10;
  }

  if (sideB.length) {
    drawHeader("Side B Documents");
    drawRow(["Name", "Status", "Score", "Fields"], docCols, true);
    sideB.forEach(d => {
      const fields = truncate(JSON.stringify(d.extracted_fields ?? {}), 50);
      drawRow([d.document_name, d.status, d.match_score ? `${d.match_score}%` : "—", fields], docCols);
    });
    y -= 10;
  }

  if (matches.length) {
    drawHeader("Match Results");
    const matchCols = [140, 140, 80, 50, 80];
    drawRow(["Side A", "Side B", "Type", "Score", "Status"], matchCols, true);
    matches.forEach(m => {
      const docA = documents.find(d => d.id === m.document_id);
      const docB = documents.find(d => d.id === m.document_b_id);
      drawRow([
        docA?.document_name || "—",
        docB?.document_name || "—",
        m.match_type,
        `${m.match_score}%`,
        m.status
      ], matchCols);
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return ok({});
  if (event.httpMethod !== "POST") return err(405, "Method not allowed");

  const auth = await getUser(event);
  if (auth.error) return err(auth.status, auth.error);
  const userId = auth.user.id;

  const { workspace_id, format = "excel" } = JSON.parse(event.body || "{}");
  if (!workspace_id) return err(400, "workspace_id required");

  const { data: ws } = await supabase
    .from("reconciliation_workspaces")
    .select("*")
    .eq("id", workspace_id)
    .eq("user_id", userId)
    .single();
  if (!ws) return err(404, "Workspace not found");

  const { data: documents } = await supabase
    .from("reconciliation_documents")
    .select("*")
    .eq("workspace_id", workspace_id);
  const { data: matches } = await supabase
    .from("reconciliation_matches")
    .select("*")
    .eq("workspace_id", workspace_id);

  const totalDocs = (documents || []).length;
  if (totalDocs > 500) {
    return err(413, "Export limited to 500 documents. Reduce dataset size.");
  }

  const slug = (ws.name || "export").replace(/\s+/g, "-").toLowerCase();
  if (format === "pdf") {
    const pdfBase64 = await buildPDF(ws, documents || [], matches || []);
    return ok({ file: pdfBase64, filename: `reconciliation-${slug}.pdf`, contentType: "application/pdf" });
  } else {
    const excelBase64 = buildExcel(ws, documents || [], matches || []);
    return ok({ file: excelBase64, filename: `reconciliation-${slug}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
};