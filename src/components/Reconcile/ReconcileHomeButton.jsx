import React, { useState } from "react";
import ReconcileConsentModal from "./ReconcileConsentModal";
import AddToWorkspaceModal from "./AddToWorkspaceModal";
import ReconcileWorkspaceModal from "./ReconcileWorkspaceModal";

export default function ReconcileHomeButton() {
  const [showConsent, setShowConsent] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [wsId, setWsId] = useState(null);

  const handleConsentOk = () => { setShowConsent(false); setShowPicker(true); };
  const handleAdded = (id) => { setShowPicker(false); setWsId(id); };
  const handleCloseAll = () => { setShowConsent(false); setShowPicker(false); setWsId(null); };

  return (
    <>
      <button
        onClick={() => setShowConsent(true)}
        style={{
          padding: "12px 24px", borderRadius: "8px", border: "none",
          background: "#1e40af", color: "white", fontSize: "14px",
          fontWeight: 600, cursor: "pointer", display: "inline-flex",
          alignItems: "center", gap: "8px"
        }}
      >
        🔄 Reconcile Documents
      </button>

      {showConsent && (
        <ReconcileConsentModal onClose={handleCloseAll} onGranted={handleConsentOk} />
      )}
      {showPicker && (
        <AddToWorkspaceModal documents={[]} onClose={handleCloseAll} onAdded={handleAdded} />
      )}
      {wsId && (
        <ReconcileWorkspaceModal workspaceId={wsId} onClose={() => setWsId(null)} />
      )}
    </>
  );
}