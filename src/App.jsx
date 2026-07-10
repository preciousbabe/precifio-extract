import { useEffect } from "react";
import "./App.css";

import DocumentUploader from "./components/DocumentUploader";
import DocumentQueue from "./components/Queue/DocumentQueue";
import NetworkStatus from "./components/NetworkStatus";
import AuthModal from "./components/AuthModal"; 
import { useDocumentQueue } from "./hooks/useDocumentQueue";
import { useQueueProcessor } from "./hooks/useQueueProcessor";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { AuthProvider, useAuth } from "./hooks/useAuth";

function AppContent() {
    // Check for ?mode=login from email link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'login') {
      setShowAuthModal(true);
      setAuthModalMode('login');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const queue = useDocumentQueue();
  const network = useNetworkStatus();
    const { user, isGuest, profile, showAuthModal, setShowAuthModal, setAuthModalMode, requireAuth } = useAuth();

  useQueueProcessor(queue);

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
        {user && (
          <div className="user-bar">
            <span>{profile?.company_name}</span>
            <span className="credits-badge">
              {profile?.credits_remaining} credits
            </span>
          </div>
        )}
      </header>

      <NetworkStatus status={network} />

      <main className="app-main">
        <DocumentUploader
          onAddFiles={queue.addFiles}
          isProcessing={queue.processing}
        />

        <DocumentQueue queue={queue} />
      </main>

      {/* Auth modal shown when guest tries to view/export */}
      <AuthModal />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;