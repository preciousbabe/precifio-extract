// src/hooks/usePaddle.js
import { useEffect, useRef, useState } from 'react';

const PADDLE_ENV = import.meta.env.VITE_PADDLE_ENVIRONMENT || 'sandbox';
const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

export function usePaddle() {
  const [isReady, setIsReady] = useState(false);
  const paddleRef = useRef(null);

  useEffect(() => {
    if (window.Paddle) {
      initPaddle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = initPaddle;
    document.body.appendChild(script);

    return () => {
      // Don't remove script on unmount - Paddle should persist
    };

    function initPaddle() {
      if (!window.Paddle) return;

      if (PADDLE_ENV === 'production') {
        window.Paddle.Environment.set('production');
      } else {
        window.Paddle.Environment.set('sandbox');
      }

      window.Paddle.Initialize({
        token: PADDLE_CLIENT_TOKEN,
        eventCallback: (event) => {
          console.log('Paddle event:', event);
        }
      });

      paddleRef.current = window.Paddle;
      setIsReady(true);
    }
  }, []);

  const openCheckout = (transactionId, options = {}) => {
    if (!paddleRef.current) {
      console.error('Paddle.js not initialized');
      return;
    }

    paddleRef.current.Checkout.open({
      transactionId,
      settings: {
        theme: 'light',
        locale: 'en',
        successUrl: `${window.location.origin}/credits/success`,
        ...options
      }
    });
  };

  return { isReady, openCheckout };
}