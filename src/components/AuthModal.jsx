import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { Auth } from './Auth';

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, authModalMode, authModalMessage } = useAuth();

  const resetToken = typeof window !== 'undefined'
    ? localStorage.getItem('precifio_reset_token')
    : null;

  if (!showAuthModal) return null;

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200000
      }}
      onClick={() => setShowAuthModal(false)}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '480px',
          width: '90%',
          position: 'relative',
          zIndex: 200001
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowAuthModal(false)}
          style={{
            position: 'absolute',
            top: '12px',
            right: '16px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#6b7280'
          }}
        >
          ×
        </button>

        <Auth initialMode={authModalMode} resetToken={resetToken} featureMessage={authModalMessage} />
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}