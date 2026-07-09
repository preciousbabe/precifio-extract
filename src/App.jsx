// src/App.jsx
import { useEffect } from "react";
import "./App.css";

import DocumentUploader from "./components/DocumentUploader";
import DocumentQueue from "./components/Queue/DocumentQueue";
import NetworkStatus from "./components/NetworkStatus";

import { useDocumentQueue } from "./hooks/useDocumentQueue";
import { useQueueProcessor } from "./hooks/useQueueProcessor";
import { useNetworkStatus } from "./hooks/useNetworkStatus";

function App() {
  const queue = useDocumentQueue();
  const network = useNetworkStatus();

  useQueueProcessor(queue);

  // Auto-pause queue when offline
  useEffect(() => {
    if (network.isBad && queue.processing) {
      queue.pause();
    }
  }, [network.isBad, queue.processing, queue.pause]);

  return (
    <div className="app">
      <header className="app-header">
  <h1>Precifio Extract</h1>
  <p>Any document. Any format. One intelligence.</p>
  </header>

      <NetworkStatus status={network} />

      <main className="app-main">
        <DocumentUploader
          onAddFiles={queue.addFiles}
          isProcessing={queue.processing}
        />

        <DocumentQueue queue={queue} />
      </main>
    </div>
  );
}

export default App;