// src/services/reconcileService.js
const API_BASE = import.meta.env.VITE_API_URL || "/.netlify/functions";

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("precifio_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { ...getAuthHeaders(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : (data.error?.message || data.error?.error || JSON.stringify(data.error) || "Request failed");
    const err = new Error(msg);
    err.code = data.error?.code || data.code || null;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const reconcileService = {
  getConsent: () => api("/reconcile-consent"),
  updateConsent: (consentGranted, matchSettings) =>
    api("/reconcile-consent", {
      method: "POST",
      body: JSON.stringify({ consent_granted: consentGranted, match_settings: matchSettings }),
    }),

  listWorkspaces: () => api("/reconcile-workspace"),
  getWorkspace: (id) => api(`/reconcile-workspace?workspace_id=${id}`),
  createWorkspace: (payload) =>
    api("/reconcile-workspace", { method: "POST", body: JSON.stringify(payload) }),
  deleteWorkspace: (workspace_id) =>
    api("/reconcile-workspace", { method: "DELETE", body: JSON.stringify({ workspace_id }) }),

  addDocuments: (workspace_id, dataset_side, documents) =>
    api("/reconcile-documents", {
      method: "POST",
      body: JSON.stringify({ workspace_id, dataset_side, documents }),
    }),

      removeDocument: (document_id) =>
    api("/reconcile-documents", {
      method: "DELETE",
      body: JSON.stringify({ document_id }),
    }),

    deleteAllData: () => api("/reconcile-delete-all", { method: "POST" }),

  getMatchConfig: (workspace_id) => api(`/reconcile-configure?workspace_id=${workspace_id}`),
  saveMatchConfig: (workspace_id, configuration) =>
    api("/reconcile-configure", {
      method: "POST",
      body: JSON.stringify({ workspace_id, configuration }),
    }),

 runReconciliation: async (workspace_id) => {
  const data = await api("/reconcile-run", {
    method: "POST",
    body: JSON.stringify({ workspace_id }),
  });

  // Update the global credit badge immediately after
  // a successful reconciliation charge.
  if (
    data?.cost?.deducted === true &&
    typeof data?.cost?.balance_after === "number"
  ) {
    window.dispatchEvent(
      new CustomEvent("creditsUpdated", {
        detail: {
          newBalance: data.cost.balance_after,
          source: "reconciliation",
        },
      })
    );
  }

  return data;
},

    getResults: (workspace_id, status, side) => {
    const params = new URLSearchParams({ workspace_id });
    if (status) params.append("status", status);
    if (side) params.append("side", side);
    return api(`/reconcile-results?${params.toString()}`);
  },

    exportWorkspace: (workspace_id, format = "excel") =>
    api("/reconcile-export", {
      method: "POST",
      body: JSON.stringify({ workspace_id, format }),
    }),

  getFieldAliases: () => api("/reconcile-field-aliases"),
  saveFieldAlias: (payload) =>
    api("/reconcile-field-aliases", { method: "POST", body: JSON.stringify(payload) }),
  deleteFieldAlias: (id) =>
    api("/reconcile-field-aliases", { method: "DELETE", body: JSON.stringify({ id }) }),
};