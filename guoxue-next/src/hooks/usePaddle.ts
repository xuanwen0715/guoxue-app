'use client';

import { useEffect, useState } from 'react';
import { initializePaddle, Paddle } from '@paddle/paddle-js';
import { PADDLE_CONFIG } from '@/lib/paddle';

let paddleInstance: Paddle | null = null;

export function usePaddle() {
  const [paddle, setPaddle] = useState<Paddle | null>(paddleInstance);
  const [isLoading, setIsLoading] = useState(!paddleInstance);

  useEffect(() => {
    if (paddleInstance) {
      setPaddle(paddleInstance);
      setIsLoading(false);
      return;
    }

    initializePaddle({
      environment: PADDLE_CONFIG.environment,
      token: PADDLE_CONFIG.clientToken,
    }).then((instance) => {
      if (instance) {
        paddleInstance = instance;
        setPaddle(instance);
      }
      setIsLoading(false);
    }).catch((error) => {
      console.error('[Paddle] Failed to initialize:', error);
      setIsLoading(false);
    });
  }, []);

  return { paddle, isLoading };
}
