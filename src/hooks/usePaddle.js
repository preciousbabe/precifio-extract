import { useEffect, useRef, useState, useCallback } from 'react';

// HARDCODED — bypasses all env variables and build caching
const PADDLE_ENV = 'sandbox';
const PADDLE_CLIENT_TOKEN = 'test_5131257971a18d2b76da882ef96';

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

    console.error('>>> HARDCODED ENV =', PADDLE_ENV);
    window.Paddle.Environment.set('sandbox');

    window.Paddle.Initialize({
      token: PADDLE_CLIENT_TOKEN,
    });

    paddleRef.current = window.Paddle;
    setIsReady(true);
    console.log('Paddle.js initialized in SANDBOX mode');
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