// netlify/functions/reconcile-documents.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}

function err(status, message, extra = {}) {
  return { statusCode: status, headers: CORS, body: JSON.stringify({ error: message, ...extra }) };
}

async function getUser(event) {
  const token = event.headers.authorization?.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: "Invalid token", status: 401 };
  return { user: data.user };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return ok({});

  const auth = await getUser(event);
  if (auth.error) return err(auth.status, auth.error);
  const userId = auth.user.id;

  if (event.httpMethod === "POST") {
    const { workspace_id, dataset_side = 'A', documents } = JSON.parse(event.body || "{}");
    if (!workspace_id || !Array.isArray(documents) || documents.length === 0) {
      return err(400, "workspace_id and documents array required");
    }

    const { data: ws } = await supabase
      .from("reconciliation_workspaces")
      .select("id")
      .eq("id", workspace_id)
      .eq("user_id", userId)
      .single();
     if (!ws) return err(404, "Workspace not found");

  const MAX_DOCS_PER_SIDE = 200;

if (documents.length > MAX_DOCS_PER_SIDE) { 
  return err(413, "Too many documents...");
}

// Add validation for document size
const MAX_FIELD_SIZE = 60000; 
for (const d of documents) {
  const size = JSON.stringify(d).length;
  if (size > MAX_FIELD_SIZE) {
    return err(413, `Document exceeds ${MAX_FIELD_SIZE} bytes`);
  }
}


  // Count existing docs on this side
  const { count: existingCount } = await supabase
    .from("reconciliation_documents")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspace_id)
    .eq("dataset_side", dataset_side === 'B' ? 'B' : 'A');

  if ((existingCount || 0) + documents.length > MAX_DOCS_PER_SIDE) {
    return err(413, `Side ${dataset_side} would exceed ${MAX_DOCS_PER_SIDE} documents. This side currently has ${existingCount || 0}.`);
  }

  
        const rows = documents.map((d) => {
      let extractedFields = d.extracted_fields || {};
      let docName = String(d.document_name || "Untitled").slice(0, 255);

      // Unwrap nested extracted_fields from extraction pipeline output (any depth)
      while (
        extractedFields &&
        extractedFields.extracted_fields &&
        typeof extractedFields.extracted_fields === "object" &&
        !Array.isArray(extractedFields.extracted_fields)
      ) {
        docName = String(extractedFields.document_name || docName).slice(0, 255);
        extractedFields = { ...extractedFields.extracted_fields };
      }

      return {
        workspace_id,
        user_id: userId,
        document_name: docName,
        extracted_fields: extractedFields,
        dataset_side: dataset_side === 'B' ? 'B' : 'A',
        source_type: d.source_type || 'extracted',
        status: "unmatched",
      };
    });

    
    const { data, error } = await supabase
      .from("reconciliation_documents")
      .insert(rows)
      .select();

    if (error) return err(500, error.message);
    return ok({ added: data.length, documents: data });
  }

  if (event.httpMethod === "DELETE") {
    const { document_id } = JSON.parse(event.body || "{}");
    if (!document_id) return err(400, "document_id required");

    // Verify ownership via workspace
    const { data: doc } = await supabase
      .from("reconciliation_documents")
      .select("workspace_id")
      .eq("id", document_id)
      .single();

    if (!doc) return err(404, "Document not found");

    const { data: ws } = await supabase
      .from("reconciliation_workspaces")
      .select("id")
      .eq("id", doc.workspace_id)
      .eq("user_id", userId)
      .single();

    if (!ws) return err(403, "Not authorized");

    // Delete matches referencing this doc first (prevent orphans)
    await supabase.from("reconciliation_matches")
      .delete()
      .or(`document_id.eq.${document_id},document_b_id.eq.${document_id}`);

    // Delete document
    const { error } = await supabase.from("reconciliation_documents").delete().eq("id", document_id);
    if (error) return err(500, error.message);

    return ok({ deleted: true });
  }

  return err(405, "Method not allowed");
};

