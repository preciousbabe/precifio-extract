import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useReconciliation } from "../../hooks/useReconciliation";

export default function ReconcileConsentModal({ onClose, onGranted }) {
  const { fetchConsent, grantConsent } = useReconciliation();
  const [hasConsent, setHasConsent] = useState(null);
  const [enabling, setEnabling] = useState(false);
  const grantedRef = useRef(onGranted);
  grantedRef.current = onGranted;

  useEffect(() => {
    let cancelled = false;
    fetchConsent().then((data) => {
      if (cancelled) return;
      const granted = !!data.consent_granted;
      setHasConsent(granted);
      if (granted) grantedRef.current?.();
    });
    return () => { cancelled = true; };
  }, [fetchConsent]);

  const handleEnable = async () => {
    setEnabling(true);
    try {
      await grantConsent();
      onGranted?.();
    } finally {
      setEnabling(false);
    }
  };

  if (hasConsent === null) return null; 

  const overlay = (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white", borderRadius: "16px", padding: "32px",
          width: "92%", maxWidth: "520px", boxShadow: "0 24px 48px rgba(0,0,0,0.2)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>🔄</div>
          <h2 style={{ margin: 0, fontSize: "20px", color: "#1e293b" }}>
            Enable Reconciliation
          </h2>
        </div>

        <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#475569", marginBottom: "20px" }}>
          Reconciliation automatically matches your extracted documents against bank statements,
          purchase orders, delivery notes, and more.
        </p>

        <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "10px" }}>
            <span style={{ color: "#64748b" }}>What we store</span>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Structured text & numbers only</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "10px" }}>
            <span style={{ color: "#64748b" }}>What we never store</span>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Original PDFs, images, or files</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "10px" }}>
            <span style={{ color: "#64748b" }}>How we protect it</span>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>AES-256 encryption</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "#64748b" }}>Your control</span>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Delete anytime in Settings</span>
          </div>
        </div>

        <div style={{ marginBottom: "20px", textAlign: "center" }}>
          <button
            onClick={() => window.open('/reconcile-guide.html', '_blank')}
            style={{
              fontSize: "13px", color: "#1e40af", fontWeight: 600,
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px",
              background: "none", border: "none", cursor: "pointer", padding: 0
            }}
          >
            📖 How Reconciliation Works — Full Guide
            <span style={{ fontSize: "16px" }}>↗</span>
          </button>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px", borderRadius: "8px", border: "1px solid #d1d5db",
              background: "white", color: "#374151", fontSize: "14px", cursor: "pointer"
            }}
          >
            Not Now
          </button>
          <button
            onClick={handleEnable}
            disabled={enabling}
            style={{
              padding: "10px 18px", borderRadius: "8px", border: "none",
              background: "#1e40af", color: "white", fontSize: "14px",
              cursor: "pointer", fontWeight: 600
            }}
          >
            {enabling ? "Enabling…" : "Enable Reconciliation"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}