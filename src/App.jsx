import { useEffect, useState } from "react";
import "./App.css";
import ExportSettings, { getExportSettings } from "./components/ExportSettings";
import DocumentUploader from "./components/DocumentUploader";
import DocumentQueue from "./components/Queue/DocumentQueue";
import NetworkStatus from "./components/NetworkStatus";
import AuthModal from "./components/AuthModal";
import ReconcileHomeButton from "./components/Reconcile/ReconcileHomeButton";
import { BuyCredits } from "./components/BuyCredits";
import AdminDashboard from './components/AdminDashboard';
import { useDocumentQueue } from "./hooks/useDocumentQueue";
import { useQueueProcessor } from "./hooks/useQueueProcessor";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { PaymentSuccess } from './components/PaymentSuccess';
import { ErrorProvider } from "./context/ErrorContext";
import { AppErrorBoundary } from "./components/ErrorBoundary";
import { ErrorModal } from "./components/ErrorModal";


function AppContent() {
  // ✅ MUST be first — before any useEffect that uses these values
  const { 
    user, 
    isGuest, 
    profile, 
    setProfile,           
    showAuthModal, 
    setShowAuthModal, 
    setAuthModalMode, 
    logout 
  } = useAuth();

  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [creditAlert, setCreditAlert] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const queue = useDocumentQueue();
  const network = useNetworkStatus();
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(
    window.location.pathname === '/credits/success'
  );
  
  useQueueProcessor(queue);

  // Check for ?mode=login from email link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'login') {
      setShowAuthModal(true);
      setAuthModalMode('login');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setShowAuthModal, setAuthModalMode]);


  // App.jsx
