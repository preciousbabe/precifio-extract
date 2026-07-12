import { useEffect, useState } from "react";
import "./App.css";

import DocumentUploader from "./components/DocumentUploader";
import DocumentQueue from "./components/Queue/DocumentQueue";
import NetworkStatus from "./components/NetworkStatus";
import AuthModal from "./components/AuthModal";
import { BuyCredits } from "./components/BuyCredits";
import { useDocumentQueue } from "./hooks/useDocumentQueue";
import { useQueueProcessor } from "./hooks/useQueueProcessor";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { AuthProvider, useAuth } from "./hooks/useAuth";

function AppContent() {
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [creditAlert, setCreditAlert] = useState(null);

  // Check for ?mode=login from email link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'login') {
      setShowAuthModal(true);
      setAuthModalMode('login');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Listen for insufficient credits event from queue processor
  useEffect(() => {
    const handleShowBuyCredits = (e) => {
      setCreditAlert(e.detail);
      setShowBuyCredits(true);
    };
    window.addEventListener('showBuyCredits', handleShowBuyCredits);
    return () => window.removeEventListener('showBuyCredits', handleShowBuyCredits);
  }, []);

  const queue = useDocumentQueue();
  const network = useNetworkStatus();
  const { user, isGuest, profile, showAuthModal, setShowAuthModal, setAuthModalMode, logout } = useAuth();

  useQueueProcessor(queue);

  useEffect(() => {
    if (network.isBad && queue.processing) {
      queue.pause();
    }
  }, [network.isBad, queue.processing, queue.pause]);

  const token = localStorage.getItem('precifio_token');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Precifio Extract</h1>
          <p>Any document. Any format. One intelligence.</p>
        </div>
        
        <div className="header-right">
          {isGuest ? (
            <span className="guest-badge">Guest Mode — 1 free extraction</span>
          ) : user && profile ? (
            <div className="credits-bar">
              <span className="credits-badge">
                💎 {profile.credits_remaining} credit{profile.credits_remaining !== 1 ? 's' : ''}
              </span>
              <button 
                className="buy-credits-btn"
                onClick={() => {
                  setCreditAlert(null);
                  setShowBuyCredits(true);
                }}
              >
                Buy Credits
              </button>
              <button 
                className="logout-btn"
                onClick={() => {
                  logout();
                  window.location.reload();
                }}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {/* Low credits warning banner */}
      {!isGuest && profile && profile.credits_remaining <= 5 && profile.credits_remaining > 0 && (
        <div className="credit-warning-banner">
          <span>⚠️ You have {profile.credits_remaining} credit{profile.credits_remaining !== 1 ? 's' : ''} left.</span>
          <button onClick={() => {
            setCreditAlert(null);
            setShowBuyCredits(true);
          }}>
            Buy more
          </button>
        </div>
      )}

      <NetworkStatus status={network} />

      <main className="app-main">
        <DocumentUploader
          onAddFiles={queue.addFiles}
          isProcessing={queue.processing}
        />
        <DocumentQueue queue={queue} />
      </main>

      <AuthModal />

      {showBuyCredits && (
        <BuyCredits
          session={{ 
            access_token: token, 
            user: user ? { id: user.id, email: user.email } : null 
          }}
          alert={creditAlert}
          onClose={() => {
            setShowBuyCredits(false);
            setCreditAlert(null);
          }}
          onSuccess={() => {
            setShowBuyCredits(false);
            setCreditAlert(null);
            window.location.reload();
          }}
        />
      )}
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