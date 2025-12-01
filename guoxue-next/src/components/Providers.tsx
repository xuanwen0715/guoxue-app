'use client';

import { AuthProvider } from '@/context/AuthContext';
import { QueryProvider } from '@/context/QueryContext';
import { HistoryProvider } from '@/context/HistoryContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <HistoryProvider>
        <QueryProvider>
          {children}
        </QueryProvider>
      </HistoryProvider>
    </AuthProvider>
  );
}
