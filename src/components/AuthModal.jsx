// src/components/AuthModal.jsx
import { useAuth } from '../hooks/useAuth';
import { Auth } from './Auth';  // or wherever you save the Auth component

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, authModalMode } = useAuth();

  if (!showAuthModal) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50
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
          position: 'relative'
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
        <Auth initialMode={authModalMode} />
      </div>
    </div>
  );
}