// app/auth/login/page.tsx
import { Suspense } from 'react';
import AuthPageClient from './AuthPageClient';

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-56px)] flex items-center justify-center text-xs text-slate-400">
          ログイン画面を読み込み中です…
        </div>
      }
    >
      <AuthPageClient />
    </Suspense>
  );
}