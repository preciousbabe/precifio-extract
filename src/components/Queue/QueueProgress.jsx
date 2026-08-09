// src/components/Queue/QueueProgress.jsx
// Progress bar for the currently processing document.

import React from "react";

export default function QueueProgress({
  progress = 0,
  status = "queued"
}) {
  const percent =
  status === "completed"
    ? 100
    : status === "failed"
      ? Math.min(99, Math.max(0, Math.round(progress)))
      : Math.max(0, Math.min(99, Math.round(progress)));

  const getStatusText = () => {
    switch (status) {
      case "uploading":
        return "Uploading file...";
      case "sending":
        return "Sending to server...";
      case "processing":
        return "Processing document...";
      case "extracting":
        return "Extracting text...";
      case "ocr":
        return "Running OCR...";
      case "ai":
        return "Analyzing with AI...";
      case "saving":
        return "Saving result...";
        case "recovering":
  return "Recovering saved result...";
      case "completed":
        return "Completed";
    case "failed":
     return "Request interrupted — result may still be available";
      default:
        return "Waiting in queue...";
    }
  };

  const getStatusClass = () => {
  if (status === "failed") return "failed";
  if (status === "completed") return "completed";

  if (
    status === "processing" ||
    status === "uploading" ||
    status === "sending" ||
    status === "extracting" ||
    status === "ocr" ||
    status === "ai" ||
    status === "saving" ||
    status === "recovering"
  ) {
    return "active";
  }

  return "";
};

  return (
    <div className="queue-progress">
      <div className="queue-progress-header">
        <span className="queue-progress-label">
          {getStatusText()}
        </span>
        <span className="queue-progress-percent">
          {percent}%
        </span>
      </div>

      <div className="queue-progress-track">
        <div
          className={`queue-progress-fill ${getStatusClass()}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}