useEffect(() => {
  // Handle password reset landing from email link
  const hash = window.location.hash; // #access_token=...&type=recovery
  const search = new URLSearchParams(window.location.search);

  if (search.get('mode') === 'reset' || hash.includes('type=recovery')) {
    const hashParams = new URLSearchParams(hash.replace('#', ''));
    const token = hashParams.get('access_token');

    if (token) {
      // Pass token to AuthModal via a global or context; simplest is localStorage
      localStorage.setItem('precifio_reset_token', token);
      setAuthModalMode('reset');
      setShowAuthModal(true);
    }

    // Clean URL so the token doesn't sit in the address bar
    window.history.replaceState({}, '', window.location.pathname);
  }
}, [setAuthModalMode, setShowAuthModal]);

  // Listen for insufficient credits event from queue processor
  useEffect(() => {
    const handleShowBuyCredits = (e) => {
      setCreditAlert(e.detail);
      setShowBuyCredits(true);
    };
    window.addEventListener('showBuyCredits', handleShowBuyCredits);
    return () => window.removeEventListener('showBuyCredits', handleShowBuyCredits);
  }, []);

  // ✅ Listen for real-time credit updates from successful extractions (no API call)
  useEffect(() => {
    const handleCreditsUpdated = (e) => {
      setProfile(prev => prev ? { ...prev, credits_remaining: e.detail.newBalance } : prev);
    };
    window.addEventListener('creditsUpdated', handleCreditsUpdated);
    return () => window.removeEventListener('creditsUpdated', handleCreditsUpdated);
  }, [setProfile]);

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

              <ReconcileHomeButton />
      
                 <button 
                className="settings-btn" 
                onClick={() => setShowSettings(true)}
                title="Export Settings"
                style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", color: "#64748b" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
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
      // Pass a lightweight alert so the $5 mini appears
      setCreditAlert({ required: 1, available: profile.credits_remaining, fileName: 'your documents' });
      setShowBuyCredits(true);
    }}>
      Buy more
    </button>
  </div>
  )}
  
      <NetworkStatus status={network} />

            <main className="app-main">
                {!user && (
          <div className="guest-hero">

  <div className="guest-hero-badge">
    🎉 1 Free Extraction — No Sign Up Required
  </div>

  <h2 className="guest-headline">
    AI Document Extraction for Invoices, Receipts, Bank Statements & More
  </h2>

  <p className="guest-subheadline">
    Extract structured data from financial and business documents in seconds.
    Upload invoices, receipts, bank statements, purchase orders, PDFs and other
    documents and turn them into usable data without manual data entry.
  </p>

  <div className="steps-strip">

    <div className="step">
      <div className="step-icon">📸</div>
      <div className="step-title">Upload Your Document</div>
      <div className="step-desc">
        PDF, JPG, PNG and more
      </div>
    </div>

    <div className="step-arrow">→</div>

    <div className="step">
      <div className="step-icon">⚡</div>
      <div className="step-title">AI Extracts the Data</div>
      <div className="step-desc">
        Structured information in seconds
      </div>
    </div>

    <div className="step-arrow">→</div>

    <div className="step">
      <div className="step-icon">📥</div>
      <div className="step-title">Export Your Data</div>
      <div className="step-desc">
        Excel, JSON, DOCX & PDF
      </div>
    </div>

  </div>

  <div className="guest-features">

    <span className="feature-item">
      ✅ AI invoice data extraction
    </span>

    <span className="feature-item">
      ✅ Financial PDF data extraction
    </span>

    <span className="feature-item">
      ✅ Bank statement & receipt extraction
    </span>

    <span className="feature-item">
      ✅ Batch document processing
    </span>

    <span className="feature-item">
      ✅ 10 free credits when you sign up
    </span>

    <span className="feature-item">
      ✅ No credit card required
    </span>

    <span className="feature-item">
      ✅ Zero data retention
    </span>

  </div>

  <DocumentUploader
          onAddFiles={queue.addFiles}
          isProcessing={queue.processing}
        />
        <DocumentQueue queue={queue} />

  <button
    className="guest-signup-btn"
    onClick={() => {
      setShowAuthModal(true);
      setAuthModalMode('signup');
    }}
  >
    Sign Up Free — Get 10 Credits
  </button>

  {/* SEO content */}
  <section className="seo-content">

    <h2>
      Extract Data from Financial Documents with AI
    </h2>

    <p>
      Precifio Extract is an AI document extraction tool designed to help
      businesses, accounting teams and finance professionals extract useful
      information from financial documents without manually copying data.
    </p>

    <p>
      Extract data from invoices, receipts, bank statements, purchase orders,
      utility bills and other business documents. Precifio Extract processes
      supported documents and converts the information into structured data
      that can be exported for use in accounting and financial workflows.
    </p>

   <h3>
  Extract Data from Any Business Document
</h3>

<p>
  Precifio Extract uses AI to extract structured information from a wide range
  of financial and business documents, including invoices, receipts, bank
  statements, purchase orders, utility bills, contracts and other supported
  document types. Extracted information can be used in accounting, finance and
  business workflows without manually copying data from documents.
</p>
    <h3>
      Financial PDF and Document Extraction
    </h3>

    <p>
      Turn information contained in financial PDFs and business documents into
      structured, usable data. Precifio Extract is designed for workflows where
      teams need to move information from documents into spreadsheets,
      applications or other financial processes.
    </p>

    <h3>
      Built for Accounting and Finance Teams
    </h3>

    <p>
      Precifio Extract can be useful for accounting firms, bookkeeping
      companies, finance teams, accounts payable teams, accounts receivable
      teams and businesses that process financial documents regularly.
    </p>

    <h3>
      Export Extracted Data
    </h3>

    <p>
      After extraction, users can export their structured information in
      supported formats including Excel, JSON, DOCX and PDF.
    </p>

    <h3>
      Financial Reconciliation Workflows
    </h3>

    <p>
      Precifio also supports financial reconciliation workflows, helping users
      compare financial records and investigate differences between records.
    </p>

  </section>

    </div>
        )}

        
      </main>


            {/* FOOTER */}
      <footer className="app-footer">
        <div className="footer-inner">
          <span className="footer-brand">Precifio Extract</span>
          <div className="footer-links">
            <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
            <span className="footer-dot">·</span>
            <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
            <span className="footer-dot">·</span>
            <a href="/support" target="_blank" rel="noopener noreferrer">Support</a>
            <span className="footer-dot">·</span>
            <a href="/refund-policy" target="_blank" rel="noopener noreferrer">Policy</a>
            
          </div>
          <span className="footer-copy">&copy; 2026 Precifio</span>
        </div>
      </footer>

      <AuthModal />

            {/* Payment Success Overlay */}
      {showPaymentSuccess && (
        <PaymentSuccess
          profile={profile}
          onDone={() => {
            setShowPaymentSuccess(false);
            window.history.replaceState({}, '', '/');
            localStorage.removeItem('precifio_pending_credits');
          }}
        />
      )}

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
      
            <ExportSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Admin Panel Trigger */}
            {user?.is_admin === true && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999 }}>
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            style={{
              background: '#0f172a', color: '#fff', border: 'none',
              borderRadius: 50, padding: '12px 20px', fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          >
            🛡️ {showAdmin ? 'Close' : 'Admin'}
          </button>
        </div>
      )}

      {showAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 9998, overflow: 'auto' }}>
          <AdminDashboard />
        </div>
      )}

    </div>
  );
}

function App() {
  return (
    <ErrorProvider>
      <AuthProvider>
        <AppErrorBoundary>
          <AppContent />
        </AppErrorBoundary>
      </AuthProvider>
      <ErrorModal />
    </ErrorProvider>
  );
}

export default App;