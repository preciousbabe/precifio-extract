import { useEffect, useRef, useState, useCallback } from 'react';

const PADDLE_ENV = import.meta.env.VITE_PADDLE_ENVIRONMENT || 'production';
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
    script.onerror = () => console.error('Failed to load Paddle.js');
    document.body.appendChild(script);

    return () => {};
  }, []);

  const initPaddle = () => {
    if (!window.Paddle) {
      console.error('Paddle.js not available after load');
      return;
    }

    if (PADDLE_ENV === 'sandbox') {
      window.Paddle.Environment.set('sandbox');
    } else {
      window.Paddle.Environment.set('production');
    }

    window.Paddle.Initialize({
      token: PADDLE_CLIENT_TOKEN,
    });

    paddleRef.current = window.Paddle;
    setIsReady(true);
  };

  const openCheckout = useCallback((config = {}) => {
    if (!paddleRef.current) {
      console.error('Paddle.js not initialized');
      return;
    }

    paddleRef.current.Checkout.open({
      ...config,
      settings: {
        theme: 'light',
        locale: 'en',
        successUrl: `${window.location.origin}/credits/success`,
        ...config.settings,
      },
    });
  }, []);

  return { isReady, openCheckout };
}