'use client';

import { AuthProvider } from '@/context/AuthContext';
import { QueryProvider } from '@/context/QueryContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        {children}
      </QueryProvider>
    </AuthProvider>
  );
}
