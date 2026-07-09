// src/components/NetworkStatus.jsx

import React from "react";

export default function NetworkStatus({ status }) {
  if (status.isOnline && !status.wasOffline) return null;

  if (!status.isOnline) {
    return (
      <div className="network-status offline">
        <span>⚠️ You are offline. Queue processing paused.</span>
      </div>
    );
  }

  if (status.wasOffline) {
    return (
      <div className="network-status recovered">
        <span>✅ Back online.</span>
        <button onClick={status.dismissOfflineWarning}>Dismiss</button>
      </div>
    );
  }

  if (!status.hasGoodConnection) {
    return (
      <div className="network-status slow">
        <span>🐌 Slow connection detected. Processing may take longer.</span>
      </div>
    );
  }

  return null;
}