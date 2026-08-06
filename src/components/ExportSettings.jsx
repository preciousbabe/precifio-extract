// src/components/ExportSettings.jsx

import React, { useState, useEffect } from "react";

const STORAGE_KEY = "precifio_export_settings";

export const defaultExportSettings = {
  branding: {
    companyName: "",
    showMetadata: true,
    primaryColor: "1A365D"
  },
  includePageNumbers: true,
  includeConfidence: false
};

export function getExportSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultExportSettings };
    const parsed = JSON.parse(raw);
    return {
      branding: { ...defaultExportSettings.branding, ...parsed.branding },
      includePageNumbers: parsed.includePageNumbers ?? defaultExportSettings.includePageNumbers,
      includeConfidence: parsed.includeConfidence ?? defaultExportSettings.includeConfidence
    };
  } catch {
    return { ...defaultExportSettings };
  }
}

export function saveExportSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export default function ExportSettings({ isOpen, onClose }) {
  const [settings, setSettings] = useState(getExportSettings);

  useEffect(() => {
    if (isOpen) setSettings(getExportSettings());
  }, [isOpen]);

  const updateBranding = (key, value) => {
    setSettings(s => ({ ...s, branding: { ...s.branding, [key]: value } }));
  };

  const handleSave = () => {
    saveExportSettings(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
    }} onClick={onClose}>
      <div style={{
        background: "white", borderRadius: "12px", padding: "28px",
        width: "92%", maxWidth: "440px", boxShadow: "0 20px 40px rgba(0,0,0,0.15)"
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 20px", fontSize: "18px", color: "#1e293b" }}>Export Settings</h2>

        <div style={{ marginBottom: "18px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
            Company Name
          </label>
          <input
            type="text"
            value={settings.branding.companyName}
            onChange={e => updateBranding("companyName", e.target.value)}
            placeholder="e.g. Acme Corp"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: "8px",
              border: "1px solid #d1d5db", fontSize: "14px", boxSizing: "border-box"
            }}
          />
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#6b7280" }}>
            Appears on PDF, Word, Excel and email exports. Leave blank for clean, white-label output.
          </p>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.branding.showMetadata}
              onChange={e => updateBranding("showMetadata", e.target.checked)}
            />
            Show filename and extraction date on exports
          </label>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.includePageNumbers}
              onChange={e => setSettings(s => ({ ...s, includePageNumbers: e.target.checked }))}
            />
            Include page numbers (PDF & Word)
          </label>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.includeConfidence}
              onChange={e => setSettings(s => ({ ...s, includeConfidence: e.target.checked }))}
            />
            Include confidence scores in JSON export
          </label>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 16px", borderRadius: "8px", border: "1px solid #d1d5db",
            background: "white", color: "#374151", fontSize: "14px", cursor: "pointer"
          }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{
            padding: "10px 16px", borderRadius: "8px", border: "none",
            background: "#1e40af", color: "white", fontSize: "14px", cursor: "pointer", fontWeight: 600
          }}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}